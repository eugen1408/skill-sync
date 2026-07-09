import { randomUUID } from 'node:crypto'
import type { Source, RawSkill, SourceType } from '@shared/domain/source'
import { OFFICIAL_SOURCE_ID } from '@shared/domain/source'
import type { AppError } from '@shared/domain/error'
import { makeAppError } from '@shared/domain/error'
import type { ConfigStore } from '../config/ConfigStore'
import { resolveLocale, mt } from '../i18n'
import type { JobRunner } from '../jobs/JobRunner'
import { logger } from '../logger'
import type { SourceAdapter, AddSourceInput } from './types'
import { LocalWatcher } from './localWatcher'

/** Результат индексации источника (in-process уведомление для Registry — Часть 4). */
export interface IndexResult {
  source: Source
  skills: RawSkill[]
  error: AppError | null
}

function basename(p: string): string {
  return (
    p
      .replace(/[/\\]+$/, '')
      .split(/[/\\]/)
      .pop() ?? p
  )
}

function defaultName(input: AddSourceInput): string {
  if (input.name.trim()) return input.name.trim()
  if (input.type === 'local') {
    return input.config.localPath 
      ? basename(input.config.localPath) 
      : mt(resolveLocale('system'), 'source.defaultLocalName' as any)
  }
  if (input.type === 'git') {
    return input.config.url 
      ? basename(input.config.url.replace(/\.git$/i, '')) 
      : mt(resolveLocale('system'), 'source.defaultGitName' as any)
  }
  return 'skills.sh'
}

/**
 * Управление источниками: CRUD, вкл/выкл, переиндексация, watch локальных каталогов.
 * Результаты индексации хранит в памяти и рассылает подписчикам (Registry) и через IPC.
 */
export class SourceManager {
  private readonly skillsCache = new Map<string, RawSkill[]>()
  private readonly listeners = new Set<(r: IndexResult) => void>()
  private readonly watcher: LocalWatcher

  constructor(
    private readonly configStore: ConfigStore,
    private readonly jobRunner: JobRunner,
    private readonly adapters: Map<SourceType, SourceAdapter>
  ) {
    this.watcher = new LocalWatcher((sourceId) => {
      logger.info(`Локальный источник изменён, переиндексация: ${sourceId}`)
      this.refresh(sourceId)
    })
  }

  /** Запускает watch для включённых локальных источников с watch=true. */
  init(): void {
    for (const source of this.list()) {
      this.syncWatch(source)
    }
  }

  /**
   * Гарантирует наличие единственного официального источника skills.sh (добавляется по умолчанию).
   * Возвращает true, если источник был только что создан (нужна первичная индексация).
   */
  ensureDefaultOfficial(): boolean {
    if (this.list().some((s) => s.type === 'official')) return false
    const source: Source = {
      id: OFFICIAL_SOURCE_ID,
      type: 'official',
      name: 'skills.sh',
      enabled: true,
      config: {
        url: null,
        ref: null,
        subpath: null,
        authMode: null,
        localPath: null,
        watch: false
      },
      lastIndexedAt: null,
      status: 'ok',
      lastError: null
    }
    this.configStore.update({ sources: [source, ...this.list()] })
    return true
  }

