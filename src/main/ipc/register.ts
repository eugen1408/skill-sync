import { app, ipcMain, dialog, shell, BrowserWindow, type OpenDialogOptions } from 'electron'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { IpcInvoke } from '@shared/ipc/channels'
import type { ConfigPatch, CatalogQuery } from '@shared/ipc/contract'
import type { AddSourceInput } from '@shared/domain/source'
import type { InstallRequest, ReconcileAgentsRequest } from '@shared/domain/install'
import type { UpdateSettings } from '@shared/domain/config'
import type { AuditService } from '../security/AuditService'
import type { OfficialCatalog } from '../sources/officialCatalog'
import type { ConfigStore } from '../config/ConfigStore'
import type { JobRunner } from '../jobs/JobRunner'
import type { AppUpdater } from '../appUpdater'
import type { SourceManager } from '../sources'
import type { SkillRegistry } from '../registry'
import type { InstallerService } from '../installer'
import type { UpdateEngine } from '../update'
import type { NotificationCenter } from '../notifications/NotificationCenter'
import { SecretStore, GITHUB_TOKEN_KEY, applyGithubTokenEnv } from '../secrets/SecretStore'
import { applyProxy } from '../net/proxy'

export interface IpcDeps {
  configStore: ConfigStore
  jobRunner: JobRunner
  appUpdater: AppUpdater
  sourceManager: SourceManager
  skillRegistry: SkillRegistry
  installerService: InstallerService
  updateEngine: UpdateEngine
  notifications: NotificationCenter
  secretStore: SecretStore
  auditService: AuditService
  officialCatalog: OfficialCatalog
  /** Базовый URL официального каталога (для ссылок на карточки skills.sh). */
  officialBaseUrl: () => string
}

/** Разбирает official sourceRef `owner/repo@slug` → { source, skillId }. */
function parseOfficialRef(sourceRef: string): { source: string; skillId: string } | null {
  const m = /^(.+)@([^@]+)$/.exec(sourceRef)
  return m ? { source: m[1], skillId: m[2] } : null
}

/**
 * Регистрирует базовые IPC-обработчики (app / config / jobs).
 * Доменные обработчики (source:*, catalog:*, install:*, update:*, notifications:*)
 * регистрируются здесь же по мере реализации Частей 2–6.
 */
