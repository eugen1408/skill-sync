import type { AppConfig } from '../domain/config'
import type { JobProgressEvent, JobLogEvent, JobDoneEvent, JobErrorEvent } from '../domain/job'
import type { Source, RawSkill, AddSourceInput, SourceStatus } from '../domain/source'
import type { CatalogEntry } from '../domain/skill'
import type { InstallRequest, InstallResult, ReconcileAgentsRequest } from '../domain/install'
import type { UpdateSettings } from '../domain/config'
import type { UpdateCheckResult } from '../domain/update'
import type { AppNotification } from '../domain/notification'

/** Частичное обновление верхнеуровневых секций конфигурации (schemaVersion не меняется извне). */
export type ConfigPatch = Partial<Omit<AppConfig, 'schemaVersion'>>

/** Событие завершения (пере)индексации источника (для UI). */
export interface SourceIndexedEvent {
  sourceId: string
  status: SourceStatus
  skillCount: number
  error: string | null
}

export type CatalogSort = 'name-asc' | 'name-desc' | 'update-first' | 'installs-desc'

export type CatalogStatusFilter = 'installed' | 'not_installed' | 'update_available'

/** Запрос к каталогу (поиск/фильтры/сортировка/пагинация). */
export interface CatalogQuery {
  text: string | null
  sourceIds: string[] | null
  status: CatalogStatusFilter | null
  sort: CatalogSort
  page: number
  pageSize: number
}

export interface CatalogPage {
  items: CatalogEntry[]
  total: number
  page: number
  pageSize: number
}

export type AppUpdateState =
  'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface AppUpdateStatus {
  state: AppUpdateState
  version: string | null
  percent: number | null
  error: string | null
}

export type Unsubscribe = () => void

/**
 * Форма `window.api`, экспонируемая preload.
 * Доменные пространства (sources, catalog, install, update, notifications)
 * добавляются в этот интерфейс по мере реализации Частей 2–6.
 */
export interface IpcApi {
  app: {
    getVersion(): Promise<string>
    checkForUpdates(): Promise<void>
    quitAndInstall(): void
  }
  config: {
    get(): Promise<AppConfig>
    update(patch: ConfigPatch): Promise<AppConfig>
  }
  jobs: {
    cancel(jobId: string): Promise<boolean>
  }
  dialog: {
    /** Нативный выбор каталога; возвращает путь или null при отмене. */
    selectDirectory(): Promise<string | null>
  }
  source: {
    list(): Promise<Source[]>
    add(input: AddSourceInput): Promise<Source>
    remove(id: string): Promise<void>
    setEnabled(id: string, enabled: boolean): Promise<Source>
    /** Запускает переиндексацию; возвращает jobId (null, если источник отключён/не найден). */
    refresh(id: string): Promise<string | null>
    listSkills(id: string): Promise<RawSkill[]>
  }
  catalog: {
    query(query: CatalogQuery): Promise<CatalogPage>
    get(id: string): Promise<CatalogEntry | null>
    /** Пересобрать индекс из текущих данных источников + пересканировать установленные. */
    refreshIndex(): Promise<void>
  }
  install: {
    /** Запускает установку skill; возвращает jobId (результат — событие onInstallResult). */
    run(request: InstallRequest): Promise<string>
    /** Реконсиляция симлинков при изменении набора агентов; возвращает jobId. */
    reconcileAgents(request: ReconcileAgentsRequest): Promise<string>
  }
  update: {
    checkAll(): Promise<string>
    checkOne(skillId: string): Promise<string>
    runOne(skillId: string): Promise<string>
    runAll(): Promise<string>
    getSettings(): Promise<UpdateSettings>
    setSettings(patch: Partial<UpdateSettings>): Promise<UpdateSettings>
  }
  notifications: {
    list(): Promise<AppNotification[]>
    markRead(id: string): Promise<void>
    markAllRead(): Promise<void>
    clear(): Promise<void>
  }
  /** Секреты в OS keychain (safeStorage). Значения наружу не отдаются — только запись/проверка. */
  secrets: {
    available(): Promise<boolean>
    has(key: string): Promise<boolean>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
  }
  events: {
    onJobProgress(cb: (e: JobProgressEvent) => void): Unsubscribe
    onJobLog(cb: (e: JobLogEvent) => void): Unsubscribe
    onJobDone(cb: (e: JobDoneEvent) => void): Unsubscribe
    onJobError(cb: (e: JobErrorEvent) => void): Unsubscribe
    onAppUpdateStatus(cb: (e: AppUpdateStatus) => void): Unsubscribe
    onSourceIndexed(cb: (e: SourceIndexedEvent) => void): Unsubscribe
    onCatalogUpdated(cb: () => void): Unsubscribe
    onInstallResult(cb: (e: InstallResult) => void): Unsubscribe
    onUpdateChecked(cb: (e: UpdateCheckResult) => void): Unsubscribe
    onNotification(cb: (e: AppNotification) => void): Unsubscribe
  }
}
