import type { SourceType } from '@shared/domain/source'
import type { ConfigStore } from '../config/ConfigStore'
import type { JobRunner } from '../jobs/JobRunner'
import { SourceManager } from './SourceManager'
import type { SourceAdapter } from './types'
import { GitCache } from './gitCache'
import { OfficialSourceAdapter } from './adapters/official'
import { GitSourceAdapter } from './adapters/git'
import { LocalSourceAdapter } from './adapters/local'

export { SourceManager } from './SourceManager'
export { GitCache } from './gitCache'
export type { IndexResult } from './SourceManager'
export type { SourceAdapter, AddSourceInput, IndexContext } from './types'

export interface SourceManagerDeps {
  configStore: ConfigStore
  jobRunner: JobRunner
  /** Общий кэш клонов Git-источников (переиспользуется Installer-провайдером). */
  gitCache: GitCache
}

export function createSourceManager(deps: SourceManagerDeps): SourceManager {
  const adapters = new Map<SourceType, SourceAdapter>([
    ['official', new OfficialSourceAdapter()],
    ['git', new GitSourceAdapter(deps.gitCache)],
    ['local', new LocalSourceAdapter()]
  ])
  return new SourceManager(deps.configStore, deps.jobRunner, adapters)
}
