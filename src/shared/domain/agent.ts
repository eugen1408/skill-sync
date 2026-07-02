/**
 * Известные LLM-агенты, для которых устанавливаются skills (эпик Q-01 — мультиагентность).
 * `dir` — подкаталог со skills относительно базового каталога (home для global, cwd для project).
 * `cliFlag` — значение флага `-a` для `npx skills` (может отличаться от внутреннего `id`).
 * Список расширяем: добавление агента не требует изменений в остальной логике.
 *
 * `cliFlag` сверены с реестром CLI (`input/skills-main/src/agents.ts`, ключи `agents`).
 * Важно: CLI при неизвестном `-a` делает `process.exit(1)` — тогда падает вся установка,
 * а не отдельный агент. Поэтому cliFlag должен точно совпадать с ключом агента в CLI.
 */
export interface AgentInfo {
  readonly id: string
  readonly label: string
  /** Подкаталог установки skills, напр. `.claude/skills`. */
  readonly dir: string
  /** Идентификатор агента для флага `-a` CLI `skills`. */
  readonly cliFlag: string
}

export const KNOWN_AGENTS: readonly AgentInfo[] = [
  { id: 'claude-code', label: 'Claude Code', dir: '.claude/skills', cliFlag: 'claude-code' },
  { id: 'cursor', label: 'Cursor', dir: '.cursor/skills', cliFlag: 'cursor' },
  { id: 'codex', label: 'Codex', dir: '.codex/skills', cliFlag: 'codex' },
  { id: 'opencode', label: 'OpenCode', dir: '.opencode/skills', cliFlag: 'opencode' },
  { id: 'windsurf', label: 'Windsurf', dir: '.windsurf/skills', cliFlag: 'windsurf' },
  { id: 'gemini', label: 'Gemini CLI', dir: '.gemini/skills', cliFlag: 'gemini-cli' },
  { id: 'copilot', label: 'GitHub Copilot', dir: '.copilot/skills', cliFlag: 'github-copilot' },
  { id: 'continue', label: 'Continue', dir: '.continue/skills', cliFlag: 'continue' }
]

export const DEFAULT_AGENT_ID = 'claude-code'

export function getAgent(id: string): AgentInfo | undefined {
  return KNOWN_AGENTS.find((a) => a.id === id)
}
