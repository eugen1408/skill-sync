import type { AgentInfo } from '@shared/domain/agent'
import type { ReconcileSummary } from '@shared/domain/install'
import type { PathContext } from './paths'
import { canonicalSkillPath, agentSkillPath } from './paths'
import { linkOrCopy, removePath, copyInto, pathExists } from './fsLink'

/** Установленный skill для реконсиляции: имя + известные пути установок (для «посева» канона). */
export interface ReconcilableSkill {
  name: string
  installPaths: string[]
}

/**
 * Реконсиляция симлинков при изменении набора агентов (эпик Q-01):
 * для добавленных агентов создаёт симлинк на канонический путь, для снятых — удаляет.
 * Канонический каталог `.agents/skills` и симлинки пересечения не затрагиваются. Идемпотентно.
 */
export async function reconcileAgents(
  skills: ReconcilableSkill[],
  added: AgentInfo[],
  removed: AgentInfo[],
  pathCtx: PathContext
): Promise<ReconcileSummary> {
  let linked = 0
  let unlinked = 0
  let skipped = 0

  for (const skill of skills) {
    const canonical = canonicalSkillPath(pathCtx, skill.name)

    // Гарантируем наличие канона: при копийной модели «посеваем» из существующей установки.
    if (added.length > 0 && !(await pathExists(canonical))) {
      const seed = await firstExisting(skill.installPaths)
      if (seed) {
        await copyInto(seed, canonical)
      } else {
        skipped += 1
        continue // нечего линковать
      }
    }

    for (const agent of added) {
      await linkOrCopy(canonical, agentSkillPath(pathCtx, agent, skill.name))
      linked += 1
    }
    for (const agent of removed) {
      await removePath(agentSkillPath(pathCtx, agent, skill.name))
      unlinked += 1
    }
  }

  return {
    added: added.map((a) => a.id),
    removed: removed.map((a) => a.id),
    linked,
    unlinked,
    skipped
  }
}

async function firstExisting(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    if (await pathExists(p)) return p
  }
  return null
}
