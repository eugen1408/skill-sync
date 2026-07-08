import type { UpdateStatus, CatalogEntry } from '@shared/domain/skill'
import type { SourceType, SourceStatus } from '@shared/domain/source'
import type { NotificationType } from '@shared/domain/notification'
import type { AuditRisk } from '@shared/domain/audit'
import { t } from './i18n.svelte'
import type { MessageKey } from '@shared/i18n/messages'

// Форматтеры дат — из i18n (реэкспорт для обратной совместимости импортов компонентов).
export { formatDateTime, formatDate, formatTime } from './i18n.svelte'

export function updateStatusLabel(status: UpdateStatus): string {
  return t(`updateStatus.${status}` as MessageKey)
}

/** Пояснение к статусу версии (tooltip): почему «Неизвестно»/«Актуально» и т.п. (follow-up C2). */
export function updateStatusHint(entry: CatalogEntry): string {
  switch (entry.updateStatus) {
    case 'not_installed':
      return t('statusHint.not_installed')
    case 'up_to_date':
      return t('statusHint.up_to_date')
    case 'update_available':
      return t('statusHint.update_available')
    default: {
      if (entry.sourceType === 'official') return t('statusHint.unknown.official')
      if (entry.sourceId === 'installed') return t('statusHint.unknown.orphan')
      if (entry.lastCheckedAt == null) return t('statusHint.unknown.notChecked')
      return t('statusHint.unknown.generic')
    }
  }
}

/** Тримминг в середине: длинные SHA/версии → «c914440…a0bdfaee» (сохраняет начало и конец). */
export function truncateMiddle(value: string, head = 7, tail = 8): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

/** Компактный формат числа установок: 1_234 → «1.2K», 1_500_000 → «1.5M». */
export function formatInstalls(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export function sourceTypeLabel(type: SourceType): string {
  return t(`sourceType.${type}` as MessageKey)
}

export function sourceStatusLabel(status: SourceStatus): string {
  return t(`sourceStatus.${status}` as MessageKey)
}

export function riskLabel(risk: AuditRisk): string {
  return t(`risk.${risk}` as MessageKey)
}

export function riskBadgeClass(risk: AuditRisk): string {
  switch (risk) {
    case 'safe':
      return 'preset-filled-success-500'
    case 'low':
      return 'preset-tonal-success'
    case 'medium':
      return 'preset-filled-warning-500'
    case 'high':
    case 'critical':
      return 'preset-filled-error-500'
    case 'unknown':
      return 'preset-tonal'
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  ath: 'Agent Trust Hub',
  socket: 'Socket',
  snyk: 'Snyk',
  zeroleaks: 'ZeroLeaks'
}

export function auditProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider
}

export function notificationTypeLabel(type: NotificationType): string {
  return t(`notifType.${type}` as MessageKey)
}
