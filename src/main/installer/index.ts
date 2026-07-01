import type { InstallResult } from '@shared/domain/install'
import type { ConfigStore } from '../config/ConfigStore'
import type { JobRunner } from '../jobs/JobRunner'
import type { SourceManager, GitCache } from '../sources'
import type { SkillRegistry } from '../registry'
import { InstallerService } from './InstallerService'
import { InstallerRegistry } from './registry'
import { OfficialProvider } from './providers/official'
import { GitProvider } from './providers/git'
import { LocalFolderProvider } from './providers/local'

export { InstallerService } from './InstallerService'
export { InstallerRegistry } from './registry'
export { reconcileAgents } from './agentReconciler'

export interface InstallerDeps {
  jobRunner: JobRunner
  sourceManager: SourceManager
  skillRegistry: SkillRegistry
  configStore: ConfigStore
  gitCache: GitCache
  onResult: (result: InstallResult) => void
}

export function createInstallerService(deps: InstallerDeps): InstallerService {
  const registry = new InstallerRegistry()
    .register(new OfficialProvider())
    .register(new GitProvider(deps.gitCache))
    .register(new LocalFolderProvider())
  return new InstallerService({
    jobRunner: deps.jobRunner,
    sourceManager: deps.sourceManager,
    skillRegistry: deps.skillRegistry,
    configStore: deps.configStore,
    registry,
    onResult: deps.onResult
  })
}