  onIndexed(cb: (r: IndexResult) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  list(): Source[] {
    return this.configStore.get().sources
  }

  get(id: string): Source | undefined {
    return this.list().find((s) => s.id === id)
  }

  hasIndexed(id: string): boolean {
    return this.skillsCache.has(id)
  }

  listSkills(id: string): RawSkill[] {
    return this.skillsCache.get(id) ?? []
  }

  async add(input: AddSourceInput): Promise<Source> {
    if (input.type === 'official') {
      throw new Error('Источник skills.sh уже добавлен по умолчанию и не дублируется')
    }
    const adapter = this.requireAdapter(input.type)
    const source: Source = {
      id: randomUUID(),
      type: input.type,
      name: defaultName(input),
      enabled: true,
      config: {
        url: input.config.url ?? null,
        ref: input.config.ref ?? null,
        subpath: input.config.subpath ?? null,
        authMode: input.config.authMode ?? null,
        localPath: input.config.localPath ?? null,
        watch: input.config.watch ?? input.type === 'local'
      },
      lastIndexedAt: null,
      status: 'ok',
      lastError: null
    }

    this.assertNotDuplicate(source)
    try {
      await adapter.validate(source)
    } catch (err) {
      const message = isAppError(err) ? err.message : (err as Error).message
      throw new Error(message)
    }

    const sources = [...this.list(), source]
    this.configStore.update({ sources })
    this.syncWatch(source)
    return source
  }


  /** Запускает переиндексацию всех включённых неофициальных источников (Git/Local). */
  refreshAllNonOfficial(): void {
    for (const source of this.list()) {
      if (source.enabled && source.type !== 'official') {
        this.refresh(source.id)
      }
    }
  }

  remove(id: string): void {
    if (id === OFFICIAL_SOURCE_ID) {
      throw new Error('Источник skills.sh нельзя удалить (можно отключить)')
    }
    this.watcher.unwatch(id)
    this.skillsCache.delete(id)
    this.configStore.update({ sources: this.list().filter((s) => s.id !== id) })
  }

  setEnabled(id: string, enabled: boolean): Source {
    const source = this.updateSource(id, (s) => ({
      ...s,
      enabled,
      status: enabled ? 'ok' : 'disabled'
    }))
    this.syncWatch(source)
    return source
  }

  hideSkill(id: string, skillName: string): Source {
    return this.updateSource(id, (s) => ({
      ...s,
      config: {
        ...s.config,
        // Дедуп: повторное скрытие того же skill не должно плодить дубликаты.
        hiddenSkills: [...new Set([...(s.config.hiddenSkills ?? []), skillName])]
      }
    }))
  }

  restoreHiddenSkills(id: string): Source {
    return this.updateSource(id, (s) => ({
      ...s,
      config: {
        ...s.config,
        hiddenSkills: []
      }
    }))
  }

  /** Запускает переиндексацию источника; возвращает jobId (результат — через onIndexed/IPC). */
  refresh(id: string): string | null {
    const source = this.get(id)
    if (!source || !source.enabled) return null
    const adapter = this.requireAdapter(source.type)
    this.updateSource(id, (s) => ({ ...s, status: 'indexing', lastError: null }))

    const { jobId, promise } = this.jobRunner.start(
      source.type === 'official' || source.type === 'git' ? 'source.refresh' : 'source.index',
      async (ctx) => {
        try {
          return await adapter.listSkills(source, ctx)
        } catch (err: any) {
          const msg = err?.message || String(err)
          if (err && typeof err === 'object' && 'code' in err) {
            throw { ...err, message: `[${source.name}] ${msg}` }
          }
          throw new Error(`[${source.name}] ${msg}`)
        }
      }
    )

    void promise.then((skills) => {
      if (skills === null) {
        // Задача завершилась ошибкой/отменой — JobRunner уже эмитил job:error.
        const failed = this.updateSource(id, (s) => ({
          ...s,
          status: 'error',
          lastError: mt(resolveLocale(this.configStore.get().ui.language), 'source.indexingNotFinished' as any)
        }))
        this.emitIndexed({
          source: failed,
          skills: [],
          error: makeAppError('SOURCE_UNAVAILABLE', mt(resolveLocale(this.configStore.get().ui.language), 'source.indexingNotFinished' as any))
        })
        return
      }
      this.skillsCache.set(id, skills)
      const ok = this.updateSource(id, (s) => ({
        ...s,
        status: 'ok',
        lastError: null,
        lastIndexedAt: new Date().toISOString()
      }))
      this.emitIndexed({ source: ok, skills, error: null })
    })

    return jobId
  }

  dispose(): void {
    this.watcher.unwatchAll()
  }

  // -- внутреннее --

  private emitIndexed(result: IndexResult): void {
    for (const cb of this.listeners) {
      try {
        cb(result)
      } catch (err) {
        logger.error('Подписчик onIndexed бросил ошибку', err)
      }
    }
  }

  private syncWatch(source: Source): void {
    const adapter = this.adapters.get(source.type)
    const shouldWatch =
      source.enabled &&
      adapter?.supportsWatch === true &&
      source.config.watch &&
      source.config.localPath
    if (shouldWatch) {
      this.watcher.watchSource(source.id, source.config.localPath!)
    } else {
      this.watcher.unwatch(source.id)
    }
  }

  private updateSource(id: string, patch: (s: Source) => Source): Source {
    const sources = this.list()
    const index = sources.findIndex((s) => s.id === id)
    if (index === -1) throw new Error(`Источник ${id} не найден`)
    const updated = patch(sources[index])
    sources[index] = updated
    this.configStore.update({ sources })
    return updated
  }

  private requireAdapter(type: SourceType): SourceAdapter {
    const adapter = this.adapters.get(type)
    if (!adapter) throw new Error(`Нет адаптера для источника типа ${type}`)
    return adapter
  }

  private assertNotDuplicate(candidate: Source): void {
    const dup = this.list().some((s) => {
      if (s.type !== candidate.type) return false
      if (s.type === 'local') return s.config.localPath === candidate.config.localPath
      if (s.type === 'git')
        return s.config.url === candidate.config.url && s.config.ref === candidate.config.ref
      return s.config.url === candidate.config.url
    })
    if (dup) throw new Error('Такой источник уже подключён')
  }
}

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
}
