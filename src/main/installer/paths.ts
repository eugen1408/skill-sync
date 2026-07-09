import { homedir } from 'node:os'
import { join } from 'node:path'
import type { InstallScope } from '@shared/domain/config'
import type { AgentInfo } from '@shared/domain/agent'
import { agentDir } from '@shared/domain/agent'
import { resolveGlobalAgentSkillsDir } from '../agentPaths'

export interface PathContext {
  scope: InstallScope
  home: string
  cwd: string
  /** Переопределение базового каталога установки из настроек (InstallSettings.installDir). */
  installDir?: string | null
}

export function defaultPathContext(scope: InstallScope): PathContext {
  return { scope, home: homedir(), cwd: process.cwd() }
}

function baseDir(ctx: PathContext): string {
  if (ctx.installDir) return ctx.installDir
  return ctx.scope === 'global' ? ctx.home : ctx.cwd
}

/** Канонический каталог skills (модель CLI `.agents/skills`) — источник истины для симлинков. */
export function canonicalSkillsDir(ctx: PathContext): string {
  return join(baseDir(ctx), '.agents', 'skills')
}

export function canonicalSkillPath(ctx: PathContext, skillName: string): string {
  return join(canonicalSkillsDir(ctx), skillName)
}

/** Каталог skills конкретного агента для scope (куда ставится симлинк на канонический путь). */
export function agentSkillsDir(ctx: PathContext, agent: AgentInfo): string {
  // Глобальный scope без явного installDir учитывает env-оверрайды каталогов агентов (CLI).
  if (ctx.scope === 'global' && !ctx.installDir) {
    return resolveGlobalAgentSkillsDir(agent, ctx.home)
  }
  return join(baseDir(ctx), agentDir(agent, ctx.scope))
}

export function agentSkillPath(ctx: PathContext, agent: AgentInfo, skillName: string): string {
  return join(agentSkillsDir(ctx, agent), skillName)
}

/**
 * Универсальный агент для текущего scope: его каталог совпадает с каноническим `.agents/skills`.
 * Для таких агентов симлинк не нужен (skill уже лежит в каноне) и удалять его нельзя.
 */
export function isCanonicalAgentDir(ctx: PathContext, agent: AgentInfo): boolean {
  return agentSkillsDir(ctx, agent) === canonicalSkillsDir(ctx)
}

/** Целевой путь симлинка агента + признак «универсального» (канонического) каталога. */
export interface AgentLinkTarget {
  agent: AgentInfo
  linkPath: string
  isCanonical: boolean
}

/**
 * Единый источник истины по целевым путям агентов для skill: используется и установкой
 * (installFromFolder), и предпросмотром (previewInstall), чтобы preview не расходился с ФС.
 */
export function agentLinkTargets(
  ctx: PathContext,
  agents: AgentInfo[],
  skillName: string
): AgentLinkTarget[] {
  return agents.map((agent) => ({
    agent,
    linkPath: agentSkillPath(ctx, agent, skillName),
    isCanonical: isCanonicalAgentDir(ctx, agent)
  }))
}
