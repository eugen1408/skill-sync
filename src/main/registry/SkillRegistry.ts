import { basename } from 'node:path'
import type { Source, RawSkill } from '@shared/domain/source'
import type { CatalogEntry, AgentInstallation, VersionInfo } from '@shared/domain/skill'
import { normalizeSkillKey, catalogEntryId } from '@shared/domain/skill'
import type { CatalogQuery, CatalogPage } from '@shared/ipc/contract'
import type { SourceManager } from '../sources'
import { logger } from '../logger'
import { RegistryStore } from './store'
import { queryCatalog } from './query'
import { scanInstalledSkills } from './installedScanner'

const ORPHAN_SOURCE_ID = 'installed'

type InstalledMap = Map<string, AgentInstallation[]>
type InstalledScanner = () => Promise<InstalledMap>

/**
 * Локальный индекс каталога: слияние skills источников (Часть 2), установленных на диске
 * и версий (Часть 3/6). Быстрые поиск/фильтрация без сетевых вызовов; версии освежает
 * Update Engine (Часть 6) через applyVersion.
 */
export class SkillRegistry {
  private entries = new Map<string, CatalogEntry>()
  private installed: InstalledMap = new Map()
  private unsub: (() => void) | null = null

  constructor(
    private readonly store: RegistryStore,
    private readonly sourceManager: SourceManager,
    private readonly emit: () => void,
    private readonly scan: InstalledScanner = scanInstalledSkills
  ) {}

  async init(): Promise<void> {
    for (const entry of this.store.load()) this.entries.set(entry.id, entry)
    this.unsub = this.sourceManager.onIndexed((r) => {
      void this.onSourceIndexed(r.source, r.skills).catch((err) =>
        logger.error('Ошибка обновления индекса после индексации источника', err)
      )
    })
    await this.rebuild()
  }

  dispose(): void {
    this.unsub?.()
    this.unsub = null
  }

  query(query: CatalogQuery): CatalogPage {
    const enabled = new Set(
      this.sourceManager
        .list()
        .filter((s) => s.enabled)
        .map((s) => s.id)
    )
    const visible = [...this.entries.values()].filter(
      (e) => e.sourceId === ORPHAN_SOURCE_ID || enabled.has(e.sourceId)
    )
    return queryCatalog(visible, query)
  }

  get(id: string): CatalogEntry | null {
    return this.entries.get(id) ?? null
  }

  async refreshIndex(): Promise<void> {
    await this.rebuild()
  }

  /** Записывает результат определения версии (вызывает Update Engine, Часть 6). */
  applyVersion(skillId: string, info: VersionInfo, checkedAt: string): void {
    const entry = this.entries.get(skillId)
    if (!entry) return
    this.entries.set(skillId, {
      ...entry,
      latestVersion: info.latestVersion,
      hasUpdate: info.hasUpdate,
      lastCheckedAt: checkedAt,
      updateStatus: info.unknown
        ? 'unknown'
        : !entry.installed
          ? 'not_installed'
          : info.hasUpdate
            ? 'update_available'
            : 'up_to_date'
    })
    this.persist()
  }

  /** Пересканирует установленные и пересобирает признаки установки у всех записей. */
  async rescanInstalled(): Promise<void> {
    this.installed = await this.scan()
    for (const [id, entry] of this.entries) {
      this.entries.set(id, this.withInstalled(entry))
    }
    this.recomputeOrphans()
    this.persist()
  }

  // -- внутреннее --

  private async rebuild(): Promise<void> {
    this.installed = await this.scan()
    const next = new Map<string, CatalogEntry>()
    for (const source of this.sourceManager.list()) {
      for (const raw of this.sourceManager.listSkills(source.id)) {
        const entry = this.buildEntry(source, raw)
        next.set(entry.id, entry)
      }
    }
    this.entries = next
    this.recomputeOrphans()
    this.persist()
  }

  private async onSourceIndexed(source: Source, skills: RawSkill[]): Promise<void> {
    this.installed = await this.scan()
    for (const [id, entry] of this.entries) {
      if (entry.sourceId === source.id) this.entries.delete(id)
    }
    for (const raw of skills) {
      const entry = this.buildEntry(source, raw)
      this.entries.set(entry.id, entry)
    }
    this.recomputeOrphans()
    this.persist()
  }

  private buildEntry(source: Source, raw: RawSkill): CatalogEntry {
    const id = catalogEntryId(source.id, raw.name)
    const prev = this.entries.get(id)
    const installations = this.installed.get(normalizeSkillKey(raw.name)) ?? []
    const installed = installations.length > 0
    return {
      id,
      name: raw.name,
      description: raw.description,
      sourceId: source.id,
      sourceType: source.type,
      installed,
      installations,
      latestVersion: prev?.latestVersion ?? null,
      hasUpdate: prev?.hasUpdate ?? false,
      lastCheckedAt: prev?.lastCheckedAt ?? null,
      updateStatus: prev?.updateStatus ?? (installed ? 'unknown' : 'not_installed'),
      sourceRef: raw.sourceRef
    }
  }

  private withInstalled(entry: CatalogEntry): CatalogEntry {
    if (entry.sourceId === ORPHAN_SOURCE_ID) return entry
    const installations = this.installed.get(normalizeSkillKey(entry.name)) ?? []
    const installed = installations.length > 0
    return {
      ...entry,
      installed,
      installations,
      updateStatus: installed ? entry.updateStatus : 'not_installed'
    }
  }

  /** Пересобирает «осиротевшие» записи: установлено, но нет в источниках (эпик Q-01/каталог). */
  private recomputeOrphans(): void {
    for (const [id, entry] of this.entries) {
      if (entry.sourceId === ORPHAN_SOURCE_ID) this.entries.delete(id)
    }
    const covered = new Set([...this.entries.values()].map((e) => normalizeSkillKey(e.name)))
    for (const [slug, installations] of this.installed) {
      if (covered.has(slug)) continue
      const name = basename(installations[0]?.installPath ?? slug)
      const id = `${ORPHAN_SOURCE_ID}:${slug}`
      this.entries.set(id, {
        id,
        name,
        description: null,
        sourceId: ORPHAN_SOURCE_ID,
        sourceType: 'local',
        installed: true,
        installations,
        latestVersion: null,
        hasUpdate: false,
        lastCheckedAt: null,
        updateStatus: 'unknown',
        sourceRef: name
      })
    }
  }

  private persist(): void {
    this.store.save([...this.entries.values()])
    this.emit()
  }
}
