import { describe, it, expect } from 'vitest'
import { JobRunner, type JobEmitter } from '../src/main/jobs/JobRunner'
import type {
  JobProgressEvent,
  JobLogEvent,
  JobDoneEvent,
  JobErrorEvent
} from '../src/shared/domain/job'

interface Captured {
  progress: JobProgressEvent[]
  log: JobLogEvent[]
  done: JobDoneEvent[]
  error: JobErrorEvent[]
}

function makeCapture(): { emitter: JobEmitter; events: Captured } {
  const events: Captured = { progress: [], log: [], done: [], error: [] }
  const emitter: JobEmitter = {
    progress: (e) => events.progress.push(e),
    log: (e) => events.log.push(e),
    done: (e) => events.done.push(e),
    error: (e) => events.error.push(e)
  }
  return { emitter, events }
}

describe('JobRunner', () => {
  it('стримит прогресс, буферизует лог и завершается done', async () => {
    const { emitter, events } = makeCapture()
    const runner = new JobRunner(emitter, { flushIntervalMs: 10 })

    const { jobId, promise } = runner.start('install', async (ctx) => {
      ctx.progress(50, 'половина')
      ctx.log('out', 'строка 1')
      ctx.log('out', 'строка 2')
      return 'ok'
    })

    const result = await promise
    expect(result).toBe('ok')
    expect(events.progress[0]).toMatchObject({ jobId, percent: 50, message: 'половина' })
    // Лог флашится при завершении задачи.
    const allLines = events.log.flatMap((e) => e.lines)
    expect(allLines).toEqual(['строка 1', 'строка 2'])
    expect(events.done).toHaveLength(1)
    expect(events.done[0]).toMatchObject({ jobId, status: 'done' })
    expect(events.error).toHaveLength(0)
  })

  it('отмена задачи приводит к статусу cancelled', async () => {
    const { emitter, events } = makeCapture()
    const runner = new JobRunner(emitter)

    const { jobId, promise } = runner.start('update.check', async (ctx) => {
      await new Promise<void>((_resolve, reject) => {
        ctx.signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
      return 'never'
    })

    const cancelled = runner.cancel(jobId)
    expect(cancelled).toBe(true)

    const result = await promise
    expect(result).toBeNull()
    expect(events.done[0]).toMatchObject({ jobId, status: 'cancelled' })
  })

  it('ошибка исполнителя эмитит error-событие', async () => {
    const { emitter, events } = makeCapture()
    const runner = new JobRunner(emitter)

    const { promise } = runner.start('install', async () => {
      throw new Error('bang')
    })

    const result = await promise
    expect(result).toBeNull()
    expect(events.error).toHaveLength(1)
    expect(events.error[0].error.message).toContain('bang')
  })

  it('cancel неизвестного jobId возвращает false', () => {
    const { emitter } = makeCapture()
    const runner = new JobRunner(emitter)
    expect(runner.cancel('нет-такого')).toBe(false)
  })
})
