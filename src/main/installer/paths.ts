import { homedir } from 'node:os'
import { join } from 'node:path'
import type { InstallScope } from '@shared/domain/config'
import type { AgentInfo } from '@shared/domain/agent'

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

/** Каталог skills конкретного агента (куда ставится симлинк на канонический путь). */
export function agentSkillsDir(ctx: PathContext, agent: AgentInfo): string {
  return join(baseDir(ctx), agent.dir)
}

export function agentSkillPath(ctx: PathContext, agent: AgentInfo, skillName: string): string {
  return join(agentSkillsDir(ctx, agent), skillName)
}
