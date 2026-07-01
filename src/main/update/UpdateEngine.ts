import type { CatalogEntry } from '@shared/domain/skill'
import type { UpdateSettings } from '@shared/domain/config'
import type { UpdateCheckResult, UpdateCheckEntry, UpdateRunSummary } from '@shared/domain/update'
import type { InstallRequest } from '@shared/domain/install'
import type { JobContext } from '../jobs/JobRunner'
import type { JobRunner } from '../jobs/JobRunner'
import type { SourceManager } from '../sources'
import type { SkillRegistry } from '../registry'
import type { InstallerService } from '../installer'
import type { ConfigStore } from '../config/ConfigStore'
import type { VersionResolver } from '../version'
import { findLockEntry } from '../version'
import type { NotificationCenter } from '../notifications/NotificationCenter'
import { logger } from '../logger'
import { buildResolveContext } from './resolveContext'

export interface UpdateEngineDeps {
  jobRunner: JobRunner
  sourceManager: SourceManager
  skillRegistry: SkillRegistry
  installer: InstallerService
  resolver: VersionResolver
  notifications: NotificationCenter
  configStore: ConfigStore
  onChecked: (result: UpdateCheckResult) => void
}

const CHECK_CONCURRENCY = 6

/**
 * Проверка и применение обновлений skills. Режимы: вручную / при запуске / по расписанию /
 * при изменении локального источника. Оркеструет Version Resolver + Registry + Installer,
 * генерирует уведомления (FR8).
 */
export class UpdateEngine {
  private intervalTimer: ReturnType<typeof setInterval> | null = null
  private unsubIndexed: (() => void) | null = null

  constructor(private readonly deps: UpdateEngineDeps) {}

  /** Запускает проверку при старте / расписание / реакцию на локальные изменения. */
  start(): void {
    this.reconfigure()
    this.unsubIndexed = this.deps.sourceManager.onIndexed((r) => {
      if (this.settings().watchLocalSources && r.source.type === 'local') {
        this.checkAll()
      }
    })
    if (this.settings().checkOnLaunch) this.checkAll()
  }

  stop(): void {
    if (this.intervalTimer) clearInterval(this.intervalTimer)
    this.intervalTimer = null
    this.unsubIndexed?.()
    this.unsubIndexed = null
  }

  /** Перечитывает расписание из настроек. */
  reconfigure(): void {
    if (this.intervalTimer) clearInterval(this.intervalTimer)
    this.intervalTimer = null
    const s = this.settings()
    if (s.scheduleEnabled && s.scheduleIntervalMinutes && s.scheduleIntervalMinutes > 0) {
      this.intervalTimer = setInterval(() => this.checkAll(), s.scheduleIntervalMinutes * 60_000)
    }
  }

  getSettings(): UpdateSettings {
    return this.settings()
  }

  setSettings(patch: Partial<UpdateSettings>): UpdateSettings {
    const next = { ...this.settings(), ...patch }
    this.deps.configStore.update({ update: next })
    this.reconfigure()
    return next
  }

  /** Проверка обновлений всех установленных skills. Возвращает jobId. */
  checkAll(): string {
    const { jobId } = this.deps.jobRunner.start('update.check', async (ctx) => {
      const result = await this.checkEntries(this.installedEntries(), ctx)
      this.deps.onChecked(result)
      return result
    })
    return jobId
  }

  /** Проверка обновлений одного skill. */
  checkOne(skillId: string): string {
    const { jobId } = this.deps.jobRunner.start('update.check', async (ctx) => {
      const entry = this.deps.skillRegistry.get(skillId)
      const result = await this.checkEntries(entry ? [entry] : [], ctx)
      this.deps.onChecked(result)
      return result
    })
    return jobId
  }

  /** Обновление одного skill (переустановка с force). */
  runOne(skillId: string): string {
    const { jobId } = this.deps.jobRunner.start('update.run', async () => {
      const entry = this.deps.skillRegistry.get(skillId)
      return entry ? this.runEntries([entry]) : { ok: 0, failed: 0, skipped: 0 }
    })
    return jobId
  }

