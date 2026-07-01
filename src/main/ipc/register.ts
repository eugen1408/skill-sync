import { app, ipcMain } from 'electron'
import { IpcInvoke } from '@shared/ipc/channels'
import type { ConfigPatch, CatalogQuery } from '@shared/ipc/contract'
import type { AddSourceInput } from '@shared/domain/source'
import type { InstallRequest, ReconcileAgentsRequest } from '@shared/domain/install'
import type { UpdateSettings } from '@shared/domain/config'
import type { ConfigStore } from '../config/ConfigStore'
import type { JobRunner } from '../jobs/JobRunner'
import type { AppUpdater } from '../appUpdater'
import type { SourceManager } from '../sources'
import type { SkillRegistry } from '../registry'
import type { InstallerService } from '../installer'
import type { UpdateEngine } from '../update'
import type { NotificationCenter } from '../notifications/NotificationCenter'

export interface IpcDeps {
  configStore: ConfigStore
  jobRunner: JobRunner
  appUpdater: AppUpdater
  sourceManager: SourceManager
  skillRegistry: SkillRegistry
  installerService: InstallerService
  updateEngine: UpdateEngine
  notifications: NotificationCenter
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
    notifications
  } = deps

  ipcMain.handle(IpcInvoke.app.getVersion, () => app.getVersion())
  ipcMain.handle(IpcInvoke.app.checkForUpdates, () => appUpdater.checkForUpdates())
  ipcMain.on(IpcInvoke.app.quitAndInstall, () => appUpdater.quitAndInstall())

  ipcMain.handle(IpcInvoke.config.get, () => configStore.get())
  ipcMain.handle(IpcInvoke.config.update, (_e, patch: ConfigPatch) => configStore.update(patch))

  ipcMain.handle(IpcInvoke.jobs.cancel, (_e, jobId: string) => jobRunner.cancel(jobId))

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

  ipcMain.handle(IpcInvoke.catalog.query, (_e, query: CatalogQuery) => skillRegistry.query(query))
  ipcMain.handle(IpcInvoke.catalog.get, (_e, id: string) => skillRegistry.get(id))
  ipcMain.handle(IpcInvoke.catalog.refreshIndex, () => skillRegistry.refreshIndex())

  ipcMain.handle(IpcInvoke.install.run, (_e, request: InstallRequest) =>
    installerService.run(request)
  )
  ipcMain.handle(IpcInvoke.install.reconcileAgents, (_e, request: ReconcileAgentsRequest) =>
    installerService.reconcile(request)
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
}
