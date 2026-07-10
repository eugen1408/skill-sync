/**
 * Сериализация асинхронных операций по ключу: вызовы с одним ключом выполняются строго
 * последовательно (в порядке поступления), с разными ключами — параллельно. Ошибка одной
 * операции не срывает очередь — следующий стартует после завершения предыдущей (успех/ошибка).
 *
 * Применение: несколько skills из одного git-репозитория делят рабочий каталог клона;
 * параллельные `git fetch`/`reset` конфликтуют по `.git/index.lock`. Сериализация по source.id
 * устраняет конфликт, сохраняя параллелизм между разными источниками.
 */
export class KeyedQueue {
  private readonly chains = new Map<string, Promise<unknown>>()

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key)
    const next = (async () => {
      if (prev) await prev.catch(() => {})
      return task()
    })()
    this.chains.set(key, next)
    // Снимаем ссылку, когда очередь по ключу опустела (никто не встал следом) — без влияния
    // на результат, возвращаемый вызывающему.
    void next
      .catch(() => {})
      .finally(() => {
        if (this.chains.get(key) === next) this.chains.delete(key)
      })
    return next
  }

  /** Есть ли активная цепочка по ключу (для тестов/диагностики). */
  has(key: string): boolean {
    return this.chains.has(key)
  }
}
