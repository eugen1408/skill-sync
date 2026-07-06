import { basename } from 'node:path'
import type { Source, RawSkill } from '@shared/domain/source'
import { OFFICIAL_SOURCE_ID } from '@shared/domain/source'
import type { CatalogEntry, AgentInstallation, VersionInfo } from '@shared/domain/skill'
import { normalizeSkillKey, catalogEntryId } from '@shared/domain/skill'
import type { OfficialSkill } from '../sources/officialCatalog'
import type { CatalogQuery, CatalogPage } from '@shared/ipc/contract'
import type { SourceManager } from '../sources'
import { logger } from '../logger'
import { RegistryStore } from './store'
import { queryCatalog } from './query'
import { scanInstalledSkills } from './installedScanner'
import type { SkillAttribution } from './lockAttribution'

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
  /** Карта атрибуции установленных skills к источникам из `.skill-lock.json` (Часть 8). */
  private attribution = new Map<string, SkillAttribution>()
  /** Slug'и, принудительно понижённые в local (свап official→local при ошибке, Часть 8). */
  private demoted = new Set<string>()
  /**
   * Записи последнего живого поиска официального каталога (не индексируются в `entries`).
   * Нужны, чтобы `get(id)` мог отдать карточку по клику в результат поиска.
   */
  private liveOfficial = new Map<string, CatalogEntry>()

  constructor(
    private readonly store: RegistryStore,
    private readonly sourceManager: SourceManager,
    private readonly emit: () => void,
    private readonly scan: InstalledScanner = scanInstalledSkills
  ) {}

  /** Устанавливает карту атрибуции из lock (Часть 8); применяется при следующей пересборке. */
  setLockAttribution(attribution: Map<string, SkillAttribution>): void {
    this.attribution = attribution
  }

  async init(): Promise<void> {
    for (const s of this.store.loadDemoted()) this.demoted.add(s)
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
    return queryCatalog(this.visibleEntries(), query)
  }

  /** Как query, но с добавлением внешних записей (живой официальный каталог). */
  queryWith(query: CatalogQuery, extra: CatalogEntry[]): CatalogPage {
    return queryCatalog([...this.visibleEntries(), ...extra], query)
  }

  /** Видимые записи локального индекса (git/local + установленные), без пагинации. */
  visibleEntries(): CatalogEntry[] {
    const enabled = new Set(
      this.sourceManager
        .list()
        .filter((s) => s.enabled)
        .map((s) => s.id)
    )
    return [...this.entries.values()].filter(
      (e) => e.sourceId === ORPHAN_SOURCE_ID || enabled.has(e.sourceId)
    )
  }

  /**
   * Строит записи каталога из живого поиска официального источника (не индексируется).
   * Пропускает skills, уже присутствующие в локальном индексе (установленные/из других
   * источников) — они показываются своей записью. Применяет статус установки.
   */
  buildOfficialEntries(skills: OfficialSkill[]): CatalogEntry[] {
    const existing = new Set([...this.entries.values()].map((e) => normalizeSkillKey(e.name)))
    const seen = new Set<string>()
    const out: CatalogEntry[] = []
    for (const s of skills) {
      const key = normalizeSkillKey(s.name)
      if (!key || existing.has(key) || seen.has(key)) continue
      seen.add(key)
      const installations = this.installed.get(key) ?? []
      const installed = installations.length > 0
      out.push({
        id: catalogEntryId(OFFICIAL_SOURCE_ID, s.name),
        name: s.name,
        description: null,
        sourceId: OFFICIAL_SOURCE_ID,
        sourceType: 'official',
        installed,
        installations,
        latestVersion: null,
        hasUpdate: false,
        lastCheckedAt: null,
        updateStatus: installed ? 'unknown' : 'not_installed',
        sourceRef: s.sourceRef,
        installs: s.installs
      })
    }
    // Кэшируем результаты последнего поиска, чтобы клик по карточке (get/audit) их нашёл.
    this.liveOfficial = new Map(out.map((e) => [e.id, e]))
    return out
  }

  get(id: string): CatalogEntry | null {
    return this.entries.get(id) ?? this.liveOfficial.get(id) ?? null
  }

  async refreshIndex(): Promise<void> {
    await this.rebuild()
  }

  /** Записывает результат определения версии (вызывает Update Engine, Часть 6). */
  applyVersion(skillId: string, info: VersionInfo, checkedAt: string): void {
    const entry = this.entries.get(skillId)
    if (!entry) return
    // Version Resolver определяет и installed-версию (по выигравшей стратегии) — переносим её
    // в установки, иначе «Установленная версия» осталась бы только из lock (или пустой).
    const installations =
      info.installedVersion != null
        ? entry.installations.map((i) => ({ ...i, installedVersion: info.installedVersion }))
        : entry.installations
    this.entries.set(skillId, {
      ...entry,
      installations,
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

  /** Пересканирует установленные и пересобирает индекс (включая атрибуцию из lock). */
  async rescanInstalled(): Promise<void> {
    await this.rebuild()
  }

  /**
   * Свап official→local при ошибке (Q8-02): помечает skill принудительно локальным
   * и пересобирает его запись как локальную осиротевшую. Вызывается Update Engine,
   * когда для official-записи skills.sh определённо не подтверждает наличие.
   */
  demoteToLocal(skillId: string): void {
    const entry = this.entries.get(skillId)
    if (!entry || entry.sourceId !== OFFICIAL_SOURCE_ID) return
    const slug = normalizeSkillKey(entry.name)
    this.demoted.add(slug)
    // Снимок до удаления — чтобы локальная запись унаследовала версии из official.
    const prev = new Map(this.entries)
    this.entries.delete(skillId)
    const local = this.buildInstalledEntry(slug, entry.installations, prev)
    this.entries.set(local.id, local)
    this.persist()
  }

  // -- внутреннее --

  private async rebuild(): Promise<void> {
    // Снимок прежних записей: из него берём поля версий, т.к. this.entries пересобирается
    // с нуля (иначе после rescan все записи потеряли бы статус и стали «Неизвестно»).
    const prev = this.entries
    this.installed = await this.scan()
    const next = new Map<string, CatalogEntry>()
    for (const source of this.sourceManager.list()) {
      // Официальный источник не индексируется — он живой (см. OfficialCatalog).
      if (source.type === 'official') continue

      if (!this.sourceManager.hasIndexed(source.id)) {
        // Источник ещё не проиндексирован в этом запуске.
        // Сохраняем его старые карточки из кэша (prev), чтобы они не превратились в local.
        for (const oldEntry of prev.values()) {
          if (oldEntry.sourceId === source.id) {
            const slug = normalizeSkillKey(oldEntry.name)
            const installations = this.installed.get(slug) ?? []
            const entry: CatalogEntry = {
              ...oldEntry,
              installations,
              installed: installations.length > 0
            }
            next.set(entry.id, entry)
          }
        }
        continue
      }

      for (const raw of this.sourceManager.listSkills(source.id)) {
        const entry = this.buildEntry(source, raw, prev)
        next.set(entry.id, entry)
      }
    }
    this.entries = next
    this.attributeInstalled(prev)
    this.persist()
  }

  private async onSourceIndexed(source: Source, skills: RawSkill[]): Promise<void> {
    if (source.type === 'official') return // официальный источник живой, не индексируется
    this.installed = await this.scan()
    // Снимок до мутаций — источник версий для пересобираемых записей (иначе статус теряется).
    const prev = new Map(this.entries)
    for (const [id, entry] of this.entries) {
      if (entry.sourceId === source.id) this.entries.delete(id)
    }
    for (const raw of skills) {
      const entry = this.buildEntry(source, raw, prev)
      this.entries.set(entry.id, entry)
    }
    this.attributeInstalled(prev)
    this.persist()
  }

  private buildEntry(
    source: Source,
    raw: RawSkill,
    prevEntries: Map<string, CatalogEntry>
  ): CatalogEntry {
    const id = catalogEntryId(source.id, raw.name)
    const prev = prevEntries.get(id)
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
      updateStatus: !installed
        ? 'not_installed'
        : prev?.updateStatus === 'not_installed'
          ? 'unknown'
          : (prev?.updateStatus ?? 'unknown'),
      sourceRef: raw.sourceRef,
      installs: prev?.installs ?? null
    }
  }

  /**
   * Атрибутирует установленные skills, не покрытые индексированными источниками (Часть 8):
   * по карте из lock — к git/official-источнику; иначе (нет lock-записи) — локальный осиротевший.
   * Пересобирает синтетические бакеты `installed`/`official` целиком, сохраняя поля версий.
   */
  private attributeInstalled(prevEntries: Map<string, CatalogEntry>): void {
    const covered = new Set(
      [...this.entries.values()]
        .filter((e) => e.sourceId !== ORPHAN_SOURCE_ID && e.sourceId !== OFFICIAL_SOURCE_ID)
        .map((e) => normalizeSkillKey(e.name))
    )
    const rebuilt: CatalogEntry[] = []
    for (const [slug, installations] of this.installed) {
      if (covered.has(slug)) continue
      rebuilt.push(this.buildInstalledEntry(slug, installations, prevEntries))
      covered.add(slug)
    }
    for (const [id, entry] of this.entries) {
      if (entry.sourceId === ORPHAN_SOURCE_ID || entry.sourceId === OFFICIAL_SOURCE_ID) {
        this.entries.delete(id)
      }
    }
    for (const entry of rebuilt) this.entries.set(entry.id, entry)
  }

  /** Строит запись установленного skill по атрибуции из lock (git/official) или как локальную. */
  private buildInstalledEntry(
    slug: string,
    installations: AgentInstallation[],
    prevEntries: Map<string, CatalogEntry>
  ): CatalogEntry {
    const name = basename(installations[0]?.installPath ?? slug)
    const attr = this.demoted.has(slug) ? undefined : this.attribution.get(slug)

    if (attr?.sourceKind === 'official') {
      return this.installedEntry(
        catalogEntryId(OFFICIAL_SOURCE_ID, name),
        name,
        OFFICIAL_SOURCE_ID,
        'official',
        attr.sourceRef,
        installations,
        prevEntries
      )
    }
    if (attr?.sourceKind === 'git' && attr.sourceUrl) {
      const source = this.sourceManager
        .list()
        .find((s) => s.type === 'git' && s.config.url === attr.sourceUrl)
      if (source) {
        return this.installedEntry(
          catalogEntryId(source.id, name),
          name,
          source.id,
          'git',
          attr.sourceRef,
          installations,
          prevEntries
        )
      }
    }
    // Нет lock-записи (или git-источник ещё не подключён) → локальный осиротевший.
    return this.installedEntry(
      `${ORPHAN_SOURCE_ID}:${slug}`,
      name,
      ORPHAN_SOURCE_ID,
      'local',
      name,
      installations,
      prevEntries
    )
  }

  /** Общая сборка записи установленного skill с сохранением полей версий из предыдущей. */
  private installedEntry(
    id: string,
    name: string,
    sourceId: string,
    sourceType: CatalogEntry['sourceType'],
    sourceRef: string,
    installations: AgentInstallation[],
    prevEntries: Map<string, CatalogEntry>
  ): CatalogEntry {
    const prev = prevEntries.get(id)
    return {
      id,
      name,
      description: prev?.description ?? null,
      sourceId,
      sourceType,
      installed: true,
      installations,
      latestVersion: prev?.latestVersion ?? null,
      hasUpdate: prev?.hasUpdate ?? false,
      lastCheckedAt: prev?.lastCheckedAt ?? null,
      updateStatus: prev?.updateStatus === 'not_installed' ? 'unknown' : (prev?.updateStatus ?? 'unknown'),
      sourceRef,
      installs: prev?.installs ?? null
    }
  }

  private persist(): void {
    this.store.save([...this.entries.values()], [...this.demoted])
    this.emit()
  }
}
