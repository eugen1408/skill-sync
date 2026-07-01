import type { InstallResult, AgentInstallOutcome, InstallStatus } from '@shared/domain/install'
import type { ResolvedInstall } from './types'
import type { JobContext } from '../jobs/JobRunner'
import { canonicalSkillPath, agentSkillPath } from './paths'
import { copyInto, linkOrCopy, pathExists } from './fsLink'

function aggregate(outcomes: AgentInstallOutcome[]): InstallStatus {
  if (outcomes.length === 0) return 'failed'
  if (outcomes.every((o) => o.status === 'skipped')) return 'skipped'
  if (outcomes.some((o) => o.status === 'ok' || o.status === 'skipped')) return 'ok'
  return 'failed'
}

/**
 * Общая установка из локальной папки skill в каноническую модель `.agents/skills`
 * + симлинки в каталоги целевых агентов (fallback — копия). Используют Git и Local провайдеры.
 */
export async function installFromFolder(
  skillFolder: string,
  resolved: ResolvedInstall,
  ctx: JobContext
): Promise<InstallResult> {
  const canonical = canonicalSkillPath(resolved.pathCtx, resolved.skillName)

  if (!resolved.request.force && (await pathExists(canonical))) {
    ctx.log('out', `Уже установлен: ${resolved.skillName}`)
    const outcomes = resolved.agents.map<AgentInstallOutcome>((a) => ({
      agent: a.id,
      status: 'skipped',
      installPath: agentSkillPath(resolved.pathCtx, a, resolved.skillName)
    }))
    return {
      skillId: resolved.request.skillId,
      status: 'skipped',
      installedVersion: null,
      outcomes,
      error: null
    }
  }

  ctx.progress(20, 'Копирование в канонический каталог…')
  await copyInto(skillFolder, canonical)

  const outcomes: AgentInstallOutcome[] = []
  let done = 0
  for (const agent of resolved.agents) {
    ctx.throwIfCancelled()
    const linkPath = agentSkillPath(resolved.pathCtx, agent, resolved.skillName)
    try {
      await linkOrCopy(canonical, linkPath)
      outcomes.push({ agent: agent.id, status: 'ok', installPath: linkPath })
    } catch {
      outcomes.push({ agent: agent.id, status: 'failed', installPath: null })
    }
    done += 1
    ctx.progress(20 + Math.round((done / resolved.agents.length) * 80), `Агент: ${agent.label}`)
  }

  return {
    skillId: resolved.request.skillId,
    status: aggregate(outcomes),
    installedVersion: null,
    outcomes,
    error: null
  }
}
