import { randomUUID } from 'node:crypto'
import type {
  JobKind,
  JobProgressEvent,
  JobLogEvent,
  JobDoneEvent,
  JobErrorEvent,
  LogStream
} from '@shared/domain/job'
import type { AppError } from '@shared/domain/error'
import { makeAppError } from '@shared/domain/error'

/** Контекст, передаваемый исполнителю задачи. */
export interface JobContext {
  readonly jobId: string
  readonly signal: AbortSignal
  progress(percent: number | null, message?: string): void
  log(stream: LogStream, text: string): void
  /** Бросает CancellationError, если задача отменена/просрочена. */
  throwIfCancelled(): void
}

export type JobExecutor<T> = (ctx: JobContext) => Promise<T>

/** Приёмник событий задач (main подключает его к webContents.send). */
export interface JobEmitter {
  progress(e: JobProgressEvent): void
  log(e: JobLogEvent): void
  done(e: JobDoneEvent): void
  error(e: JobErrorEvent): void
}

export interface JobRunnerOptions {
  /** Таймаут бездействия (нет progress/log), мс. */
  timeoutMs?: number
  /** Интервал флаша буфера лог-строк, мс. */
  flushIntervalMs?: number
}

class CancellationError extends Error {
  constructor(readonly reason: 'cancelled' | 'timeout') {
    super(reason)
    this.name = 'CancellationError'
  }
}

interface RunningJob {
  controller: AbortController
  reason: 'cancelled' | 'timeout' | null
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'cause' in value
  )
}

/**
 * Реестр асинхронных задач: запуск, отмена, стрим прогресса и лога,
 * таймаут по бездействию, буферизация лог-строк.
 */
export class JobRunner {
  private readonly emitter: JobEmitter
  private readonly timeoutMs: number
  private readonly flushIntervalMs: number
  private readonly jobs = new Map<string, RunningJob>()

  constructor(emitter: JobEmitter, options: JobRunnerOptions = {}) {
    this.emitter = emitter
    this.timeoutMs = options.timeoutMs ?? 90_000
    this.flushIntervalMs = options.flushIntervalMs ?? 100
  }

  /** Запускает задачу; возвращает её id и промис результата (null при ошибке/отмене). */
  start<T>(kind: JobKind, executor: JobExecutor<T>): { jobId: string; promise: Promise<T | null> } {
    const jobId = randomUUID()
    const controller = new AbortController()
    const job: RunningJob = { controller, reason: null }
    this.jobs.set(jobId, job)

    const buffers: Record<LogStream, string[]> = { out: [], err: [] }
    let flushTimer: ReturnType<typeof setInterval> | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const resetIdle = (): void => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        job.reason = 'timeout'
        controller.abort()
      }, this.timeoutMs)
    }

    const flush = (): void => {
      for (const stream of ['out', 'err'] as LogStream[]) {
        if (buffers[stream].length > 0) {
          const lines = buffers[stream]
          buffers[stream] = []
          this.emitter.log({ jobId, stream, lines })
        }
      }
    }

    const ctx: JobContext = {
      jobId,
      signal: controller.signal,
      progress: (percent, message) => {
        resetIdle()
        this.emitter.progress({ jobId, kind, percent, message: message ?? null })
      },
      log: (stream, text) => {
        resetIdle()
        buffers[stream].push(text)
      },
      throwIfCancelled: () => {
        if (controller.signal.aborted) throw new CancellationError(job.reason ?? 'cancelled')
      }
    }

    resetIdle()
    flushTimer = setInterval(flush, this.flushIntervalMs)

    const cleanup = (): void => {
      if (flushTimer) clearInterval(flushTimer)
      if (idleTimer) clearTimeout(idleTimer)
      flush()
      this.jobs.delete(jobId)
    }

    const promise = executor(ctx)
      .then((result) => {
        cleanup()
        this.emitter.done({ jobId, kind, status: 'done' })
        return result
      })
      .catch((err: unknown) => {
        cleanup()
        const timedOut =
          job.reason === 'timeout' || (err instanceof CancellationError && err.reason === 'timeout')
        if (timedOut) {
          this.emitter.error({
            jobId,
            kind,
            error: makeAppError('INTERNAL', 'Операция прервана по таймауту бездействия')
          })
          return null
        }
        if (job.reason === 'cancelled') {
          this.emitter.done({ jobId, kind, status: 'cancelled' })
          return null
        }
        this.emitter.error({
          jobId,
          kind,
          error: isAppError(err)
            ? err
            : makeAppError('INTERNAL', err instanceof Error ? err.message : 'Ошибка операции', err)
        })
        return null
      })

    return { jobId, promise }
  }

  /** Отменяет задачу по id. */
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false
    job.reason = 'cancelled'
    job.controller.abort()
    return true
  }

  cancelAll(): void {
    for (const id of [...this.jobs.keys()]) this.cancel(id)
  }
}
