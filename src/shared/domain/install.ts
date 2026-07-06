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
}

/** Предпросмотр реконсиляции: что будет создано/удалено до применения (follow-up [13]). */
export interface ReconcilePreview {
  addedAgents: string[]
  removedAgents: string[]
  skillCount: number
  ops: ReconcileOp[]
}
