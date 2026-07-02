/**
 * Известные LLM-агенты, для которых устанавливаются skills (эпик Q-01 — мультиагентность).
 * `cliFlag` — значение флага `-a` для `npx skills` (может отличаться от внутреннего `id`).
 * Каталоги skills зависят от scope и сверены с реестром CLI
 * (`input/skills-main/src/agents.ts`: `skillsDir` — проектный, `globalSkillsDir` — глобальный):
 *  - `projectDir` — относительно корня проекта; у многих агентов общий `.agents/skills` (universal);
 *  - `globalDir` — относительно home (значения по умолчанию CLI, без env-оверрайдов
 *    вроде CLAUDE_CONFIG_DIR / CODEX_HOME / XDG_CONFIG_HOME).
 *
 * `cliFlag` сверены с ключами `agents` в CLI. Важно: CLI при неизвестном `-a` делает
 * `process.exit(1)` — тогда падает вся установка, а не отдельный агент.
 * Список расширяем: добавление агента не требует изменений в остальной логике.
 */
export interface AgentInfo {
  readonly id: string
  readonly label: string
  /** Идентификатор агента для флага `-a` CLI `skills`. */
  readonly cliFlag: string
  /** Каталог skills в проектном scope (относительно корня проекта). */
  readonly projectDir: string
  /** Каталог skills в глобальном scope (относительно home). */
  readonly globalDir: string
}

export type AgentScope = 'global' | 'project'

const UNIVERSAL = '.agents/skills'

export const KNOWN_AGENTS: readonly AgentInfo[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    cliFlag: 'claude-code',
    projectDir: '.claude/skills',
    globalDir: '.claude/skills'
  },
  {
    id: 'cursor',
    label: 'Cursor',
    cliFlag: 'cursor',
    projectDir: UNIVERSAL,
    globalDir: '.cursor/skills'
  },
  {
    id: 'codex',
    label: 'Codex',
    cliFlag: 'codex',
    projectDir: UNIVERSAL,
    globalDir: '.codex/skills'
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    cliFlag: 'opencode',
    projectDir: UNIVERSAL,
    globalDir: '.config/opencode/skills'
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    cliFlag: 'windsurf',
    projectDir: '.windsurf/skills',
    globalDir: '.codeium/windsurf/skills'
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    cliFlag: 'gemini-cli',
    projectDir: UNIVERSAL,
    globalDir: '.gemini/skills'
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    cliFlag: 'github-copilot',
    projectDir: UNIVERSAL,
    globalDir: '.copilot/skills'
  },
  {
    id: 'continue',
    label: 'Continue',
    cliFlag: 'continue',
    projectDir: '.continue/skills',
    globalDir: '.continue/skills'
  }
]

export const DEFAULT_AGENT_ID = 'claude-code'

export function getAgent(id: string): AgentInfo | undefined {
  return KNOWN_AGENTS.find((a) => a.id === id)
}

/** Каталог skills агента для заданного scope (относительный путь). */
export function agentDir(agent: AgentInfo, scope: AgentScope): string {
  return scope === 'global' ? agent.globalDir : agent.projectDir
}
