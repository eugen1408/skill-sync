/**
 * Известные LLM-агенты, для которых устанавливаются skills (эпик Q-01 — мультиагентность).
 * `dir` — подкаталог со skills относительно базового каталога (home для global, cwd для project).
 * Список расширяем: добавление агента не требует изменений в остальной логике.
 */
export interface AgentInfo {
  readonly id: string
  readonly label: string
  /** Подкаталог установки skills, напр. `.claude/skills`. */
  readonly dir: string
}

export const KNOWN_AGENTS: readonly AgentInfo[] = [
  { id: 'claude-code', label: 'Claude Code', dir: '.claude/skills' },
  { id: 'cursor', label: 'Cursor', dir: '.cursor/skills' },
  { id: 'codex', label: 'Codex', dir: '.codex/skills' },
  { id: 'opencode', label: 'OpenCode', dir: '.opencode/skills' },
  { id: 'windsurf', label: 'Windsurf', dir: '.windsurf/skills' },
  { id: 'gemini', label: 'Gemini Code Assist', dir: '.gemini/skills' },
  { id: 'copilot', label: 'GitHub Copilot', dir: '.copilot/skills' },
  { id: 'continue', label: 'Continue', dir: '.continue/skills' }
]

export const DEFAULT_AGENT_ID = 'claude-code'

export function getAgent(id: string): AgentInfo | undefined {
  return KNOWN_AGENTS.find((a) => a.id === id)
}
