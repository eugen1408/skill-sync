import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { KNOWN_AGENTS } from '@shared/domain/agent'
import type { AgentInstallation } from '@shared/domain/skill'
import { normalizeSkillKey } from '@shared/domain/skill'
import { readGlobalLock } from '../version/lock'

/**
 * Обнаруживает установленные skills по каталогам всех известных агентов (эпик Q-01).
 * Возвращает карту: нормализованное имя skill → список установок по агентам.
 * Учитываются как обычные каталоги, так и симлинки (модель CLI `.agents/skills`).
 */
export async function scanInstalledSkills(
  home: string = homedir()
): Promise<Map<string, AgentInstallation[]>> {
  const lock = await readGlobalLock()
  const result = new Map<string, AgentInstallation[]>()

  for (const agent of KNOWN_AGENTS) {
    const skillsDir = join(home, agent.dir)
    const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => null)
    if (!entries) continue

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      if (entry.name.startsWith('.')) continue // служебные каталоги (напр. .system)
      const key = normalizeSkillKey(entry.name)
      if (!key) continue
      const installation: AgentInstallation = {
        agent: agent.id,
        installedVersion: lock[entry.name]?.ref ?? null,
        installPath: join(skillsDir, entry.name)
      }
      const list = result.get(key)
      if (list) list.push(installation)
      else result.set(key, [installation])
    }
  }

  return result
}
