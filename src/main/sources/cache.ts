export interface CacheOptions {
  ttlMs: number
  maxEntries: number
}

interface Entry<T> {
  value: T
  expiresAt: number
}

/**
 * TTL-кэш с ограничением по числу записей и LRU-вытеснением (порт из reference-installer).
 * Используется официальным адаптером для кэширования ответов /api/search между индексациями.
 */
export class Cache<T> {
  private readonly map = new Map<string, Entry<T>>()

  constructor(private readonly opts: CacheOptions) {}

  get(key: string): T | null {
    const entry = this.map.get(key)
    if (!entry) return null
    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key)
      return null
    }
    // LRU: перемещаем в конец.
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, { value, expiresAt: Date.now() + this.opts.ttlMs })
    while (this.map.size > this.opts.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  clear(): void {
    this.map.clear()
  }
}
