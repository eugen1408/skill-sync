import type { UpdateStatus } from '@shared/domain/skill'
import type { SourceType, SourceStatus } from '@shared/domain/source'
import type { NotificationType } from '@shared/domain/notification'

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
