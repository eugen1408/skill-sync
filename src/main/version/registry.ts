import type { VersionStrategy } from './types'

interface Entry {
  strategy: VersionStrategy
  priority: number
}

/**
 * Реестр стратегий версий с приоритетом. Меньшее число приоритета — раньше в очереди.
 * Новая стратегия добавляется регистрацией без изменения VersionResolver и потребителей.
 */
export class StrategyRegistry {
  private readonly entries: Entry[] = []

  register(strategy: VersionStrategy, priority: number): this {
    this.entries.push({ strategy, priority })
    this.entries.sort((a, b) => a.priority - b.priority)
    return this
  }

  ordered(): VersionStrategy[] {
    return this.entries.map((e) => e.strategy)
  }
}
