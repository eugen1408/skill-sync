import { contextBridge, ipcRenderer } from 'electron'
import { IpcInvoke, IpcEvent } from '@shared/ipc/channels'
import type {
  IpcApi,
  ConfigPatch,
  AppUpdateStatus,
  SourceIndexedEvent,
  CatalogQuery,
  Unsubscribe,
  DeeplinkEvent
} from '@shared/ipc/contract'
import type { AddSourceInput } from '@shared/domain/source'
import type { InstallRequest, InstallResult, ReconcileAgentsRequest } from '@shared/domain/install'
import type { UpdateSettings } from '@shared/domain/config'
import type { UpdateCheckResult } from '@shared/domain/update'
import type { AppNotification } from '@shared/domain/notification'
import type { JobProgressEvent, JobLogEvent, JobDoneEvent, JobErrorEvent } from '@shared/domain/job'

function subscribe<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_event: unknown, payload: unknown): void => cb(payload as T)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: IpcApi = {
  app: {
    getVersion: () => ipcRenderer.invoke(IpcInvoke.app.getVersion),
    checkForUpdates: () => ipcRenderer.invoke(IpcInvoke.app.checkForUpdates),
    quitAndInstall: () => ipcRenderer.send(IpcInvoke.app.quitAndInstall),
    consumePendingDeeplinks: () => ipcRenderer.invoke(IpcInvoke.app.consumePendingDeeplinks),
    reset: () => ipcRenderer.invoke(IpcInvoke.app.reset)
  },
  config: {
    get: () => ipcRenderer.invoke(IpcInvoke.config.get),
    update: (patch: ConfigPatch) => ipcRenderer.invoke(IpcInvoke.config.update, patch)
  },
  jobs: {
    cancel: (jobId: string) => ipcRenderer.invoke(IpcInvoke.jobs.cancel, jobId)
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke(IpcInvoke.dialog.selectDirectory),
    confirm: (opts) => ipcRenderer.invoke(IpcInvoke.dialog.confirm, opts)
  },
  source: {
    list: () => ipcRenderer.invoke(IpcInvoke.source.list),
    add: (input: AddSourceInput) => ipcRenderer.invoke(IpcInvoke.source.add, input),
    remove: (id: string) => ipcRenderer.invoke(IpcInvoke.source.remove, id),
    setEnabled: (id: string, enabled: boolean) =>
      ipcRenderer.invoke(IpcInvoke.source.setEnabled, id, enabled),
    refresh: (id: string) => ipcRenderer.invoke(IpcInvoke.source.refresh, id),
    listSkills: (id: string) => ipcRenderer.invoke(IpcInvoke.source.listSkills, id),
    hideSkill: (id: string, skillName: string) => ipcRenderer.invoke(IpcInvoke.source.hideSkill, id, skillName),
    restoreHiddenSkills: (id: string) => ipcRenderer.invoke(IpcInvoke.source.restoreHiddenSkills, id)
  },
  catalog: {
    query: (query: CatalogQuery) => ipcRenderer.invoke(IpcInvoke.catalog.query, query),
    get: (id: string) => ipcRenderer.invoke(IpcInvoke.catalog.get, id),
    refreshIndex: () => ipcRenderer.invoke(IpcInvoke.catalog.refreshIndex),
    audit: (skillId: string) => ipcRenderer.invoke(IpcInvoke.catalog.audit, skillId),
    officialUrl: (skillId: string) => ipcRenderer.invoke(IpcInvoke.catalog.officialUrl, skillId),
    readme: (skillId: string) => ipcRenderer.invoke(IpcInvoke.catalog.readme, skillId),
    canonicalPath: (skillId: string) =>
      ipcRenderer.invoke(IpcInvoke.catalog.canonicalPath, skillId),
    repoUrl: (skillId: string) => ipcRenderer.invoke(IpcInvoke.catalog.repoUrl, skillId)
  },
  install: {
    run: (request: InstallRequest) => ipcRenderer.invoke(IpcInvoke.install.run, request),
    uninstall: (skillId: string) => ipcRenderer.invoke(IpcInvoke.install.uninstall, skillId),
    reconcileAgents: (request: ReconcileAgentsRequest) =>
      ipcRenderer.invoke(IpcInvoke.install.reconcileAgents, request),
    previewReconcile: (request: ReconcileAgentsRequest) =>
      ipcRenderer.invoke(IpcInvoke.install.previewReconcile, request),
    getInstalledAgents: () => ipcRenderer.invoke(IpcInvoke.install.getInstalledAgents)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(IpcInvoke.shell.openExternal, url),
    openPath: (path: string) => ipcRenderer.invoke(IpcInvoke.shell.openPath, path),
    openInEditor: (path: string) => ipcRenderer.invoke(IpcInvoke.shell.openInEditor, path)
  },
  update: {
    checkAll: () => ipcRenderer.invoke(IpcInvoke.update.checkAll),
    checkOne: (skillId: string) => ipcRenderer.invoke(IpcInvoke.update.checkOne, skillId),
    runOne: (skillId: string) => ipcRenderer.invoke(IpcInvoke.update.runOne, skillId),
    runAll: () => ipcRenderer.invoke(IpcInvoke.update.runAll),
    getSettings: () => ipcRenderer.invoke(IpcInvoke.update.getSettings),
    setSettings: (patch: Partial<UpdateSettings>) =>
      ipcRenderer.invoke(IpcInvoke.update.setSettings, patch)
  },
  notifications: {
    list: () => ipcRenderer.invoke(IpcInvoke.notifications.list),
    markRead: (id: string) => ipcRenderer.invoke(IpcInvoke.notifications.markRead, id),
    markAllRead: () => ipcRenderer.invoke(IpcInvoke.notifications.markAllRead),
    clear: () => ipcRenderer.invoke(IpcInvoke.notifications.clear)
  },
  secrets: {
    available: () => ipcRenderer.invoke(IpcInvoke.secrets.available),
    has: (key: string) => ipcRenderer.invoke(IpcInvoke.secrets.has, key),
    set: (key: string, value: string) => ipcRenderer.invoke(IpcInvoke.secrets.set, key, value),
    delete: (key: string) => ipcRenderer.invoke(IpcInvoke.secrets.delete, key)
  },
  events: {
    onJobProgress: (cb) => subscribe<JobProgressEvent>(IpcEvent.jobProgress, cb),
    onJobLog: (cb) => subscribe<JobLogEvent>(IpcEvent.jobLog, cb),
    onJobDone: (cb) => subscribe<JobDoneEvent>(IpcEvent.jobDone, cb),
    onJobError: (cb) => subscribe<JobErrorEvent>(IpcEvent.jobError, cb),
    onAppUpdateStatus: (cb) => subscribe<AppUpdateStatus>(IpcEvent.appUpdateStatus, cb),
    onSourceIndexed: (cb) => subscribe<SourceIndexedEvent>(IpcEvent.sourceIndexed, cb),
    onCatalogUpdated: (cb) => subscribe<void>(IpcEvent.catalogUpdated, () => cb()),
    onInstallResult: (cb) => subscribe<InstallResult>(IpcEvent.installResult, cb),
    onUpdateChecked: (cb) => subscribe<UpdateCheckResult>(IpcEvent.updateChecked, cb),
    onNotification: (cb) => subscribe<AppNotification>(IpcEvent.notification, cb),
    onDeeplinkReceived: (cb) => subscribe<DeeplinkEvent>(IpcEvent.deeplinkReceived, cb),
    onGithubRateLimit: (cb) => subscribe<void>(IpcEvent.githubRateLimit, () => cb())
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('env', {
  isDemoMode: process.argv.includes('--demo') || !!process.env.SKILL_SYNC_DEMO
})
