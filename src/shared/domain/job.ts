import type { AppError } from './error'

/** Тип фоновой операции (для группировки/отображения). */
export type JobKind =
  | 'source.index'
  | 'source.refresh'
  | 'install'
  | 'install.reconcileAgents'
  | 'update.check'
  | 'update.run'

export type JobStatus = 'running' | 'done' | 'error' | 'cancelled'

export type LogStream = 'out' | 'err'

export interface JobProgressEvent {
  jobId: string
  kind: JobKind
  /** 0..100 или null, если прогресс неопределён. */
  percent: number | null
  message: string | null
}

export interface JobLogEvent {
  jobId: string
  stream: LogStream
  /** Пакет строк лога (буферизуется перед отправкой). */
  lines: string[]
}

export interface JobDoneEvent {
  jobId: string
  kind: JobKind
  status: Extract<JobStatus, 'done' | 'cancelled'>
}

export interface JobErrorEvent {
  jobId: string
  kind: JobKind
  error: AppError
}
