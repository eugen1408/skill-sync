import { StrategyRegistry } from './registry'
import { VersionResolver } from './VersionResolver'
import { createVersionPorts } from './ports'
import type { VersionPorts } from './types'
import { SkillFolderHashStrategy } from './strategies/skillFolderHash'
import { GitTagStrategy } from './strategies/gitTag'
import { GitCommitShaStrategy } from './strategies/gitCommitSha'
import { ChangelogStrategy } from './strategies/changelog'

export { VersionResolver } from './VersionResolver'
export { StrategyRegistry } from './registry'
export type { VersionStrategy, ResolveContext, VersionPorts, LockEntry } from './types'
export {
  findLockEntry,
  readGlobalLock,
  readLocalLock,
  removeGlobalLockEntry,
  updateGlobalLockEntry
} from './lock'

/**
 * Собирает VersionResolver с приоритетом по умолчанию:
 * skillFolderHash → gitTag → gitCommitSha → changelog.
 */
export function createDefaultVersionResolver(
  ports: VersionPorts = createVersionPorts()
): VersionResolver {
  const registry = new StrategyRegistry()
    .register(new SkillFolderHashStrategy(ports), 10)
    .register(new GitTagStrategy(ports), 20)
    .register(new GitCommitShaStrategy(ports), 30)
    .register(new ChangelogStrategy(ports), 40)
  return new VersionResolver(registry)
}
