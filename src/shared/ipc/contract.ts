import type { AppConfig } from '../domain/config'
import type { JobProgressEvent, JobLogEvent, JobDoneEvent, JobErrorEvent } from '../domain/job'
import type { Source, RawSkill, AddSourceInput, SourceStatus } from '../domain/source'
import type { CatalogEntry } from '../domain/skill'
import type {
  InstallRequest,
  InstallResult,
  ReconcileAgentsRequest,
  ReconcilePreview
} from '../domain/install'
import type { UpdateSettings } from '../domain/config'
import type { UpdateCheckResult } from '../domain/update'
import type { AppNotification } from '../domain/notification'
import type { SecurityAudit } from '../domain/audit'
import type { ParsedGitSource } from '../domain/gitSource'

/** Частичное обновление верхнеуровневых секций конфигурации (schemaVersion не меняется извне). */
export type ConfigPatch = Partial<Omit<AppConfig, 'schemaVersion'>>

/** Событие завершения (пере)индексации источника (для UI). */
export interface SourceIndexedEvent {
  sourceId: string
  status: SourceStatus
  skillCount: number
  error: string | null
}

export interface DeeplinkEvent {
  url: string
  parsed: ParsedGitSource | null
}

export type CatalogSort = 'name-asc' | 'name-desc' | 'update-first' | 'installs-desc'

export type CatalogStatusFilter = 'installed' | 'not_installed' | 'update_available'

/** Запрос к каталогу (поиск/фильтры/сортировка/пагинация). */
export interface CatalogQuery {
  text: string | null
  sourceIds: string[] | null
  /** Набор статус-фильтров (OR-семантика); null/пусто — без фильтра по статусу. */
  statuses: CatalogStatusFilter[] | null
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
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'manual-download'

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
    /**
     * Забирает и очищает буфер диплинков, накопленных до готовности renderer'а
     * (holodный старт по `skill://`). Renderer вызывает при монтировании.
     */
    consumePendingDeeplinks(): Promise<DeeplinkEvent[]>
    reset(): Promise<void>
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
    /** Нативное подтверждение (message + detail); true — пользователь подтвердил. */
    confirm(opts: { message: string; detail?: string; confirmLabel?: string }): Promise<boolean>
  }
  source: {
    list(): Promise<Source[]>
    add(input: AddSourceInput): Promise<Source>
    remove(id: string): Promise<void>
    setEnabled(id: string, enabled: boolean): Promise<Source>
    /** Запускает переиндексацию; возвращает jobId (null, если источник отключён/не найден). */
    refresh(id: string): Promise<string | null>
    listSkills(id: string): Promise<RawSkill[]>
    hideSkill(sourceId: string, skillName: string): Promise<void>
    restoreHiddenSkills(sourceId: string): Promise<void>
  }
  catalog: {
    query(query: CatalogQuery): Promise<CatalogPage>
    get(id: string): Promise<CatalogEntry | null>
    /** Пересобрать индекс из текущих данных источников + пересканировать установленные. */
    refreshIndex(): Promise<void>
    /** Аудит безопасности skill (skills.sh). null — неприменимо (не official). */
    audit(skillId: string): Promise<SecurityAudit | null>
    /** URL карточки skill на skills.sh (только official). null — неприменимо. */
    officialUrl(skillId: string): Promise<string | null>
    /** Отрендеренный HTML превью README.md/SKILL.md skill. null — файлов нет. */
    readme(skillId: string): Promise<string | null>
    /** Путь к общему каталогу установки .agents/skills/<name>. null — не установлен. */
    canonicalPath(skillId: string): Promise<string | null>
    /** Веб-URL git-репозитория skill (SSH→HTTPS). null — не git / не определён. */
    repoUrl(skillId: string): Promise<string | null>
  }
  install: {
    /** Запускает установку skill; возвращает jobId (результат — событие onInstallResult). */
    run(request: InstallRequest): Promise<string>
    /** Удаляет skill из всех агентов (симлинки + канон + запись lock); возвращает jobId. */
    uninstall(skillId: string): Promise<string>
    /** Реконсиляция симлинков при изменении набора агентов; возвращает jobId. */
    reconcileAgents(request: ReconcileAgentsRequest): Promise<string>
    /** Предпросмотр реконсиляции (link/unlink) без изменения ФС. */
    previewReconcile(request: ReconcileAgentsRequest): Promise<ReconcilePreview>
    /** Возвращает список id установленных агентов по наличию их глобального конфига */
    getInstalledAgents(): Promise<string[]>
  }
  /** Открытие внешних ресурсов средствами ОС. */
  shell: {
    /** Внешняя ссылка в системном браузере (только http/https). */
    openExternal(url: string): Promise<void>
    /** Открыть путь (файл/папку) в файловом менеджере ОС. */
    openPath(path: string): Promise<void>
    /** Открыть путь в VS Code (vscode://file). */
    openInEditor(path: string): Promise<void>
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
    onDeeplinkReceived(cb: (e: DeeplinkEvent) => void): Unsubscribe
    onGithubRateLimit(cb: () => void): Unsubscribe
  }
}