export function registerIpc(deps: IpcDeps): void {
  const {
    configStore,
    jobRunner,
    appUpdater,
    sourceManager,
    skillRegistry,
    installerService,
    updateEngine,
    notifications,
    secretStore,
    auditService,
    officialCatalog,
    officialBaseUrl
  } = deps

  ipcMain.handle(IpcInvoke.app.getVersion, () => app.getVersion())
  ipcMain.handle(IpcInvoke.app.checkForUpdates, () => appUpdater.checkForUpdates())
  ipcMain.on(IpcInvoke.app.quitAndInstall, () => appUpdater.quitAndInstall())
  ipcMain.handle(IpcInvoke.app.reset, () => {
    const userData = app.getPath('userData')
    const files = ['config.json', 'secrets.bin', 'registry.json']
    const dirs = ['git-cache']
    for (const file of files) {
      try {
        rmSync(join(userData, file), { force: true })
      } catch (e) {
        // ignore
      }
    }
    for (const dir of dirs) {
      try {
        rmSync(join(userData, dir), { recursive: true, force: true })
      } catch (e) {
        // ignore
      }
    }
    app.relaunch()
    app.quit()
  })

  ipcMain.handle(IpcInvoke.config.get, () => configStore.get())
  ipcMain.handle(IpcInvoke.config.update, (_e, patch: ConfigPatch) => {
    const next = configStore.update(patch)
    // Настройка прокси применяется процессно (fetch + дочерние процессы).
    if (patch.network) applyProxy(next.network.proxyUrl)
    return next
  })

  ipcMain.handle(IpcInvoke.jobs.cancel, (_e, jobId: string) => jobRunner.cancel(jobId))

  ipcMain.handle(IpcInvoke.dialog.selectDirectory, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    const opts: OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  ipcMain.handle(
    IpcInvoke.dialog.confirm,
    async (_e, opts: { message: string; detail?: string; confirmLabel?: string }) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
      const boxOpts = {
        type: 'warning' as const,
        buttons: ['Отмена', opts.confirmLabel ?? 'Продолжить'],
        defaultId: 0,
        cancelId: 0,
        message: opts.message,
        detail: opts.detail
      }
      const { response } = win
        ? await dialog.showMessageBox(win, boxOpts)
        : await dialog.showMessageBox(boxOpts)
      return response === 1
    }
  )

  ipcMain.handle(IpcInvoke.source.list, () => sourceManager.list())
  ipcMain.handle(IpcInvoke.source.add, (_e, input: AddSourceInput) => sourceManager.add(input))
  ipcMain.handle(IpcInvoke.source.remove, (_e, id: string) => {
    sourceManager.remove(id)
  })
  ipcMain.handle(IpcInvoke.source.setEnabled, (_e, id: string, enabled: boolean) =>
    sourceManager.setEnabled(id, enabled)
  )
  ipcMain.handle(IpcInvoke.source.refresh, (_e, id: string) => sourceManager.refresh(id))
  ipcMain.handle(IpcInvoke.source.listSkills, (_e, id: string) => sourceManager.listSkills(id))

  ipcMain.handle(IpcInvoke.catalog.query, async (_e, query: CatalogQuery) => {
    // Официальный каталог — живой: при поиске (≥2 символов) подмешиваем результаты API.
    const officialEnabled = sourceManager.list().some((s) => s.type === 'official' && s.enabled)
    const text = query.text?.trim() ?? ''
    if (!officialEnabled || text.length < 2) return skillRegistry.query(query)
    const skills = await officialCatalog.search(text)
    return skillRegistry.queryWith(query, skillRegistry.buildOfficialEntries(skills))
  })
  ipcMain.handle(IpcInvoke.catalog.get, (_e, id: string) => skillRegistry.get(id))
  ipcMain.handle(IpcInvoke.catalog.refreshIndex, () => skillRegistry.refreshIndex())
  ipcMain.handle(IpcInvoke.catalog.audit, (_e, skillId: string) => {
    const entry = skillRegistry.get(skillId)
    if (!entry || entry.sourceType !== 'official') return null
    const ref = parseOfficialRef(entry.sourceRef)
    return ref ? auditService.get(ref.source, ref.skillId) : null
  })
  ipcMain.handle(IpcInvoke.catalog.officialUrl, (_e, skillId: string) => {
    const entry = skillRegistry.get(skillId)
    if (!entry || entry.sourceType !== 'official') return null
    const ref = parseOfficialRef(entry.sourceRef)
    if (!ref) return null
    // Карточка skill на skills.sh: {base}/{owner/repo}/{slug}.
    const base = officialBaseUrl().replace(/\/$/, '')
    const path = `${ref.source}/${ref.skillId}`
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
    return `${base}/${path}`
  })

  ipcMain.handle(IpcInvoke.shell.openExternal, (_e, url: string) => {
    // Открываем только http/https — защита от file://, javascript: и прочих схем.
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })

  ipcMain.handle(IpcInvoke.install.run, (_e, request: InstallRequest) =>
    installerService.run(request)
  )
  ipcMain.handle(IpcInvoke.install.uninstall, (_e, skillId: string) =>
    installerService.uninstall(skillId)
  )
  ipcMain.handle(IpcInvoke.install.reconcileAgents, (_e, request: ReconcileAgentsRequest) =>
    installerService.reconcile(request)
  )
  ipcMain.handle(IpcInvoke.install.previewReconcile, (_e, request: ReconcileAgentsRequest) =>
    installerService.previewReconcile(request)
  )

  ipcMain.handle(IpcInvoke.update.checkAll, () => updateEngine.checkAll())
  ipcMain.handle(IpcInvoke.update.checkOne, (_e, skillId: string) => updateEngine.checkOne(skillId))
  ipcMain.handle(IpcInvoke.update.runOne, (_e, skillId: string) => updateEngine.runOne(skillId))
  ipcMain.handle(IpcInvoke.update.runAll, () => updateEngine.runAll())
  ipcMain.handle(IpcInvoke.update.getSettings, () => updateEngine.getSettings())
  ipcMain.handle(IpcInvoke.update.setSettings, (_e, patch: Partial<UpdateSettings>) =>
    updateEngine.setSettings(patch)
  )

  ipcMain.handle(IpcInvoke.notifications.list, () => notifications.list())
  ipcMain.handle(IpcInvoke.notifications.markRead, (_e, id: string) => {
    notifications.markRead(id)
  })
  ipcMain.handle(IpcInvoke.notifications.markAllRead, () => {
    notifications.markAllRead()
  })
  ipcMain.handle(IpcInvoke.notifications.clear, () => {
    notifications.clear()
  })

  ipcMain.handle(IpcInvoke.secrets.available, () => secretStore.isAvailable())
  ipcMain.handle(IpcInvoke.secrets.has, (_e, key: string) => secretStore.has(key))
  ipcMain.handle(IpcInvoke.secrets.set, (_e, key: string, value: string) => {
    secretStore.set(key, value)
    if (key === GITHUB_TOKEN_KEY) applyGithubTokenEnv(secretStore.get(GITHUB_TOKEN_KEY))
  })
  ipcMain.handle(IpcInvoke.secrets.delete, (_e, key: string) => {
    secretStore.delete(key)
    if (key === GITHUB_TOKEN_KEY) applyGithubTokenEnv(null)
  })
}
