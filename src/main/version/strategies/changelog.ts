import type { ResolveContext, VersionStrategy, VersionPorts } from '../types'
import { compareSemver } from '../semver'

/**
 * Стратегия по верхней записи `CHANGELOG.md`. installed — из установленной копии,
 * latest — из копии источника (локальный клон / локальный каталог).
 */
export class ChangelogStrategy implements VersionStrategy {
  readonly id = 'changelog'

  constructor(private readonly ports: VersionPorts) {}

  private sourceDir(ctx: ResolveContext): string | null {
    return ctx.repo.localDir ?? ctx.localPath ?? null
  }

  isApplicable(ctx: ResolveContext): boolean {
    return Boolean(this.sourceDir(ctx))
  }

  async resolveInstalled(ctx: ResolveContext): Promise<string | null> {
    if (!ctx.installPath) return null
    return this.ports.files.readChangelogTopVersion(ctx.installPath)
  }

  async resolveLatest(ctx: ResolveContext): Promise<string | null> {
    const dir = this.sourceDir(ctx)
    if (!dir) return null
    return this.ports.files.readChangelogTopVersion(dir)
  }

  compare(installed: string | null, latest: string | null): boolean {
    if (installed === null || latest === null) return false
    return compareSemver(latest, installed) > 0
  }
}
