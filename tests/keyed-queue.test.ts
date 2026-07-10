import { describe, it, expect } from 'vitest'
import { KeyedQueue } from '../src/main/util/keyedQueue'

/** Управляемый «замок» для проверки перекрытия во времени. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('KeyedQueue', () => {
  it('операции с одним ключом не перекрываются во времени', async () => {
    const q = new KeyedQueue()
    let active = 0
    let maxActive = 0
    const gate = deferred<void>()

    const task = (): Promise<void> =>
      q.run('same', async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await gate.promise
        active--
      })

    const p1 = task()
    const p2 = task()
    // Пока первый держит gate, второй не должен был стартовать.
    await Promise.resolve()
    expect(active).toBe(1)
    gate.resolve()
    await Promise.all([p1, p2])
    expect(maxActive).toBe(1)
  })

  it('операции с разными ключами идут параллельно', async () => {
    const q = new KeyedQueue()
    let active = 0
    let maxActive = 0
    const gate = deferred<void>()

    const task = (key: string): Promise<void> =>
      q.run(key, async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await gate.promise
        active--
      })

    const p1 = task('a')
    const p2 = task('b')
    await Promise.resolve()
    expect(active).toBe(2)
    gate.resolve()
    await Promise.all([p1, p2])
    expect(maxActive).toBe(2)
  })

  it('порядок выполнения — по поступлению; каждый вызывающий получает свой результат', async () => {
    const q = new KeyedQueue()
    const order: number[] = []
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        q.run('k', async () => {
          order.push(n)
          return n * 10
        })
      )
    )
    expect(order).toEqual([1, 2, 3])
    expect(results).toEqual([10, 20, 30])
  })

  it('ошибка одной операции не срывает очередь и не глотается у вызывающего', async () => {
    const q = new KeyedQueue()
    const seen: string[] = []
    const failing = q.run('k', async () => {
      seen.push('fail')
      throw new Error('boom')
    })
    const following = q.run('k', async () => {
      seen.push('ok')
      return 'done'
    })
    await expect(failing).rejects.toThrow('boom')
    await expect(following).resolves.toBe('done')
    expect(seen).toEqual(['fail', 'ok'])
  })

  it('очередь по ключу очищается после завершения всех операций', async () => {
    const q = new KeyedQueue()
    await q.run('k', async () => 1)
    // Снятие ссылки выполняется в хвостовом микротаске после разрешения run — даём ему отработать.
    await new Promise((r) => setTimeout(r, 0))
    expect(q.has('k')).toBe(false)
  })
})
