import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CatalogEntry } from '@shared/domain/skill'
import type { Source } from '@shared/domain/source'
import type { GitCache } from '../sources/gitCache'
import { renderMarkdown } from '../util/markdown'

const CANDIDATES = ['README.md', 'readme.md', 'Readme.md', 'SKILL.md']

/** Каталог с файлами skill: установленный путь → локальный источник → существующий git-клон. */
async function skillDir(
  entry: CatalogEntry,
  source: Source | undefined,
  gitCache: GitCache
): Promise<string | null> {
  const installPath = entry.installations[0]?.installPath
  if (installPath) return installPath
  const sub = entry.sourceRef && entry.sourceRef !== '.' ? entry.sourceRef : null
  if (source?.type === 'local' && source.config.localPath) {
    return sub ? join(source.config.localPath, sub) : source.config.localPath
  }
  if (source?.type === 'git') {
    const dir = await gitCache.existingDir(source)
    if (dir) return sub ? join(dir, sub) : dir
  }
  return null
}

/**
 * Отрендеренный HTML превью skill: README.md (варианты регистра) → SKILL.md из каталога skill.
 * null — файлов нет (напр. official-скил без локальной копии; там показывается описание аудита).
 */
export async function getSkillReadme(
  entry: CatalogEntry,
  source: Source | undefined,
  gitCache: GitCache
): Promise<string | null> {
  const dir = await skillDir(entry, source, gitCache)
  if (!dir) return null
  for (const name of CANDIDATES) {
    try {
      const md = await readFile(join(dir, name), 'utf8')
      if (md.trim()) return renderMarkdown(md)
    } catch {
      // нет файла — пробуем следующий кандидат
    }
  }
  return null
}
