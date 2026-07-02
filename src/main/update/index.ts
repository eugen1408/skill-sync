import type { UpdateCheckResult } from '@shared/domain/update'
import type { JobRunner } from '../jobs/JobRunner'
import type { SourceManager, GitCache } from '../sources'
import type { OfficialCatalog } from '../sources/officialCatalog'
import type { SkillRegistry } from '../registry'
import type { InstallerService } from '../installer'
import type { ConfigStore } from '../config/ConfigStore'
import type { VersionResolver } from '../version'
import type { NotificationCenter } from '../notifications/NotificationCenter'
import { UpdateEngine } from './UpdateEngine'

export { UpdateEngine } from './UpdateEngine'
export { buildResolveContext } from './resolveContext'

export interface UpdateEngineFactoryDeps {
  jobRunner: JobRunner
  sourceManager: SourceManager
  skillRegistry: SkillRegistry
  installer: InstallerService
  resolver: VersionResolver
  notifications: NotificationCenter
  configStore: ConfigStore
  gitCache: GitCache
  officialCatalog: OfficialCatalog
  onChecked: (result: UpdateCheckResult) => void
}

export function createUpdateEngine(deps: UpdateEngineFactoryDeps): UpdateEngine {
  return new UpdateEngine(deps)
}
