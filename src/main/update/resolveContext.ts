import { join } from 'node:path'
import type { CatalogEntry } from '@shared/domain/skill'
import type { Source } from '@shared/domain/source'
import type { LockEntry, ResolveContext } from '../version'

function joinParts(parts: (string | null | undefined)[]): string | null {
  const filtered = parts.filter((p): p is string => Boolean(p) && p !== '.')
  return filtered.length > 0 ? filtered.join('/') : null
}

/** Строит ResolveContext для Version Resolver из записи каталога и её источника. */
export function buildResolveContext(
  entry: CatalogEntry,
  source: Source | undefined,
  lockEntry: LockEntry | null
): ResolveContext {
  const installPath = entry.installations[0]?.installPath ?? null
  const isRepo = source?.type === 'git' || source?.type === 'official'
  const skillPath = isRepo ? joinParts([source?.config.subpath, entry.sourceRef, 'SKILL.md']) : null
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
    repo: {
      url: source?.config.url ?? null,
      ref: source?.config.ref ?? null,
      skillPath,
      localDir: null
    },
    localPath
  }
}
