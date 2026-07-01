import type { ResolveContext, VersionStrategy, VersionPorts } from '../types'
import { parseSemver, compareSemver, maxSemver } from '../semver'

/** Стратегия по последнему семантическому git-тегу репозитория. */
export class GitTagStrategy implements VersionStrategy {
  readonly id = 'gitTag'

  constructor(private readonly ports: VersionPorts) {}

  isApplicable(ctx: ResolveContext): boolean {
    return Boolean(ctx.repo.url) && (ctx.sourceType === 'git' || ctx.sourceType === 'official')
  }

  async resolveInstalled(ctx: ResolveContext): Promise<string | null> {
    // Установленная версия — зафиксированный при установке ref, если это semver-тег.
    return parseSemver(ctx.lockEntry?.ref) ? (ctx.lockEntry?.ref ?? null) : null
  }

  async resolveLatest(ctx: ResolveContext): Promise<string | null> {
    if (!ctx.repo.url) return null
    const tags = await this.ports.git.listRemoteTags(ctx.repo.url)
    return maxSemver(tags)
  }

  compare(installed: string | null, latest: string | null): boolean {
    if (installed === null || latest === null) return false
    return compareSemver(latest, installed) > 0
  }
}
