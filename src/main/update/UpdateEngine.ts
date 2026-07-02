import type { CatalogEntry } from '@shared/domain/skill'
import type { UpdateSettings } from '@shared/domain/config'
import type { UpdateCheckResult, UpdateCheckEntry, UpdateRunSummary } from '@shared/domain/update'
import type { InstallRequest } from '@shared/domain/install'
import type { JobContext } from '../jobs/JobRunner'
import type { JobRunner } from '../jobs/JobRunner'
import type { SourceManager, GitCache } from '../sources'
import type { OfficialCatalog } from '../sources/officialCatalog'
import type { SkillRegistry } from '../registry'
import type { InstallerService } from '../installer'
import type { ConfigStore } from '../config/ConfigStore'
import type { VersionResolver } from '../version'
import { findLockEntry } from '../version'
import type { NotificationCenter } from '../notifications/NotificationCenter'
import { logger } from '../logger'
import { mapWithConcurrency } from '../util/pool'
import { resolveConcurrency } from '../util/concurrency'
import { buildResolveContext } from './resolveContext'

export interface UpdateEngineDeps {
  jobRunner: JobRunner
  sourceManager: SourceManager
  skillRegistry: SkillRegistry
  installer: InstallerService
  resolver: VersionResolver
  notifications: NotificationCenter
  configStore: ConfigStore
  gitCache: GitCache
  officialCatalog: OfficialCatalog
  onChecked: (result: UpdateCheckResult) => void
}

// Проверки версий IO-bound (сеть) — можно шире; установки запускают npx/git — уже.
// Оба масштабируются под CPU и переопределяются env-переменными (follow-up [18]).
const CHECK_CONCURRENCY = resolveConcurrency({
  envVar: 'SKILLS_CHECK_CONCURRENCY',
  min: 2,
  max: 8,
  fallback: 6
})
const RUN_CONCURRENCY = resolveConcurrency({
  envVar: 'SKILLS_INSTALL_CONCURRENCY',
  min: 1,
  max: 6,
  fallback: 4
})

/**
 * Проверка и применение обновлений skills. Режимы: вручную / при запуске / по расписанию /
 * при изменении локального источника. Оркеструет Version Resolver + Registry + Installer,
 * генерирует уведомления (FR8).
 */
export class UpdateEngine {
  private intervalTimer: ReturnType<typeof setInterval> | null = null
  private unsubIndexed: (() => void) | null = null

  constructor(private readonly deps: UpdateEngineDeps) {}

  /**
   * Запускает проверку при старте / расписание / реакцию на локальные изменения.
   * Проверка при запуске откладывается до готовности реестра (`ready`), иначе она
   * отработала бы по пустому набору установленных skills, оставив у всех статус «Неизвестно».
   */
  start(ready?: Promise<unknown>): void {
    this.reconfigure()
    this.unsubIndexed = this.deps.sourceManager.onIndexed((r) => {
      if (this.settings().watchLocalSources && r.source.type === 'local') {
        this.checkAll()
      }
    })
    if (this.settings().checkOnLaunch) {
      if (ready) void ready.then(() => this.checkAll())
      else this.checkAll()
    }
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
    const { jobId } = this.deps.jobRunner.start('update.run', async (ctx) => {
      const entry = this.deps.skillRegistry.get(skillId)
      return entry ? this.runEntries([entry], ctx) : { ok: 0, failed: 0, skipped: 0 }
    })
    return jobId
  }

  /** Обновление всех skills с доступным обновлением. */
  runAll(): string {
    const { jobId } = this.deps.jobRunner.start('update.run', async (ctx) => {
      const targets = this.installedEntries().filter((e) => e.hasUpdate)
      return this.runEntries(targets, ctx)
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
    let done = 0

    const raw = await mapWithConcurrency(entries, CHECK_CONCURRENCY, async (entry) => {
      if (ctx.signal.aborted) return null
      const result = await this.checkEntry(entry, checkedAt)
      done += 1
      ctx.progress(Math.round((done / Math.max(1, entries.length)) * 100), `Проверено ${done}`)
      return result
    })

    const results = raw.filter((r): r is UpdateCheckEntry => r !== null)
    const updatesAvailable = results.filter((r) => r.hasUpdate).length
    return { checkedAt, updatesAvailable, entries: results }
  }

  private async checkEntry(entry: CatalogEntry, checkedAt: string): Promise<UpdateCheckEntry> {
    const source = this.deps.sourceManager.get(entry.sourceId)
    const lockEntry = await findLockEntry(entry.name)
    // Для git-источника — путь существующего клона (без сети): включает path-scoped git log
    // и чтение CHANGELOG из клона вместо деградации к ls-remote HEAD (follow-up [6]).
    const gitLocalDir = source?.type === 'git' ? await this.deps.gitCache.existingDir(source) : null
    const info = await this.deps.resolver.resolve(
      buildResolveContext(entry, source, lockEntry, gitLocalDir)
    )
    this.deps.skillRegistry.applyVersion(entry.id, info, checkedAt)

    // Свап official→local (Q8-02): если версию official-записи определить не удалось,
    // а skills.sh определённо не подтверждает наличие репозитория — понижаем в local.
    if (info.unknown && entry.sourceType === 'official') {
      await this.maybeDemoteOfficial(entry)
    }

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

  /** Понижает official-запись в local, если skills.sh определённо не знает её репозиторий. */
  private async maybeDemoteOfficial(entry: CatalogEntry): Promise<void> {
    const ownerRepo = /^([^@\s]+\/[^@\s]+)@/.exec(entry.sourceRef)?.[1]
    if (!ownerRepo) return
    const published = await this.deps.officialCatalog.repoPublished(ownerRepo, entry.name)
    if (published === false) {
      logger.info(`Свап official→local: ${entry.name} не найден в skills.sh`)
      this.deps.skillRegistry.demoteToLocal(entry.id)
    }
  }

  private async runEntries(entries: CatalogEntry[], ctx: JobContext): Promise<UpdateRunSummary> {
    const config = this.deps.configStore.get().install
    let done = 0

    const outcomes = await mapWithConcurrency(entries, RUN_CONCURRENCY, async (entry) => {
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
      done += 1
      ctx.progress(
        Math.round((done / Math.max(1, entries.length)) * 100),
        `Обновлено ${done}/${entries.length}`
      )

      if (!result || result.status === 'failed') {
        this.deps.notifications.add({
          type: 'update_error',
          title: 'Ошибка обновления',
          message: `Не удалось обновить ${entry.name}`,
          skillId: entry.id
        })
        return 'failed' as const
      }
      if (result.status === 'skipped') return 'skipped' as const
      this.deps.notifications.add({
        type: 'update_success',
        title: 'Обновление установлено',
        message: `${entry.name} обновлён`,
        skillId: entry.id
      })
      return 'ok' as const
    })

    const summary: UpdateRunSummary = { ok: 0, failed: 0, skipped: 0 }
    for (const outcome of outcomes) summary[outcome] += 1
    logger.info('Обновление завершено', summary)
    return summary
  }
}
