import type { AppNotification } from '@shared/domain/notification'
import { api } from '../api'

class NotificationsStore {
  items = $state<AppNotification[]>([])

  get unread(): number {
    return this.items.filter((n) => !n.read).length
  }

  async load(): Promise<void> {
    this.items = await api.notifications.list()
  }

  init(): void {
    api.events.onNotification((n) => {
      this.items = [n, ...this.items]
    })
    void this.load()
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
