import { app, BrowserWindow, Notification, session } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IpcEvent } from '@shared/ipc/channels'
import type { AppUpdateStatus } from '@shared/ipc/contract'
import type { AppNotification } from '@shared/domain/notification'
import { ConfigStore } from './config/ConfigStore'
import { JobRunner, type JobEmitter } from './jobs/JobRunner'
import { AppUpdater } from './appUpdater'
import { createSourceManager, GitCache } from './sources'
import { createSkillRegistry } from './registry'
import { createInstallerService } from './installer'
import { createDefaultVersionResolver } from './version'
import { NotificationCenter } from './notifications/NotificationCenter'
import { createUpdateEngine } from './update'
import { SecretStore, GITHUB_TOKEN_KEY, applyGithubTokenEnv } from './secrets/SecretStore'
import { applyProxy } from './net/proxy'
import { registerIpc } from './ipc/register'
import { buildCsp } from './csp'
import { initLogger, logger } from './logger'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function makeJobEmitter(): JobEmitter {
  return {
    progress: (e) => send(IpcEvent.jobProgress, e),
    log: (e) => send(IpcEvent.jobLog, e),
    done: (e) => send(IpcEvent.jobDone, e),
    error: (e) => send(IpcEvent.jobError, e)
  }
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.on('ready-to-show', () => window.show())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  initLogger(join(app.getPath('userData'), 'logs'))

  const configStore = new ConfigStore(join(app.getPath('userData'), 'config.json'), {
    events: { onError: (message, cause) => logger.error(message, cause) }
  })

  // Секреты (safeStorage) + процессная настройка прокси/токена до сетевых операций.
  const secretStore = new SecretStore(join(app.getPath('userData'), 'secrets.bin'))
  applyGithubTokenEnv(secretStore.get(GITHUB_TOKEN_KEY))
  applyProxy(configStore.get().network.proxyUrl)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [buildCsp(!app.isPackaged)]
      }
    })
  })

  mainWindow = createWindow()

  const jobRunner = new JobRunner(makeJobEmitter())
  const appUpdater = new AppUpdater(
    (status: AppUpdateStatus) => send(IpcEvent.appUpdateStatus, status),
    configStore.get().appUpdate
  )

  const notifications = new NotificationCenter({
    emit: (n) => send(IpcEvent.notification, n),
    nativeNotify: (n: AppNotification) => {
      if (Notification.isSupported()) {
        new Notification({ title: n.title, body: n.message }).show()
      }
    }
  })

  const gitCache = new GitCache(join(app.getPath('userData'), 'git-cache'))
  const sourceManager = createSourceManager({ configStore, jobRunner, gitCache })
  sourceManager.onIndexed((result) => {
    send(IpcEvent.sourceIndexed, {
      sourceId: result.source.id,
      status: result.source.status,
      skillCount: result.skills.length,
      error: result.error?.message ?? null
    })
    if (result.error) {
      notifications.add({
        type: 'source_unavailable',
        title: 'Источник недоступен',
        message: `${result.source.name}: ${result.error.message}`,
        sourceId: result.source.id
      })
    }
  })

  const skillRegistry = createSkillRegistry({
    indexPath: join(app.getPath('userData'), 'registry.json'),
    sourceManager,
    onUpdated: () => send(IpcEvent.catalogUpdated, undefined)
  })

  const installerService = createInstallerService({
    jobRunner,
    sourceManager,
    skillRegistry,
    configStore,
    gitCache,
    onResult: (result) => {
      send(IpcEvent.installResult, result)
      if (result.status === 'failed') {
        notifications.add({
          type: 'install_error',
          title: 'Ошибка установки',
          message: result.error?.message ?? 'Установка не удалась',
          skillId: result.skillId
        })
      }
    }
  })

  const updateEngine = createUpdateEngine({
    jobRunner,
    sourceManager,
    skillRegistry,
    installer: installerService,
    resolver: createDefaultVersionResolver(),
    notifications,
    configStore,
    onChecked: (result) => send(IpcEvent.updateChecked, result)
  })

  sourceManager.init()
  void skillRegistry.init()
  updateEngine.start()

  registerIpc({
    configStore,
    jobRunner,
    appUpdater,
    sourceManager,
    skillRegistry,
    installerService,
    updateEngine,
    notifications,
    secretStore
  })
  appUpdater.maybeCheckOnLaunch()

  app.on('will-quit', () => {
    sourceManager.dispose()
    skillRegistry.dispose()
    updateEngine.stop()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
