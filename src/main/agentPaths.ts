import { join, isAbsolute } from 'node:path'
import type { AgentInfo } from '@shared/domain/agent'

/**
 * Абсолютный каталог skills агента в глобальном scope с учётом env-оверрайдов CLI
 * (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_CONFIG_HOME`). Если переменная не задана —
 * дефолт `home/<globalDir>`. Относительное значение env трактуется относительно home.
 */
export function resolveGlobalAgentSkillsDir(
  agent: AgentInfo,
  home: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (!agent.globalDir) {
    throw new Error(`Agent ${agent.id} does not support global scope installations`)
  }
  const raw = agent.globalEnvVar ? env[agent.globalEnvVar]?.trim() : undefined
  if (raw) {
    const base = isAbsolute(raw) ? raw : join(home, raw)
    return join(base, agent.globalEnvSuffix ?? agent.globalDir)
  }
  return join(home, agent.globalDir)
}
