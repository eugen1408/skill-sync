import type { ResolveContext, VersionStrategy, VersionPorts } from '../types'

const SHA_RE = /^[0-9a-f]{7,40}$/i

/**
 * Стратегия по SHA коммита. latest — коммит, затрагивающий папку skill (если есть
 * локальный клон), иначе SHA HEAD целевого ref через ls-remote. Обновление — SHA изменился.
 */
export class GitCommitShaStrategy implements VersionStrategy {
  readonly id = 'gitCommitSha'

  constructor(private readonly ports: VersionPorts) {}

  isApplicable(ctx: ResolveContext): boolean {
    return Boolean(ctx.repo.url) || Boolean(ctx.repo.localDir)
  }

  async resolveInstalled(ctx: ResolveContext): Promise<string | null> {
    return ctx.lockEntry?.ref && SHA_RE.test(ctx.lockEntry.ref) ? ctx.lockEntry.ref : null
  }

  async resolveLatest(ctx: ResolveContext): Promise<string | null> {
    if (ctx.repo.localDir) {
      return this.ports.git.lastCommitShaForPath(ctx.repo.localDir, ctx.repo.skillPath)
    }
    if (ctx.repo.url) {
      return this.ports.git.getRemoteRefSha(ctx.repo.url, ctx.repo.ref ?? 'HEAD')
    }
    return null
  }

  compare(installed: string | null, latest: string | null): boolean {
    if (installed === null || latest === null) return false
    // SHA могут отличаться длиной (7 vs 40) — сравниваем по общему префиксу.
    const len = Math.min(installed.length, latest.length)
    return installed.slice(0, len).toLowerCase() !== latest.slice(0, len).toLowerCase()
  }
}
