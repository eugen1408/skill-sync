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
  /** Каталог skills в глобальном scope (относительно home) — дефолт CLI без env-оверрайдов. */
  readonly globalDir: string
  /** Env-переменная, переопределяющая базовый каталог глобального scope (как в CLI). */
  readonly globalEnvVar?: string
  /** Путь skills относительно значения `globalEnvVar` (если переменная задана). */
  readonly globalEnvSuffix?: string
}

export type AgentScope = 'global' | 'project'

const UNIVERSAL = '.agents/skills'

export const KNOWN_AGENTS: readonly AgentInfo[] = [
  {
    id: "adal",
    label: "AdaL",
    cliFlag: "adal",
    projectDir: ".adal/skills",
    globalDir: ".adal/skills"
  },
  {
    id: "aider-desk",
    label: "AiderDesk",
    cliFlag: "aider-desk",
    projectDir: ".aider-desk/skills",
    globalDir: ".aider-desk/skills"
  },
  {
    id: "amp",
    label: "Amp",
    cliFlag: "amp",
    projectDir: UNIVERSAL,
    globalDir: ".config/agents/skills"
  },
  {
    id: "antigravity",
    label: "Antigravity",
    cliFlag: "antigravity",
    projectDir: UNIVERSAL,
    globalDir: ".gemini/antigravity/skills"
  },
  {
    id: "antigravity-cli",
    label: "Antigravity CLI",
    cliFlag: "antigravity-cli",
    projectDir: UNIVERSAL,
    globalDir: ".gemini/antigravity-cli/skills"
  },
  {
    id: "astrbot",
    label: "AstrBot",
    cliFlag: "astrbot",
    projectDir: "data/skills",
    globalDir: ".astrbot/data/skills"
  },
  {
    id: "augment",
    label: "Augment",
    cliFlag: "augment",
    projectDir: ".augment/skills",
    globalDir: ".augment/skills"
  },
  {
    id: "autohand-code",
    label: "Autohand Code CLI",
    cliFlag: "autohand-code",
    projectDir: ".autohand/skills",
    globalDir: ".autohand/skills"
  },
  {
    id: "claude-code",
    label: "Claude Code",
    cliFlag: "claude-code",
    projectDir: ".claude/skills",
    globalDir: ".claude/skills",
    globalEnvVar: "CLAUDE_CONFIG_DIR",
    globalEnvSuffix: "skills"
  },
  {
    id: "cline",
    label: "Cline",
    cliFlag: "cline",
    projectDir: UNIVERSAL,
    globalDir: ".agents/skills"
  },
  {
    id: "codestudio",
    label: "Code Studio",
    cliFlag: "codestudio",
    projectDir: ".codestudio/skills",
    globalDir: ".codestudio/skills"
  },
  {
    id: "codearts-agent",
    label: "CodeArts Agent",
    cliFlag: "codearts-agent",
    projectDir: ".codeartsdoer/skills",
    globalDir: ".codeartsdoer/skills"
  },
  {
    id: "codebuddy",
    label: "CodeBuddy",
    cliFlag: "codebuddy",
    projectDir: ".codebuddy/skills",
    globalDir: ".codebuddy/skills"
  },
  {
    id: "codemaker",
    label: "Codemaker",
    cliFlag: "codemaker",
    projectDir: ".codemaker/skills",
    globalDir: ".codemaker/skills"
  },
  {
    id: "codex",
    label: "Codex",
    cliFlag: "codex",
    projectDir: UNIVERSAL,
    globalDir: ".codex/skills",
    globalEnvVar: "CODEX_HOME",
    globalEnvSuffix: "skills"
  },
  {
    id: "command-code",
    label: "Command Code",
    cliFlag: "command-code",
    projectDir: ".commandcode/skills",
    globalDir: ".commandcode/skills"
  },
  {
    id: "continue",
    label: "Continue",
    cliFlag: "continue",
    projectDir: ".continue/skills",
    globalDir: ".continue/skills"
  },
  {
    id: "cortex",
    label: "Cortex Code",
    cliFlag: "cortex",
    projectDir: ".cortex/skills",
    globalDir: ".snowflake/cortex/skills"
  },
  {
    id: "crush",
    label: "Crush",
    cliFlag: "crush",
    projectDir: ".crush/skills",
    globalDir: ".config/crush/skills"
  },
  {
    id: "cursor",
    label: "Cursor",
    cliFlag: "cursor",
    projectDir: UNIVERSAL,
    globalDir: ".cursor/skills"
  },
  {
    id: "deepagents",
    label: "Deep Agents",
    cliFlag: "deepagents",
    projectDir: UNIVERSAL,
    globalDir: ".deepagents/agent/skills"
  },
  {
    id: "devin",
    label: "Devin for Terminal",
    cliFlag: "devin",
    projectDir: ".devin/skills",
    globalDir: ".config/devin/skills"
  },
  {
    id: "dexto",
    label: "Dexto",
    cliFlag: "dexto",
    projectDir: UNIVERSAL,
    globalDir: ".agents/skills"
  },
  {
    id: "droid",
    label: "Droid",
    cliFlag: "droid",
    projectDir: ".factory/skills",
    globalDir: ".factory/skills"
  },
  {
    id: "eve",
    label: "Eve",
    cliFlag: "eve",
    projectDir: "agent/skills",
    globalDir: ""
  },
  {
    id: "firebender",
    label: "Firebender",
    cliFlag: "firebender",
    projectDir: UNIVERSAL,
    globalDir: ".firebender/skills"
  },
  {
    id: "forgecode",
    label: "ForgeCode",
    cliFlag: "forgecode",
    projectDir: ".forge/skills",
    globalDir: ".forge/skills"
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    cliFlag: "gemini-cli",
    projectDir: UNIVERSAL,
    globalDir: ".gemini/skills"
  },
  {
    id: "github-copilot",
    label: "GitHub Copilot",
    cliFlag: "github-copilot",
    projectDir: UNIVERSAL,
    globalDir: ".copilot/skills"
  },
  {
    id: "goose",
    label: "Goose",
    cliFlag: "goose",
    projectDir: ".goose/skills",
    globalDir: ".config/goose/skills"
  },
  {
    id: "hermes-agent",
    label: "Hermes Agent",
    cliFlag: "hermes-agent",
    projectDir: ".hermes/skills",
    globalDir: ".hermes/skills"
  },
  {
    id: "bob",
    label: "IBM Bob",
    cliFlag: "bob",
    projectDir: ".bob/skills",
    globalDir: ".bob/skills"
  },
  {
    id: "iflow-cli",
    label: "iFlow CLI",
    cliFlag: "iflow-cli",
    projectDir: ".iflow/skills",
    globalDir: ".iflow/skills"
  },
  {
    id: "inference-sh",
    label: "inference.sh",
    cliFlag: "inference-sh",
    projectDir: ".inferencesh/skills",
    globalDir: ".inferencesh/skills"
  },
  {
    id: "jazz",
    label: "Jazz",
    cliFlag: "jazz",
    projectDir: ".jazz/skills",
    globalDir: ".jazz/skills"
  },
  {
    id: "junie",
    label: "Junie",
    cliFlag: "junie",
    projectDir: ".junie/skills",
    globalDir: ".junie/skills"
  },
  {
    id: "kilo",
    label: "Kilo Code",
    cliFlag: "kilo",
    projectDir: ".kilocode/skills",
    globalDir: ".kilocode/skills"
  },
  {
    id: "kimi-code-cli",
    label: "Kimi Code CLI",
    cliFlag: "kimi-code-cli",
    projectDir: UNIVERSAL,
    globalDir: ".agents/skills"
  },
  {
    id: "kiro-cli",
    label: "Kiro CLI",
    cliFlag: "kiro-cli",
    projectDir: ".kiro/skills",
    globalDir: ".kiro/skills"
  },
  {
    id: "kode",
    label: "Kode",
    cliFlag: "kode",
    projectDir: ".kode/skills",
    globalDir: ".kode/skills"
  },
  {
    id: "lingma",
    label: "Lingma",
    cliFlag: "lingma",
    projectDir: ".lingma/skills",
    globalDir: ".lingma/skills"
  },
  {
    id: "loaf",
    label: "Loaf",
    cliFlag: "loaf",
    projectDir: UNIVERSAL,
    globalDir: ".agents/skills"
  },
  {
    id: "mcpjam",
    label: "MCPJam",
    cliFlag: "mcpjam",
    projectDir: ".mcpjam/skills",
    globalDir: ".mcpjam/skills"
  },
  {
    id: "mistral-vibe",
    label: "Mistral Vibe",
    cliFlag: "mistral-vibe",
    projectDir: ".vibe/skills",
    globalDir: ".vibe/skills"
  },
  {
    id: "moxby",
    label: "Moxby",
    cliFlag: "moxby",
    projectDir: ".moxby/skills",
    globalDir: ".moxby/skills"
  },
  {
    id: "mux",
    label: "Mux",
    cliFlag: "mux",
    projectDir: ".mux/skills",
    globalDir: ".mux/skills"
  },
  {
    id: "neovate",
    label: "Neovate",
    cliFlag: "neovate",
    projectDir: ".neovate/skills",
    globalDir: ".neovate/skills"
  },
  {
    id: "ona",
    label: "Ona",
    cliFlag: "ona",
    projectDir: ".ona/skills",
    globalDir: ".ona/skills"
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    cliFlag: "openclaw",
    projectDir: "skills",
    globalDir: ".openclaw/skills"
  },
  {
    id: "opencode",
    label: "OpenCode",
    cliFlag: "opencode",
    projectDir: UNIVERSAL,
    globalDir: ".config/opencode/skills",
    globalEnvVar: "XDG_CONFIG_HOME",
    globalEnvSuffix: "opencode/skills"
  },
  {
    id: "openhands",
    label: "OpenHands",
    cliFlag: "openhands",
    projectDir: ".openhands/skills",
    globalDir: ".openhands/skills"
  },
  {
    id: "pi",
    label: "Pi",
    cliFlag: "pi",
    projectDir: ".pi/skills",
    globalDir: ".pi/agent/skills"
  },
  {
    id: "pochi",
    label: "Pochi",
    cliFlag: "pochi",
    projectDir: ".pochi/skills",
    globalDir: ".pochi/skills"
  },
  {
    id: "promptscript",
    label: "PromptScript",
    cliFlag: "promptscript",
    projectDir: UNIVERSAL,
    globalDir: ""
  },
  {
    id: "qoder",
    label: "Qoder",
    cliFlag: "qoder",
    projectDir: ".qoder/skills",
    globalDir: ".qoder/skills"
  },
  {
    id: "qoder-cn",
    label: "Qoder CN",
    cliFlag: "qoder-cn",
    projectDir: ".qoder/skills",
    globalDir: ".qoder-cn/skills"
  },
  {
    id: "qwen-code",
    label: "Qwen Code",
    cliFlag: "qwen-code",
    projectDir: ".qwen/skills",
    globalDir: ".qwen/skills"
  },
  {
    id: "reasonix",
    label: "Reasonix",
    cliFlag: "reasonix",
    projectDir: ".reasonix/skills",
    globalDir: ".reasonix/skills"
  },
  {
    id: "replit",
    label: "Replit",
    cliFlag: "replit",
    projectDir: UNIVERSAL,
    globalDir: ".config/agents/skills"
  },
  {
    id: "roo",
    label: "Roo Code",
    cliFlag: "roo",
    projectDir: ".roo/skills",
    globalDir: ".roo/skills"
  },
  {
    id: "rovodev",
    label: "Rovo Dev",
    cliFlag: "rovodev",
    projectDir: ".rovodev/skills",
    globalDir: ".rovodev/skills"
  },
  {
    id: "tabnine-cli",
    label: "Tabnine CLI",
    cliFlag: "tabnine-cli",
    projectDir: ".tabnine/agent/skills",
    globalDir: ".tabnine/agent/skills"
  },
  {
    id: "terramind",
    label: "Terramind",
    cliFlag: "terramind",
    projectDir: ".terramind/skills",
    globalDir: ".terramind/skills"
  },
  {
    id: "tinycloud",
    label: "Tinycloud",
    cliFlag: "tinycloud",
    projectDir: ".tinycloud/skills",
    globalDir: ".tinycloud/skills"
  },
  {
    id: "trae",
    label: "Trae",
    cliFlag: "trae",
    projectDir: ".trae/skills",
    globalDir: ".trae/skills"
  },
  {
    id: "trae-cn",
    label: "Trae CN",
    cliFlag: "trae-cn",
    projectDir: ".trae/skills",
    globalDir: ".trae-cn/skills"
  },
  {
    id: "universal",
    label: "Universal",
    cliFlag: "universal",
    projectDir: UNIVERSAL,
    globalDir: ".config/agents/skills"
  },
  {
    id: "warp",
    label: "Warp",
    cliFlag: "warp",
    projectDir: UNIVERSAL,
    globalDir: ".agents/skills"
  },
  {
    id: "windsurf",
    label: "Windsurf",
    cliFlag: "windsurf",
    projectDir: ".windsurf/skills",
    globalDir: ".codeium/windsurf/skills"
  },
  {
    id: "zed",
    label: "Zed",
    cliFlag: "zed",
    projectDir: UNIVERSAL,
    globalDir: ".agents/skills"
  },
  {
    id: "zencoder",
    label: "Zencoder",
    cliFlag: "zencoder",
    projectDir: ".zencoder/skills",
    globalDir: ".zencoder/skills"
  },
  {
    id: "zenflow",
    label: "Zenflow",
    cliFlag: "zenflow",
    projectDir: ".zencoder/skills",
    globalDir: ".zencoder/skills"
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
