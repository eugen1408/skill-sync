import type { UpdateStatus } from '@shared/domain/skill'
import type { SourceType, SourceStatus } from '@shared/domain/source'
import type { NotificationType } from '@shared/domain/notification'
import type { AuditRisk } from '@shared/domain/audit'

export function updateStatusLabel(status: UpdateStatus): string {
  switch (status) {
    case 'up_to_date':
      return 'Актуально'
    case 'update_available':
      return 'Есть обновление'
    case 'not_installed':
      return 'Не установлен'
    case 'unknown':
      return 'Неизвестно'
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
  switch (type) {
    case 'official':
      return 'skills.sh'
    case 'git':
      return 'Git'
    case 'local':
      return 'Локальный'
  }
}

export function sourceStatusLabel(status: SourceStatus): string {
  switch (status) {
    case 'ok':
      return 'Готов'
    case 'indexing':
      return 'Индексация'
    case 'error':
      return 'Ошибка'
    case 'disabled':
      return 'Отключён'
  }
}

export function riskLabel(risk: AuditRisk): string {
  switch (risk) {
    case 'safe':
      return 'Безопасно'
    case 'low':
      return 'Низкий риск'
    case 'medium':
      return 'Средний риск'
    case 'high':
      return 'Высокий риск'
    case 'critical':
      return 'Критический риск'
    case 'unknown':
      return 'Нет данных'
  }
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
  switch (type) {
    case 'update_available':
      return 'Новая версия'
    case 'update_success':
      return 'Обновлено'
    case 'install_error':
      return 'Ошибка установки'
    case 'update_error':
      return 'Ошибка обновления'
    case 'source_unavailable':
      return 'Источник недоступен'
  }
}
