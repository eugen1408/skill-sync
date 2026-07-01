import { join } from 'node:path'
import type { InstallResult } from '@shared/domain/install'
import type { SourceType } from '@shared/domain/source'
import type { InstallerProvider, ResolvedInstall } from '../types'
import type { JobContext } from '../../jobs/JobRunner'
import type { GitCache } from '../../sources/gitCache'
import { installFromFolder } from '../fileInstall'

/** Git Provider: клонирует/обновляет репозиторий (кэш) и ставит папку skill в целевые агенты. */
export class GitProvider implements InstallerProvider {
  readonly id = 'git'

  constructor(private readonly cache: GitCache) {}

  supports(type: SourceType): boolean {
    return type === 'git'
  }

  async install(resolved: ResolvedInstall, ctx: JobContext): Promise<InstallResult> {
    ctx.progress(null, 'Получение репозитория…')
    const repoDir = await this.cache.ensure(resolved.source, ctx)
    const skillFolder =
      resolved.sourceRef && resolved.sourceRef !== '.' ? join(repoDir, resolved.sourceRef) : repoDir
    return installFromFolder(skillFolder, resolved, ctx)
  }
}
