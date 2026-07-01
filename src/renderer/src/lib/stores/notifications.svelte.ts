import type { AppNotification } from '@shared/domain/notification'
import { api } from '../api'

class NotificationsStore {
  items = $state<AppNotification[]>([])
  private unsubs: Array<() => void> = []
  private initialized = false

  get unread(): number {
    return this.items.filter((n) => !n.read).length
  }

  async load(): Promise<void> {
    this.items = await api.notifications.list()
  }

  init(): void {
    if (this.initialized) return
    this.initialized = true
    this.unsubs.push(
      api.events.onNotification((n) => {
        this.items = [n, ...this.items]
      })
    )
    void this.load()
  }

  destroy(): void {
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.initialized = false
  }

  async markAllRead(): Promise<void> {
    await api.notifications.markAllRead()
    await this.load()
  }

  async clear(): Promise<void> {
    await api.notifications.clear()
    this.items = []
  }
}

export const notifications = new NotificationsStore()
