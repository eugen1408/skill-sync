import type { ResolveContext, VersionStrategy, VersionPorts } from '../types'
import { parseGithubRepo } from '../parseRepo'

/**
 * Стратегия по `skillFolderHash` из `.skill-lock.json` (GitHub tree SHA) либо
 * `computedHash` содержимого (локальный источник). Обновление есть, если хэши различаются.
 */
export class SkillFolderHashStrategy implements VersionStrategy {
  readonly id = 'skillFolderHash'

  constructor(private readonly ports: VersionPorts) {}

  isApplicable(ctx: ResolveContext): boolean {
    if (ctx.lockEntry?.skillFolderHash || ctx.lockEntry?.computedHash) return true
    if (ctx.sourceType === 'local' && ctx.localPath) return true
    return Boolean(parseGithubRepo(ctx.repo.url) && ctx.repo.skillPath)
  }

  async resolveInstalled(ctx: ResolveContext): Promise<string | null> {
    if (ctx.lockEntry?.skillFolderHash) return ctx.lockEntry.skillFolderHash
    if (ctx.lockEntry?.computedHash) return ctx.lockEntry.computedHash
    if (ctx.installPath) return this.ports.files.computeFolderHash(ctx.installPath)
    return null
  }

  async resolveLatest(ctx: ResolveContext): Promise<string | null> {
    if (ctx.sourceType === 'local' && ctx.localPath) {
      return this.ports.files.computeFolderHash(ctx.localPath)
    }
    const repo = parseGithubRepo(ctx.repo.url)
    if (repo) {
      return this.ports.github.getFolderTreeSha(
        repo.owner,
        repo.repo,
        ctx.repo.ref ?? 'HEAD',
        ctx.repo.skillPath
      )
    }
    return null
  }

  compare(installed: string | null, latest: string | null): boolean {
    return installed !== null && latest !== null && installed !== latest
  }
}
