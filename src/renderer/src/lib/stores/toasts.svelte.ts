export interface Toast {
  id: number
  message: string
  kind: 'error' | 'info'
}

class ToastsStore {
  items = $state<Toast[]>([])
  private seq = 0

  push(message: string, kind: Toast['kind'] = 'info'): void {
    const id = ++this.seq
    this.items = [...this.items, { id, message, kind }]
    setTimeout(() => this.dismiss(id), 5000)
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id)
  }

  /** Выполняет действие и показывает toast при ошибке (для fire-and-forget IPC-вызовов). */
  async guard(fn: () => Promise<unknown>, errorMessage: string): Promise<void> {
    try {
      await fn()
    } catch (err) {
      this.push(`${errorMessage}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }
}

export const toasts = new ToastsStore()
