import type { SourceType } from '@shared/domain/source'

export type SourceFieldKey = 'url' | 'ref' | 'subpath' | 'authMode' | 'localPath'

export interface SourceFieldDef {
  key: SourceFieldKey
  placeholder: string
  required?: boolean
  control: 'text' | 'select'
  options?: { value: string; label: string }[]
  default?: string
  /** Показать кнопку выбора каталога (native folder-picker, follow-up [10]). */
  picker?: 'directory'
}

export interface SourceTypeDef {
  type: SourceType
  label: string
  fields: SourceFieldDef[]
  /** local: включать watch по умолчанию. */
  watch?: boolean
}

/**
 * Единый реестр типов источников для формы добавления. Добавление нового SourceType
 * требует правки только здесь (follow-up [16]).
 */
export const SOURCE_TYPES: SourceTypeDef[] = [
  {
    type: 'official',
    label: 'skills.sh',
    fields: [
      { key: 'url', placeholder: 'Базовый URL (по умолчанию https://skills.sh)', control: 'text' }
    ]
  },
  {
    type: 'git',
    label: 'Git',
    fields: [
      { key: 'url', placeholder: 'URL репозитория', required: true, control: 'text' },
      { key: 'ref', placeholder: 'ref (branch/tag)', control: 'text' },
      { key: 'subpath', placeholder: 'subpath', control: 'text' },
      {
        key: 'authMode',
        placeholder: 'Авторизация',
        control: 'select',
        default: 'https',
        options: [
          { value: 'https', label: 'HTTPS' },
          { value: 'ssh', label: 'SSH' },
          { value: 'none', label: 'Без авторизации' }
        ]
      }
    ]
  },
  {
    type: 'local',
    label: 'Локальный',
    watch: true,
    fields: [
      {
        key: 'localPath',
        placeholder: 'Путь к каталогу',
        required: true,
        control: 'text',
        picker: 'directory'
      }
    ]
  }
]

export function sourceTypeDef(type: SourceType): SourceTypeDef {
  return SOURCE_TYPES.find((t) => t.type === type) ?? SOURCE_TYPES[0]
}
