import type { SourceType } from '@shared/domain/source'

/** Запись из lock-файла (`.skill-lock.json` / `skills-lock.json`), читаемые поля. */
export interface LockEntry {
  source: string
  sourceType: string
  sourceUrl?: string
  ref?: string
  skillPath?: string
  /** GitHub tree SHA папки skill (глобальный `.skill-lock.json`). */
  skillFolderHash?: string
  /** SHA-256 содержимого папки на диске (локальный `skills-lock.json`). */
  computedHash?: string
}

/** Вход Version Resolver. */
export interface ResolveContext {
  skillId: string
  sourceType: SourceType
  /** Путь установленной копии skill (для installed). */
  installPath: string | null
  lockEntry: LockEntry | null
  repo: {
    url: string | null
    ref: string | null
    skillPath: string | null
    /** Локальный клон источника, если доступен (Часть 2 кэширует клоны). */
    localDir?: string | null
  }
  /** local: путь каталога-источника. */
  localPath: string | null
}

/**
 * Стратегия определения версии. installed и latest определяются ОДНОЙ стратегией
 * (Q3-01): кросс-стратегийное сравнение запрещено.
 */
export interface VersionStrategy {
  readonly id: string
  isApplicable(ctx: ResolveContext): boolean
  resolveInstalled(ctx: ResolveContext): Promise<string | null>
  resolveLatest(ctx: ResolveContext): Promise<string | null>
  /** Есть ли обновление (installed → latest). */
  compare(installed: string | null, latest: string | null): boolean
}

/** Внешние зависимости стратегий (инъектируются — для тестируемости). */
export interface VersionPorts {
  github: {
    /** SHA поддерева папки skill через GitHub trees API; null при недоступности/лимите. */
    getFolderTreeSha(
      owner: string,
      repo: string,
      ref: string,
      skillPath: string | null
    ): Promise<string | null>
  }
  git: {
    listRemoteTags(url: string): Promise<string[]>
    getRemoteRefSha(url: string, ref: string): Promise<string | null>
    lastCommitShaForPath(localDir: string, subpath: string | null): Promise<string | null>
  }
  files: {
    computeFolderHash(dir: string): Promise<string>
    readChangelogTopVersion(dir: string): Promise<string | null>
  }
}
