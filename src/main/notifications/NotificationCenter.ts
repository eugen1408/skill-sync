import { randomUUID } from 'node:crypto'
import type { AppNotification, NotificationType } from '@shared/domain/notification'

export interface NotificationInput {
  type: NotificationType
  title: string
  message: string
  skillId?: string | null
  sourceId?: string | null
}

export interface NotificationCenterOptions {
  /** Рассылка в renderer (main подключает к webContents.send). */
  emit: (notification: AppNotification) => void
  /** Нативное OS-уведомление (main передаёт обёртку над electron Notification). */
  nativeNotify?: (notification: AppNotification) => void
  maxHistory?: number
}

/**
 * Центр уведомлений: история в памяти + рассылка в renderer + опциональное нативное
 * OS-уведомление (эпик Q-05). Дедуп по (type, skillId, dedupeKey) для update_available.
 */
export class NotificationCenter {
  private readonly items: AppNotification[] = []
  private readonly recentKeys = new Set<string>()
  private readonly maxHistory: number

  constructor(private readonly options: NotificationCenterOptions) {
    this.maxHistory = options.maxHistory ?? 500
  }

  /** Добавляет уведомление; `dedupeKey` подавляет повтор того же события. Возвращает null при дубле. */
  add(input: NotificationInput, dedupeKey?: string): AppNotification | null {
    if (dedupeKey) {
      const key = `${input.type}:${input.skillId ?? ''}:${dedupeKey}`
      if (this.recentKeys.has(key)) return null
      this.recentKeys.add(key)
    }

    const notification: AppNotification = {
      id: randomUUID(),
      type: input.type,
      title: input.title,
      message: input.message,
      skillId: input.skillId ?? null,
      sourceId: input.sourceId ?? null,
      createdAt: new Date().toISOString(),
      read: false
    }

    this.items.unshift(notification)
    if (this.items.length > this.maxHistory) this.items.length = this.maxHistory

    this.options.emit(notification)
    this.options.nativeNotify?.(notification)
    return notification
  }

  list(): AppNotification[] {
    return [...this.items]
  }

  unreadCount(): number {
    return this.items.filter((n) => !n.read).length
  }

  markRead(id: string): void {
    const item = this.items.find((n) => n.id === id)
    if (item) item.read = true
  }

  markAllRead(): void {
    for (const item of this.items) item.read = true
  }

  clear(): void {
    this.items.length = 0
  }
}
