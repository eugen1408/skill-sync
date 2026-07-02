import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toasts } from '../src/renderer/src/lib/stores/toasts.svelte'

beforeEach(() => {
  toasts.items = []
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('toasts store', () => {
  it('push добавляет тост с указанным типом', () => {
    toasts.push('привет', 'error')
    expect(toasts.items).toHaveLength(1)
    expect(toasts.items[0]).toMatchObject({ message: 'привет', kind: 'error' })
  })

  it('тост авто-исчезает через 5 секунд', () => {
    toasts.push('исчезну')
    expect(toasts.items).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(toasts.items).toHaveLength(0)
  })

  it('dismiss убирает конкретный тост', () => {
    toasts.push('a')
    toasts.push('b')
    const id = toasts.items[0].id
    toasts.dismiss(id)
    expect(toasts.items.map((t) => t.message)).toEqual(['b'])
  })

  it('guard: успех не создаёт тост', async () => {
    await toasts.guard(async () => {}, 'ошибка')
    expect(toasts.items).toHaveLength(0)
  })

  it('guard: ошибка создаёт error-тост с сообщением', async () => {
    await toasts.guard(async () => {
      throw new Error('bang')
    }, 'Не удалось')
    expect(toasts.items).toHaveLength(1)
    expect(toasts.items[0].kind).toBe('error')
    expect(toasts.items[0].message).toContain('Не удалось')
    expect(toasts.items[0].message).toContain('bang')
  })
})
