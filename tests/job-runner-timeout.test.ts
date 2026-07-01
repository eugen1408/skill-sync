import { describe, it, expect } from 'vitest'
import { JobRunner, type JobEmitter } from '../src/main/jobs/JobRunner'
import type { JobErrorEvent, JobDoneEvent } from '../src/shared/domain/job'

describe('JobRunner — таймаут бездействия', () => {
  it('прерывает задачу без активности и эмитит error про таймаут', async () => {
    const errors: JobErrorEvent[] = []
    const done: JobDoneEvent[] = []
    const emitter: JobEmitter = {
      progress() {},
      log() {},
      done: (e) => done.push(e),
      error: (e) => errors.push(e)
    }
    const runner = new JobRunner(emitter, { timeoutMs: 30, flushIntervalMs: 5 })

    const { promise } = runner.start(
      'install',
      (ctx) =>
        new Promise<void>((_resolve, reject) => {
          // Не сообщаем прогресс → срабатывает idle-таймаут, который абортит сигнал.
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )

    const result = await promise
    expect(result).toBeNull()
    expect(done).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].error.message).toMatch(/таймаут/i)
  })
})
