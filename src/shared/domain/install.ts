import type { AppError } from './error'
import type { InstallScope } from './config'

export type InstallStatus = 'ok' | 'skipped' | 'failed'

/** Запрос установки skill (мультиагент — эпик Q-01). */
export interface InstallRequest {
  skillId: string
  sourceId: string
  sourceRef: string
  targetAgents: string[]
  scope: InstallScope
  force: boolean
}

/** Исход установки для одного агента. */
export interface AgentInstallOutcome {
  agent: string
  status: InstallStatus
  installPath: string | null
}

/** Итог установки skill (агрегат по агентам). */
export interface InstallResult {
  skillId: string
  status: InstallStatus
  installedVersion: string | null
  wasUpdate?: boolean
  outcomes: AgentInstallOutcome[]
  error: AppError | null
}

/** Результат проверки работоспособности CLI (`skills --version`, follow-up UI). */
export interface CliCheckResult {
  ok: boolean
  /** Версия/вывод при успехе. */
  version: string
  /** Текст ошибки при неуспехе. */
  error: string
}

/** Запрос реконсиляции симлинков при изменении набора агентов (эпик Q-01). */
export interface ReconcileAgentsRequest {
  previousAgents: string[]
  nextAgents: string[]
  scope: InstallScope
}

export interface ReconcileSummary {
  added: string[]
  removed: string[]
  linked: number
  unlinked: number
  skipped: number
}

/** Одна планируемая операция реконсиляции (для предпросмотра). */
export interface ReconcileOp {
  agent: string
  skill: string
  action: 'link' | 'unlink'
  /** Путь-источник операции (для link — канон; для unlink — снимаемый симлинк). */
  fromPath: string
  /** Путь-назначение (для link — каталог агента; для unlink — null). */
  toPath: string | null
  /**
   * Затрагивается ли реальная папка (а не только симлинк).
   * Реконсиляция всегда работает с симлинками агентов и не трогает канон, поэтому false;
   * поле оставлено для симметрии с предпросмотром установки (follow-up B1/B2).
   */
  touchesRealFolder: boolean
}

/** Предпросмотр реконсиляции: что будет создано/удалено до применения (follow-up [13]). */
export interface ReconcilePreview {
  addedAgents: string[]
  removedAgents: string[]
  skillCount: number
  ops: ReconcileOp[]
}

/** Одна планируемая операция установки (для предпросмотра структуры файлов, follow-up B1). */
export interface InstallOp {
  /** Агент, для которого создаётся ссылка; null — операция с каноническим каталогом. */
  agent: string | null
  action: 'copy-canonical' | 'create-symlink' | 'replace-folder'
  /** Путь, который будет создан/изменён. */
  path: string
  /** Цель симлинка (канонический путь) — для операций со ссылками. */
  target: string | null
  /** true — на месте реальной папки появится симлинк (важно для реальных пользовательских каталогов). */
  replacesRealFolder: boolean
}

/**
 * Предпросмотр установки/переустановки: какие пути станут каноном/симлинками и будет ли
 * реальная папка заменена на ссылку (follow-up B1). Считается без изменения ФС.
 */
export interface InstallPreview {
  skillName: string
  canonicalPath: string
  ops: InstallOp[]
  /** Есть ли операции, заменяющие реальную папку симлинком (требуют явного подтверждения). */
  replacesRealFolders: boolean
}
