import type { SourceType } from './source'

export type UpdateStatus = 'up_to_date' | 'update_available' | 'not_installed' | 'unknown'

/** Нормализованный ключ skill (slug): нижний регистр, пробелы/подчёркивания → дефис. */
export function normalizeSkillKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Стабильный id записи каталога: sourceId + нормализованное имя. */
export function catalogEntryId(sourceId: string, name: string): string {
  return `${sourceId}:${normalizeSkillKey(name)}`
}

/** Установка skill для конкретного агента (эпик Q-01 — мультиагентность). */
export interface AgentInstallation {
  agent: string
  installedVersion: string | null
  installPath: string
  /** Каталог установки — симлинк (агентская папка ссылается на общий `.agents/skills`). */
  isSymlink: boolean
}

/** Запись единого каталога / локального индекса (Часть 4). */
export interface CatalogEntry {
  /** Стабильный ключ: sourceId + нормализованное имя skill. */
  id: string
  name: string
  description: string | null
  sourceId: string
  sourceType: SourceType
  /** Установлен хотя бы для одного целевого агента. */
  installed: boolean
  installations: AgentInstallation[]
  latestVersion: string | null
  hasUpdate: boolean
  lastCheckedAt: string | null
  updateStatus: UpdateStatus
  resolvedBy?: string | null
  /** Идентификатор внутри источника. */
  sourceRef: string
  /** Число установок по данным skills.sh (только для official-записей); null — неизвестно. */
  installs: number | null
}

/** Информация о версии от Version Resolver (Часть 3). */
export interface VersionInfo {
  installedVersion: string | null
  latestVersion: string | null
  hasUpdate: boolean
  /** id стратегии, определившей latest. */
  resolvedBy: string | null
  /** true, если ни одна стратегия не смогла определить версию. */
  unknown: boolean
}
