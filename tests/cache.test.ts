import { describe, it, expect, vi, afterEach } from 'vitest'
import { Cache } from '../src/main/sources/cache'

afterEach(() => vi.useRealTimers())

describe('Cache', () => {
  it('хранит и отдаёт значение по ключу', () => {
    const c = new Cache<number>({ ttlMs: 1000, maxEntries: 10 })
    c.set('a', 1)
    expect(c.get('a')).toBe(1)
    expect(c.get('missing')).toBeNull()
  })

  it('вытесняет самый старый при превышении maxEntries', () => {
    const c = new Cache<number>({ ttlMs: 1000, maxEntries: 2 })
    c.set('a', 1)
    c.set('b', 2)
    c.set('c', 3) // вытесняет 'a'
    expect(c.get('a')).toBeNull()
    expect(c.get('b')).toBe(2)
    expect(c.get('c')).toBe(3)
  })

  it('истекает по TTL', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const c = new Cache<number>({ ttlMs: 1000, maxEntries: 10 })
    c.set('a', 1)
    vi.setSystemTime(1500)
    expect(c.get('a')).toBeNull()
  })

  it('clear очищает кэш', () => {
    const c = new Cache<number>({ ttlMs: 1000, maxEntries: 10 })
    c.set('a', 1)
    c.clear()
    expect(c.get('a')).toBeNull()
  })
})
