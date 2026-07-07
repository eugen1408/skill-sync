import { resolveLocale, mt } from '../../i18n'

import type { Source, RawSkill } from '@shared/domain/source'
import { makeAppError } from '@shared/domain/error'
import type { SourceAdapter, IndexContext } from '../types'
import type { GitCache } from '../gitCache'
import { discoverSkills } from '../skillDiscovery'
import { parseGithubRepo } from '../../version/parseRepo'

/**
 * Git-источник (в т.ч. корпоративный): клонирует/обновляет репозиторий через GitCache,
 * затем обнаруживает SKILL.md. Учитывает ref (branch/tag) и subpath.
 */
export class GitSourceAdapter implements SourceAdapter {
  readonly type = 'git' as const
  readonly supportsWatch = false

  constructor(private readonly cache: GitCache) {}

  async validate(source: Source): Promise<void> {
    const url = source.config.url?.trim()
    if (!url) throw makeAppError('SOURCE_UNAVAILABLE', mt(resolveLocale('system'), 'source.noGitUrl' as any))
    const looksLikeGit =
      /^https?:\/\//i.test(url) || /^git@/i.test(url) || Boolean(parseGithubRepo(url))
    if (!looksLikeGit) {
      throw makeAppError('SOURCE_UNAVAILABLE', mt(resolveLocale('system'), 'source.notGitUrl' as any))
    }
  }

  async listSkills(source: Source, ctx: IndexContext): Promise<RawSkill[]> {
    const dir = await this.cache.ensure(source, ctx)
    ctx.progress(null, mt(resolveLocale('system'), 'source.indexingProgress' as any, { name: source.name }))
    const skills = await discoverSkills(dir)
    const ref = source.config.ref?.trim() || null
    return skills.map((s) => ({ ...s, ref }))
  }
}