  /** Обновление всех skills с доступным обновлением. */
  runAll(): string {
    const { jobId } = this.deps.jobRunner.start('update.run', async () => {
      const targets = this.installedEntries().filter((e) => e.hasUpdate)
      return this.runEntries(targets)
    })
    return jobId
  }

  // -- внутреннее --

  private settings(): UpdateSettings {
    return this.deps.configStore.get().update
  }

  private installedEntries(): CatalogEntry[] {
    return this.deps.skillRegistry.query({
      text: null,
      sourceIds: null,
      status: 'installed',
      sort: 'name-asc',
      page: 0,
      pageSize: 100_000
    }).items
  }

  private async checkEntries(entries: CatalogEntry[], ctx: JobContext): Promise<UpdateCheckResult> {
    const checkedAt = new Date().toISOString()
    const results: UpdateCheckEntry[] = []
    let done = 0

    for (let i = 0; i < entries.length; i += CHECK_CONCURRENCY) {
      if (ctx.signal.aborted) break
      const batch = entries.slice(i, i + CHECK_CONCURRENCY)
      const batchResults = await Promise.all(batch.map((e) => this.checkEntry(e, checkedAt)))
      results.push(...batchResults)
      done += batch.length
      ctx.progress(Math.round((done / Math.max(1, entries.length)) * 100), `Проверено ${done}`)
    }

    const updatesAvailable = results.filter((r) => r.hasUpdate).length
    return { checkedAt, updatesAvailable, entries: results }
  }

  private async checkEntry(entry: CatalogEntry, checkedAt: string): Promise<UpdateCheckEntry> {
    const source = this.deps.sourceManager.get(entry.sourceId)
    const lockEntry = await findLockEntry(entry.name)
    const info = await this.deps.resolver.resolve(buildResolveContext(entry, source, lockEntry))
    this.deps.skillRegistry.applyVersion(entry.id, info, checkedAt)

    if (info.hasUpdate) {
      this.deps.notifications.add(
        {
          type: 'update_available',
          title: 'Доступна новая версия',
          message: `${entry.name}: ${info.installedVersion ?? '—'} → ${info.latestVersion ?? '—'}`,
          skillId: entry.id,
          sourceId: entry.sourceId
        },
        info.latestVersion ?? undefined
      )
    }

    return {
      skillId: entry.id,
      installedVersion: info.installedVersion,
      latestVersion: info.latestVersion,
      hasUpdate: info.hasUpdate,
      resolvedBy: info.resolvedBy
    }
  }

  private async runEntries(entries: CatalogEntry[]): Promise<UpdateRunSummary> {
    const summary: UpdateRunSummary = { ok: 0, failed: 0, skipped: 0 }
    const config = this.deps.configStore.get().install

    for (const entry of entries) {
      const agents = entry.installations.map((i) => i.agent)
      const request: InstallRequest = {
        skillId: entry.id,
        sourceId: entry.sourceId,
        sourceRef: entry.sourceRef,
        targetAgents: agents.length > 0 ? agents : config.targetAgents,
        scope: config.scope,
        force: true
      }
      const result = await this.deps.installer.startInstall(request).promise
      if (!result || result.status === 'failed') {
        summary.failed += 1
        this.deps.notifications.add({
          type: 'update_error',
          title: 'Ошибка обновления',
          message: `Не удалось обновить ${entry.name}`,
          skillId: entry.id
        })
      } else if (result.status === 'skipped') {
        summary.skipped += 1
      } else {
        summary.ok += 1
        this.deps.notifications.add({
          type: 'update_success',
          title: 'Обновление установлено',
          message: `${entry.name} обновлён`,
          skillId: entry.id
        })
      }
    }

    logger.info('Обновление завершено', summary)
    return summary
  }
}
