import { watch, type FSWatcher } from 'chokidar'

/**
 * Наблюдает за локальными каталогами источников и с дебаунсом сообщает об изменениях
 * (Часть 6 инициирует переиндексацию по этому сигналу).
 */
export class LocalWatcher {
  private readonly watchers = new Map<string, FSWatcher>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly onChange: (sourceId: string) => void,
    private readonly debounceMs = 800
  ) {}

  watchSource(sourceId: string, path: string): void {
    this.unwatch(sourceId)
    const watcher = watch(path, {
      ignoreInitial: true,
      ignored: (p: string) => /(^|[/\\])(\.git|node_modules)([/\\]|$)/.test(p),
      depth: 8
    })
    const trigger = (): void => this.schedule(sourceId)
    watcher.on('add', trigger).on('change', trigger).on('unlink', trigger).on('addDir', trigger)
    this.watchers.set(sourceId, watcher)
  }

  private schedule(sourceId: string): void {
    const existing = this.timers.get(sourceId)
    if (existing) clearTimeout(existing)
    this.timers.set(
      sourceId,
      setTimeout(() => {
        this.timers.delete(sourceId)
        this.onChange(sourceId)
      }, this.debounceMs)
    )
  }

  unwatch(sourceId: string): void {
    const timer = this.timers.get(sourceId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(sourceId)
    }
    const watcher = this.watchers.get(sourceId)
    if (watcher) {
      void watcher.close()
      this.watchers.delete(sourceId)
    }
  }

  unwatchAll(): void {
    for (const id of [...this.watchers.keys()]) this.unwatch(id)
  }
}
