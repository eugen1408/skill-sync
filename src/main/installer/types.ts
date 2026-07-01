import type { SourceType, Source } from '@shared/domain/source'
import type { InstallRequest, InstallResult } from '@shared/domain/install'
import type { AgentInfo } from '@shared/domain/agent'
import type { JobContext } from '../jobs/JobRunner'
import type { PathContext } from './paths'

/** Разрешённый запрос установки (источник, имя skill, целевые агенты, пути). */
export interface ResolvedInstall {
  request: InstallRequest
  source: Source
  skillName: string
  sourceRef: string
  agents: AgentInfo[]
  pathCtx: PathContext
  cliPath: string | null
  npmRegistry: string | null
}

/**
 * Провайдер установки. Выбор по типу источника. Новый провайдер (HTTP/OCI/S3)
 * добавляется регистрацией — без изменений UI и остальной логики.
 */
export interface InstallerProvider {
  readonly id: string
  supports(sourceType: SourceType): boolean
  install(resolved: ResolvedInstall, ctx: JobContext): Promise<InstallResult>
}
