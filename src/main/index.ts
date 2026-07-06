import { app, BrowserWindow, Notification, session, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IpcEvent, IpcInvoke } from '@shared/ipc/channels'
import type { AppUpdateStatus, DeeplinkEvent } from '@shared/ipc/contract'
import type { AppNotification } from '@shared/domain/notification'
import { DEFAULT_OFFICIAL_URL } from '@shared/domain/source'
import { AuditService } from './security/AuditService'
import { OfficialCatalog } from './sources/officialCatalog'
import { DeeplinkHandler } from './deeplink'
import { AppTray } from './tray'
import { ConfigStore } from './config/ConfigStore'
import { JobRunner, type JobEmitter } from './jobs/JobRunner'
import { AppUpdater } from './appUpdater'
import { createSourceManager, GitCache, type SourceManager } from './sources'
import { createSkillRegistry, buildLockAttribution, type SkillRegistry } from './registry'
import { readGlobalLock } from './version'
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
let tray: AppTray | null = null
let isQuitting = false

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

/** Показывает окно (создаёт заново, если было закрыто). */
function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function makeJobEmitter(): JobEmitter {
  return {
    progress: (e) => send(IpcEvent.jobProgress, e),
    log: (e) => send(IpcEvent.jobLog, e),
    done: (e) => send(IpcEvent.jobDone, e),
    error: (e) => send(IpcEvent.jobError, e)
  }
}

/**
 * Атрибуция установленных skills к источникам по `.skill-lock.json` (Часть 8):
 * читает глобальный lock, классифицирует источники (custom git vs skills.sh), добавляет
 * недостающие git-источники, передаёт карту атрибуции в реестр и пересобирает индекс.
 */
async function seedSourcesFromLock(
  sourceManager: SourceManager,
  skillRegistry: SkillRegistry,
  officialCatalog: OfficialCatalog
): Promise<void> {
  const lock = await readGlobalLock()
  if (Object.keys(lock).length === 0) return

  const { sourcesToEnsure, attribution } = await buildLockAttribution(lock, (ownerRepo, name) =>
    officialCatalog.repoPublished(ownerRepo, name)
  )

  for (const s of sourcesToEnsure) {
    try {
      await sourceManager.add({
        type: 'git',
        name: s.name,
        config: { url: s.url, ref: s.ref, authMode: s.authMode }
      })
    } catch (err) {
      // Дубликат/уже подключён/невалидный URL — атрибутируем к существующему, старт не рвём.
      logger.debug(`Источник из lock не добавлен (${s.url}): ${(err as Error).message}`)
    }
  }

  skillRegistry.setLockAttribution(attribution)
  await skillRegistry.refreshIndex()
}

function createWindow(): BrowserWindow {
  // Новый экземпляр renderer'а ещё не подписан — до его запроса диплинки буферизуем.
  rendererReady = false
  const iconPath = join(__dirname, '../../build/icon.png')
  if (!app.isPackaged && process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath)
  }

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(!app.isPackaged ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.on('ready-to-show', () => window.show())

  // Закрытие окна сворачивает в трей (фоновые проверки продолжаются), пока не выбран «Выход».
  window.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault()
      window.hide()
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// Буфер диплинков, полученных до готовности renderer'а (холодный старт по `skill://`):
// событие `open-url` на macOS может прийти раньше, чем окно/подписка renderer'а готовы,
// поэтому такие ссылки копятся здесь и забираются renderer'ом при монтировании.
let rendererReady = false
let pendingDeeplinks: DeeplinkEvent[] = []

function deliverDeeplink(url: string, parsed: DeeplinkEvent['parsed']): void {
  const event: DeeplinkEvent = { url, parsed }
  // Окно показываем только когда приложение готово (иначе BrowserWindow бросит исключение).
  if (app.isReady()) showWindow()
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    send(IpcEvent.deeplinkReceived, event)
  } else {
    pendingDeeplinks.push(event)
  }
}

// Регистрируем обработчик протокола и `open-url` до `whenReady`, чтобы не потерять
// диплинк холодного старта на macOS.
const deeplinkHandler = new DeeplinkHandler(deliverDeeplink)
deeplinkHandler.setup()

// Renderer забирает накопленные диплинки при монтировании и помечает себя готовым;
// с этого момента последующие ссылки доставляются событием сразу.
ipcMain.handle(IpcInvoke.app.consumePendingDeeplinks, (): DeeplinkEvent[] => {
  rendererReady = true
  const buffered = pendingDeeplinks
  pendingDeeplinks = []
  return buffered
})

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
    onUpdated: () => {
      send(IpcEvent.catalogUpdated, undefined)
      tray?.rebuild()
    }
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

  const officialBaseUrl = (): string => {
    const official = configStore.get().sources.find((s) => s.type === 'official' && s.enabled)
    return official?.config.url?.trim() || DEFAULT_OFFICIAL_URL
  }
  const auditService = new AuditService(officialBaseUrl)
  const officialCatalog = new OfficialCatalog(officialBaseUrl)

  const updateEngine = createUpdateEngine({
    jobRunner,
    sourceManager,
    skillRegistry,
    installer: installerService,
    resolver: createDefaultVersionResolver(),
    notifications,
    configStore,
    gitCache,
    officialCatalog,
    auditService,
    onChecked: (result) => {
      send(IpcEvent.updateChecked, result)
      tray?.rebuild()
    }
  })

  sourceManager.init()
  // skills.sh добавляется по умолчанию как источник, но НЕ индексируется —
  // его каталог живой (OfficialCatalog, поиск по API при запросе).
  sourceManager.ensureDefaultOfficial()
  // Быстрый старт из индекса, затем атрибуция установленных skills к источникам
  // по `.skill-lock.json` (Часть 8): восстановление источников и переклассификация.
  const registryReady = skillRegistry
    .init()
    .then(() => seedSourcesFromLock(sourceManager, skillRegistry, officialCatalog))
    .catch((err) => logger.error('Ошибка атрибуции установленных skills из lock', err))
  // Проверка при запуске стартует только после готовности реестра — иначе она
  // отработает по пустому набору и все skills останутся в статусе «Неизвестно».
  updateEngine.start(registryReady)

  tray = new AppTray({
    show: showWindow,
    checkUpdates: () => updateEngine.checkAll(),
    quit: () => {
      isQuitting = true
      app.quit()
    },
    getUpdatableSkills: () => {
      return skillRegistry
        .visibleEntries()
        .filter((s) => s.updateStatus === 'update_available')
        .map((s) => ({
          skillId: s.id,
          name: s.name,
          installedVersion: s.installations[0]?.installedVersion ?? null,
          latestVersion: s.latestVersion
        }))
    },
    updateOne: (skillId) => updateEngine.runOne(skillId),
    updateAll: () => updateEngine.runAll(),
    getLanguage: () => configStore.get().ui.language
  })

  registerIpc({
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
    gitCache,
    officialBaseUrl,
    onUiChanged: () => tray?.rebuild()
  })
  appUpdater.maybeCheckOnLaunch()

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('will-quit', () => {
    sourceManager.dispose()
    skillRegistry.dispose()
    updateEngine.stop()
    tray?.destroy()
    tray = null
  })

  app.on('activate', () => showWindow())
})

app.on('second-instance', (_event, argv) => {
  showWindow()
  deeplinkHandler.handleSecondInstance(argv)
})

app.on('window-all-closed', () => {
  // При активном трее приложение продолжает работать в фоне (фоновые проверки).
  if (!tray && process.platform !== 'darwin') app.quit()
})
