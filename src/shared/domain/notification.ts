export type NotificationType =
  'update_available' | 'update_success' | 'install_error' | 'update_error' | 'source_unavailable'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  skillId: string | null
  sourceId: string | null
  createdAt: string
  read: boolean
}
