import { homedir } from 'node:os'
import type {
  InstallRequest,
  InstallResult,
  ReconcileAgentsRequest,
  ReconcileSummary,
  ReconcilePreview,
  ReconcileOp
} from '@shared/domain/install'
import type { AgentInfo } from '@shared/domain/agent'
import { getAgent } from '@shared/domain/agent'
import { makeAppError } from '@shared/domain/error'
import type { ConfigStore } from '../config/ConfigStore'
import type { JobRunner } from '../jobs/JobRunner'
import type { SourceManager } from '../sources'
import type { SkillRegistry } from '../registry'
import { logger } from '../logger'
import type { InstallerRegistry } from './registry'
import type { ResolvedInstall } from './types'
import { reconcileAgents, type ReconcilableSkill } from './agentReconciler'
import {
  canonicalSkillPath,
  defaultPathContext,
  isCanonicalAgentDir,
  type PathContext
} from './paths'
import { removePath } from './fsLink'
import { removeGlobalLockEntry } from '../version'

export interface InstallerServiceDeps {
  jobRunner: JobRunner
  sourceManager: SourceManager
  skillRegistry: SkillRegistry
  configStore: ConfigStore
  registry: InstallerRegistry
  onResult: (result: InstallResult) => void
}

function agentsFrom(ids: string[]): AgentInfo[] {
  return ids.map(getAgent).filter((a): a is AgentInfo => Boolean(a))
}

/** Оркестрация установки и реконсиляции агентов через провайдеры и JobRunner. */
export class InstallerService {
  constructor(private readonly deps: InstallerServiceDeps) {}

  /** Запускает установку skill; возвращает jobId (результат — через onResult + job-события). */
  run(request: InstallRequest): string {
    return this.startInstall(request).jobId
  }

  /** Запускает установку и возвращает jobId + промис результата (для Update Engine). */
  startInstall(request: InstallRequest): {
    jobId: string
    promise: Promise<InstallResult | null>
  } {
    const started = this.deps.jobRunner.start('install', async (ctx) => {
      const source = this.deps.sourceManager.get(request.sourceId)
      if (!source) throw makeAppError('INSTALL_FAILED', 'Источник не найден')

      const entry = this.deps.skillRegistry.get(request.skillId)
      const config = this.deps.configStore.get().install
      const resolved: ResolvedInstall = {
        request,
        source,
        skillName: entry?.name ?? request.sourceRef,
        sourceRef: request.sourceRef,
        agents: agentsFrom(request.targetAgents),
        pathCtx: this.pathContext(request.scope),
        cliPath: config.cliPath,
        npmRegistry: config.npmRegistry
      }
      if (resolved.agents.length === 0) {
        throw makeAppError('INSTALL_FAILED', 'Не выбран ни один целевой агент')
      }

      const provider = this.deps.registry.resolve(source.type)
      const result = await provider.install(resolved, ctx)
      await this.deps.skillRegistry.rescanInstalled()
      return result
    })

    void started.promise.then((result) => {
      if (result) this.deps.onResult(result)
    })
    return started
  }

  /**
   * Удаляет skill из всех агентов: снимает симлинки/копии по известным путям установок,
   * удаляет канонический каталог `.agents/skills/<name>` (для обоих scope) и чистит запись
   * в глобальном `.skill-lock.json`. Возвращает jobId; каталог обновляется через rescan.
   */
  uninstall(skillId: string): string {
    const { jobId } = this.deps.jobRunner.start('install.uninstall', async (ctx) => {
      const entry = this.deps.skillRegistry.get(skillId)
      if (!entry) throw makeAppError('INSTALL_FAILED', 'Skill не найден')
      if (!entry.installed) throw makeAppError('INSTALL_FAILED', 'Skill не установлен')

      ctx.progress(null, `Удаление «${entry.name}»…`)
      // Пути установок конкретных агентов (симлинки/копии) + канон для обоих scope.
      const targets = new Set(entry.installations.map((i) => i.installPath))
      for (const scope of ['global', 'project'] as const) {
        targets.add(canonicalSkillPath(this.pathContext(scope), entry.name))
      }
      let removed = 0
      for (const target of targets) {
        await removePath(target)
        removed += 1
      }
      await removeGlobalLockEntry(entry.name)
      await this.deps.skillRegistry.rescanInstalled()
      logger.info('Skill удалён', { skill: entry.name, paths: removed })
      return { skill: entry.name, removed }
    })
    return jobId
  }

  /** Предпросмотр реконсиляции: список операций link/unlink без изменения ФС (follow-up [13]). */
  previewReconcile(request: ReconcileAgentsRequest): ReconcilePreview {
    const prev = new Set(request.previousAgents)
    const next = new Set(request.nextAgents)
    const pathCtx = this.pathContext(request.scope)
    // Универсальные (канонические) агенты не требуют симлинков — исключаем из операций.
    const nonCanonical = (a: AgentInfo): boolean => !isCanonicalAgentDir(pathCtx, a)
    const added = agentsFrom([...next].filter((a) => !prev.has(a))).filter(nonCanonical)
    const removed = agentsFrom([...prev].filter((a) => !next.has(a))).filter(nonCanonical)
    const skills = this.installedSkills()
    const ops: ReconcileOp[] = []
    for (const skill of skills) {
      for (const agent of added) ops.push({ agent: agent.id, skill: skill.name, action: 'link' })
      for (const agent of removed)
        ops.push({ agent: agent.id, skill: skill.name, action: 'unlink' })
    }
    return {
      addedAgents: added.map((a) => a.id),
      removedAgents: removed.map((a) => a.id),
      skillCount: skills.length,
      ops
    }
  }

  /** Реконсиляция симлинков установленных skills при изменении набора агентов (эпик Q-01). */
  reconcile(request: ReconcileAgentsRequest): string {
    const prev = new Set(request.previousAgents)
    const next = new Set(request.nextAgents)
    const added = agentsFrom([...next].filter((a) => !prev.has(a)))
    const removed = agentsFrom([...prev].filter((a) => !next.has(a)))

    const { jobId } = this.deps.jobRunner.start<ReconcileSummary>(
      'install.reconcileAgents',
      async (ctx) => {
        const skills = this.installedSkills()
        ctx.progress(null, `Реконсиляция: +${added.length} / -${removed.length} агентов`)
        const summary = await reconcileAgents(
          skills,
          added,
          removed,
          this.pathContext(request.scope)
        )
        await this.deps.skillRegistry.rescanInstalled()
        logger.info('Реконсиляция агентов завершена', summary)
        return summary
      }
    )
    return jobId
  }

  private installedSkills(): ReconcilableSkill[] {
    const page = this.deps.skillRegistry.query({
      text: null,
      sourceIds: null,
      statuses: ['installed'],
      sort: 'name-asc',
      page: 0,
      pageSize: 100_000
    })
    return page.items.map((e) => ({
      name: e.name,
      installPaths: e.installations.map((i) => i.installPath)
    }))
  }

  private pathContext(scope: InstallRequest['scope']): PathContext {
    const ctx = defaultPathContext(scope)
    ctx.home = homedir()
    ctx.installDir = this.deps.configStore.get().install.installDir
    return ctx
  }
}
