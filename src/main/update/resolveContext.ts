import { join } from 'node:path'
import type { CatalogEntry } from '@shared/domain/skill'
import type { Source } from '@shared/domain/source'
import type { LockEntry, ResolveContext } from '../version'

function joinParts(parts: (string | null | undefined)[]): string | null {
  const filtered = parts.filter((p): p is string => Boolean(p) && p !== '.')
  return filtered.length > 0 ? filtered.join('/') : null
}

/** Для official-источника извлекает GitHub-репозиторий из sourceRef вида `owner/repo@slug`. */
function officialRepoUrl(sourceRef: string): string | null {
  const m = /^([^@/\s]+\/[^@/\s]+)@/.exec(sourceRef)
  return m ? `https://github.com/${m[1]}` : null
}

/**
 * Строит ResolveContext для Version Resolver из записи каталога и её источника.
 * Приоритет источника данных о репозитории: запись `.skill-lock.json` (её пишет CLI
 * с реальными sourceUrl/skillPath/ref) → для official выведенный из sourceRef GitHub-URL
 * → конфиг источника.
 */
export function buildResolveContext(
  entry: CatalogEntry,
  source: Source | undefined,
  lockEntry: LockEntry | null,
  /** Каталог локального клона git-источника (root), если он уже существует. */
  gitLocalDir: string | null = null
): ResolveContext {
  const installPath = entry.installations[0]?.installPath ?? null

  const repoUrl =
    lockEntry?.sourceUrl ??
    (source?.type === 'official' ? officialRepoUrl(entry.sourceRef) : (source?.config.url ?? null))

  const ref = lockEntry?.ref ?? source?.config.ref ?? null

  // skillPath из lock (самый надёжный), иначе для git собираем из subpath + sourceRef.
  const skillPath =
    lockEntry?.skillPath ??
    (source?.type === 'git'
      ? joinParts([source?.config.subpath, entry.sourceRef, 'SKILL.md'])
      : null)

  const localPath =
    source?.type === 'local' && source.config.localPath
      ? entry.sourceRef && entry.sourceRef !== '.'
        ? join(source.config.localPath, entry.sourceRef)
        : source.config.localPath
      : null

  return {
    skillId: entry.id,
    sourceType: entry.sourceType,
    installPath,
    lockEntry,
    repo: { url: repoUrl, ref, skillPath, localDir: gitLocalDir },
    localPath
  }
}
