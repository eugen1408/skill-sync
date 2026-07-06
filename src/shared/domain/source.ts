export type SourceType = 'official' | 'git' | 'local'

export type SourceStatus = 'ok' | 'indexing' | 'error' | 'disabled'

export type GitAuthMode = 'ssh' | 'https' | 'none'

export interface SourceConfig {
  /** git: URL репозитория; official: базовый URL (по умолчанию https://skills.sh). */
  url: string | null
  /** git: branch/tag. */
  ref: string | null
  /** git: путь внутри репозитория. */
  subpath: string | null
  /** git: режим аутентификации. */
  authMode: GitAuthMode | null
  /** local: абсолютный путь. */
  localPath: string | null
  /** local: включён ли watch. */
  watch: boolean
}

export interface Source {
  id: string
  type: SourceType
  name: string
  enabled: boolean
  config: SourceConfig
  lastIndexedAt: string | null
  status: SourceStatus
  lastError: string | null
}

/** Результат `listSkills` адаптера источника (Часть 2). */
export interface RawSkill {
  name: string
  description: string | null
  /** Идентификатор внутри источника: owner/repo@skill | относительный путь | slug каталога. */
  sourceRef: string
  /** git branch/tag/sha, если применимо. */
  ref: string | null
}

/** Вход добавления источника (id/status генерирует SourceManager). */
export interface AddSourceInput {
  type: SourceType
  name: string
  config: Partial<SourceConfig>
}

export const DEFAULT_OFFICIAL_URL = 'https://skills.sh'

/** Фиксированный id единственного официального источника (skills.sh), добавляемого по умолчанию. */
export const OFFICIAL_SOURCE_ID = 'official'

export function getSourceDomain(source: Source | { type: SourceType; config: Partial<SourceConfig> }): string {
  if (source.type === 'official') return 'skills.sh'
  if (source.type === 'local') return 'local'
  if (!source.config?.url) return 'other'

  let domain = 'other'
  const url = source.config.url

  if (url.startsWith('git@')) {
    const match = url.match(/git@([^:]+):/)
    if (match) domain = match[1]
  } else {
    try {
      domain = new URL(url).hostname
    } catch {
      // ignore
    }
  }

  if (domain.startsWith('git.')) {
    domain = domain.substring(4)
  }

  return domain
}
