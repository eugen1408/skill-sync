import type { InstallResult, AgentInstallOutcome, InstallStatus } from '@shared/domain/install'
import type { SourceType } from '@shared/domain/source'
import { makeAppError } from '@shared/domain/error'
import type { InstallerProvider, ResolvedInstall } from '../types'
import type { JobContext } from '../../jobs/JobRunner'
import { buildOfficialInvocation, runCli, cliEnv, detectAlreadyInstalled, tail } from '../exec'

/** Official Provider: установка через `npx skills add …` (одним вызовом на все агенты). */
export class OfficialProvider implements InstallerProvider {
  readonly id = 'official'

  supports(type: SourceType): boolean {
    return type === 'official'
  }

  async install(resolved: ResolvedInstall, ctx: JobContext): Promise<InstallResult> {
    const { command, args } = buildOfficialInvocation({
      sourceRef: resolved.sourceRef,
      agents: resolved.agents.map((a) => a.cliFlag),
      scope: resolved.request.scope,
      force: resolved.request.force,
      cliPath: resolved.cliPath
    })

    ctx.progress(null, `Установка через ${command} ${args.join(' ')}`)
    const {
      code,
      output,
      stderr,
      command: ranCommand
    } = await runCli(command, args, cliEnv(resolved.npmRegistry), ctx)

    const status: InstallStatus =
      code === 0 ? (detectAlreadyInstalled(output) ? 'skipped' : 'ok') : 'failed'

    const outcomes: AgentInstallOutcome[] = resolved.agents.map((a) => ({
      agent: a.id,
      status,
      installPath: null
    }))

    return {
      skillId: resolved.request.skillId,
      status,
      installedVersion: null,
      outcomes,
      error:
        status === 'failed'
          ? makeAppError('INSTALL_FAILED', `CLI завершился с кодом ${code}`, null, {
              skillName: resolved.skillName,
              sourceId: resolved.source.id,
              sourceRef: resolved.sourceRef,
              command: ranCommand,
              args,
              exitCode: code,
              stderr: stderr || tail(output),
              suggestion:
                'Проверьте доступность сети/npm-реестра и корректность источника. Подробности — в stderr выше.'
            })
          : null
    }
  }
}
