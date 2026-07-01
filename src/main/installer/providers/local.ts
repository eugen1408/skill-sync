import { join } from 'node:path'
import type { InstallResult } from '@shared/domain/install'
import type { SourceType } from '@shared/domain/source'
import { makeAppError } from '@shared/domain/error'
import type { InstallerProvider, ResolvedInstall } from '../types'
import type { JobContext } from '../../jobs/JobRunner'
import { installFromFolder } from '../fileInstall'

/** Local Folder Provider: ставит папку skill из локального каталога в целевые агенты. */
export class LocalFolderProvider implements InstallerProvider {
  readonly id = 'local'

  supports(type: SourceType): boolean {
    return type === 'local'
  }

  async install(resolved: ResolvedInstall, ctx: JobContext): Promise<InstallResult> {
    const base = resolved.source.config.localPath
    if (!base) {
      throw makeAppError('INSTALL_FAILED', 'У локального источника не задан путь')
    }
    const skillFolder =
      resolved.sourceRef && resolved.sourceRef !== '.' ? join(base, resolved.sourceRef) : base
    return installFromFolder(skillFolder, resolved, ctx)
  }
}
