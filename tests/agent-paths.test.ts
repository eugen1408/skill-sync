import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { getAgent } from '../src/shared/domain/agent'
import { resolveGlobalAgentSkillsDir } from '../src/main/agentPaths'

const CLAUDE = getAgent('claude-code')!
const CODEX = getAgent('codex')!
const OPENCODE = getAgent('opencode')!
const CURSOR = getAgent('cursor')!
const HOME = '/home/u'

describe('resolveGlobalAgentSkillsDir', () => {
  it('без env — дефолт home/globalDir', () => {
    expect(resolveGlobalAgentSkillsDir(CLAUDE, HOME, {})).toBe(join(HOME, '.claude/skills'))
    expect(resolveGlobalAgentSkillsDir(OPENCODE, HOME, {})).toBe(
      join(HOME, '.config/opencode/skills')
    )
    expect(resolveGlobalAgentSkillsDir(CURSOR, HOME, {})).toBe(join(HOME, '.cursor/skills'))
  })

  it('CLAUDE_CONFIG_DIR переопределяет базовый каталог claude', () => {
    const env = { CLAUDE_CONFIG_DIR: '/cfg/claude' }
    expect(resolveGlobalAgentSkillsDir(CLAUDE, HOME, env)).toBe('/cfg/claude/skills')
  })

  it('CODEX_HOME переопределяет codex', () => {
    expect(resolveGlobalAgentSkillsDir(CODEX, HOME, { CODEX_HOME: '/x/codex' })).toBe(
      '/x/codex/skills'
    )
  })

  it('XDG_CONFIG_HOME переопределяет базу opencode (+ суффикс opencode/skills)', () => {
    expect(resolveGlobalAgentSkillsDir(OPENCODE, HOME, { XDG_CONFIG_HOME: '/xdg' })).toBe(
      '/xdg/opencode/skills'
    )
  })

  it('относительное значение env трактуется относительно home', () => {
    expect(resolveGlobalAgentSkillsDir(CODEX, HOME, { CODEX_HOME: '.codex-alt' })).toBe(
      join(HOME, '.codex-alt/skills')
    )
  })

  it('агент без env-оверрайда игнорирует переменные', () => {
    expect(resolveGlobalAgentSkillsDir(CURSOR, HOME, { CLAUDE_CONFIG_DIR: '/x' })).toBe(
      join(HOME, '.cursor/skills')
    )
  })
})
