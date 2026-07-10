import { homedir } from 'node:os'
import type {
  InstallRequest,
  InstallResult,
  ReconcileAgentsRequest,
  ReconcileSummary,
  ReconcilePreview,
  ReconcileOp,
  InstallPreview,
  InstallOp,
  CliCheckResult
} from '@shared/domain/install'
import type { AgentInfo } from '@shared/domain/agent'
import { getAgent } from '@shared/domain/agent'
import { makeAppError } from '@shared/domain/error'
import type { ConfigStore } from '../config/ConfigStore'
import type { JobRunner, JobContext } from '../jobs/JobRunner'
import type { SourceManager } from '../sources'
import type { SkillRegistry } from '../registry'
import { logger } from '../logger'
import { resolveLocale, mt } from '../i18n'
import type { InstallerRegistry } from './registry'
import type { ResolvedInstall } from './types'
import { reconcileAgents, type ReconcilableSkill } from './agentReconciler'
import {
  agentLinkTargets,
  agentSkillPath,
  canonicalSkillPath,
  defaultPathContext,
  isCanonicalAgentDir,
  type PathContext
} from './paths'
import { isSymlink, pathExists, removePath } from './fsLink'
import { checkCliVersion } from './exec'
import type { CatalogEntry } from '@shared/domain/skill'
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
      const entry = this.deps.skillRegistry.get(request.skillId)

      // Источник недоступен (удалён / осиротевший skill). Если skill уже установлен —
      // «ремонтируем» симлинки агентов из канонической копии, не требуя живого источника
      // (follow-up A1). Иначе — понятная ошибка вместо generic «Источник не найден».
      if (!source) {
        if (entry?.installed) return this.repair(request, entry, ctx)
        throw makeAppError('INSTALL_FAILED', 'Источник не найден', null, {
          skillName: entry?.name,
          sourceId: request.sourceId,
          sourceRef: request.sourceRef,
          suggestion:
            'Источник этого skill удалён или недоступен. Добавьте источник заново или установите skill из другого источника.'
        })
      }

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
      result.wasUpdate = entry?.installed ?? false

      // Гарантируем симлинки для всех целевых агентов после official CLI-установки
      // (follow-up C4): внешний `skills` CLI может не создать ссылку для части агентов
      // (напр. codex). Идемпотентно, канон уже создан CLI. Делаем ДО единственного rescan.
      if (source.type === 'official' && (result.status === 'ok' || result.status === 'skipped')) {
        try {
          await reconcileAgents(
            [{ name: resolved.skillName, installPaths: [] }],
            resolved.agents,
            [],
            resolved.pathCtx
          )
        } catch (e) {
          logger.warn('Реконсиляция агентов после official-установки не удалась', e)
        }
      }
      await this.deps.skillRegistry.rescanInstalled()
      return result
    })

    void started.promise.then((result) => {
      if (result) this.deps.onResult(result)
    })
    return started
  }

  /**
   * Переустановка/ремонт установленного skill без живого источника (follow-up A1):
   * восстанавливает симлинки целевых агентов из канонической копии `.agents/skills/<name>`.
   * Если ни канона, ни известной установки нет — понятная ошибка (skill фактически удалён).
   */
  private async repair(
    request: InstallRequest,
    entry: CatalogEntry,
    ctx: JobContext
  ): Promise<InstallResult> {
    const pathCtx = this.pathContext(request.scope)
    const canonical = canonicalSkillPath(pathCtx, entry.name)
    const installPaths = entry.installations.map((i) => i.installPath)
    const agentIds = request.targetAgents.length
      ? request.targetAgents
      : entry.installations.map((i) => i.agent)
    const agents = agentsFrom(agentIds)

    // Есть ли откуда «посеять» канон, если его нет.
    let hasSeed = await pathExists(canonical)
    if (!hasSeed) {
      for (const p of installPaths) {
        if (await pathExists(p)) {
          hasSeed = true
          break
        }
      }
    }
    if (!hasSeed) {
      throw makeAppError(
        'INSTALL_FAILED',
        `Не найдена копия skill «${entry.name}» для восстановления`,
        null,
        {
          skillName: entry.name,
          expectedPath: canonical,
          suggestion:
            'Канонической копии skill больше нет на диске. Удалите skill и установите заново из источника.'
        }
      )
    }

    ctx.progress(null, `Восстановление «${entry.name}»…`)
    await reconcileAgents([{ name: entry.name, installPaths }], agents, [], pathCtx)
    await this.deps.skillRegistry.rescanInstalled()
    logger.info('Skill восстановлен без источника', { skill: entry.name, agents: agentIds })

    return {
      skillId: request.skillId,
      status: 'ok',
      installedVersion: null,
      wasUpdate: true,
      outcomes: agents.map((a) => ({
        agent: a.id,
        status: 'ok' as const,
        installPath: isCanonicalAgentDir(pathCtx, a)
          ? canonical
          : agentSkillPath(pathCtx, a, entry.name)
      })),
      error: null
    }
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
      const canonical = canonicalSkillPath(pathCtx, skill.name)
      for (const agent of added)
        ops.push({
          agent: agent.id,
          skill: skill.name,
          action: 'link',
          fromPath: canonical,
          toPath: agentSkillPath(pathCtx, agent, skill.name),
          touchesRealFolder: false
        })
      for (const agent of removed)
        ops.push({
          agent: agent.id,
          skill: skill.name,
          action: 'unlink',
          fromPath: agentSkillPath(pathCtx, agent, skill.name),
          toPath: null,
          touchesRealFolder: false
        })
    }
    return {
      addedAgents: added.map((a) => a.id),
      removedAgents: removed.map((a) => a.id),
      skillCount: skills.length,
      ops
    }
  }

  /**
   * Предпросмотр установки/переустановки для файловой модели (local/git): какие пути станут
   * каноном/симлинками и будет ли реальная папка заменена ссылкой (follow-up B1).
   * Для official (CLI сам управляет ФС) возвращает пустой предпросмотр.
   */
  async previewInstall(request: InstallRequest): Promise<InstallPreview> {
    const entry = this.deps.skillRegistry.get(request.skillId)
    const skillName = entry?.name ?? request.sourceRef
    const pathCtx = this.pathContext(request.scope)
    const canonical = canonicalSkillPath(pathCtx, skillName)
    const source = this.deps.sourceManager.get(request.sourceId)

    // official-источник ставится внешним CLI — файловый предпросмотр неприменим.
    if (source?.type === 'official') {
      return { skillName, canonicalPath: canonical, ops: [], replacesRealFolders: false }
    }

    const agents = agentsFrom(request.targetAgents)
    const ops: InstallOp[] = []
    ops.push({
      agent: null,
      action: 'copy-canonical',
      path: canonical,
      target: null,
      replacesRealFolder: false
    })
    // Те же целевые пути, что использует установка (installFromFolder) — единый источник истины.
    for (const { agent, linkPath, isCanonical } of agentLinkTargets(pathCtx, agents, skillName)) {
      // Универсальный агент читает канон напрямую — отдельного симлинка нет.
      if (isCanonical) continue
      const exists = await pathExists(linkPath)
      const sym = exists ? await isSymlink(linkPath) : false
      const replaces = exists && !sym
      ops.push({
        agent: agent.id,
        action: replaces ? 'replace-folder' : 'create-symlink',
        path: linkPath,
        target: canonical,
        replacesRealFolder: replaces
      })
    }
    return {
      skillName,
      canonicalPath: canonical,
      ops,
      replacesRealFolders: ops.some((o) => o.replacesRealFolder)
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
        const locale = resolveLocale(this.deps.configStore.get().ui.language)
        const skills = this.installedSkills()
        ctx.progress(
          null,
          mt(locale, 'reconcile.progress', { added: added.length, removed: removed.length })
        )
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

  /** Проверка работоспособности настроенного CLI (`skills --version`, follow-up UI). */
  checkCli(): Promise<CliCheckResult> {
    return checkCliVersion(this.deps.configStore.get().install.cliPath)
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
