import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppUpdateStatus } from '@shared/ipc/contract'
import type { AppUpdateSettings } from '@shared/domain/config'
import { logger } from './logger'

const { autoUpdater } = electronUpdater

/**
 * Обёртка над electron-updater (GitHub-провайдер, эпик Q-06).
 * Проверка/загрузка/применение обновлений самого приложения. Независим от
 * обновления skills (Часть 6). В dev-режиме (не упаковано) — no-op.
 */
export class AppUpdater {
  private readonly emit: (status: AppUpdateStatus) => void
  private readonly settings: AppUpdateSettings
  private latestAvailableVersion: string | null = null

  constructor(emit: (status: AppUpdateStatus) => void, settings: AppUpdateSettings) {
    this.emit = emit
    this.settings = settings

    autoUpdater.autoDownload = settings.autoDownload
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null

    autoUpdater.on('checking-for-update', () =>
      this.emit({ state: 'checking', version: null, percent: null, error: null })
    )
    autoUpdater.on('update-available', (info) => {
      this.latestAvailableVersion = info.version
      this.emit({ state: 'available', version: info.version, percent: null, error: null })
    })
    autoUpdater.on('update-not-available', () =>
      this.emit({ state: 'not-available', version: null, percent: null, error: null })
    )
    autoUpdater.on('download-progress', (progress) =>
      this.emit({
        state: 'downloading',
        version: null,
        percent: Math.round(progress.percent),
        error: null
      })
    )
    autoUpdater.on('update-downloaded', (info) =>
      this.emit({ state: 'downloaded', version: info.version, percent: 100, error: null })
    )
    autoUpdater.on('error', (err) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (process.platform === 'darwin' && msg.includes('code signature')) {
        this.emit({
          state: 'manual-download',
          version: this.latestAvailableVersion,
          percent: null,
          error: null
        })
      } else {
        this.emit({
          state: 'error',
          version: null,
          percent: null,
          error: msg
        })
      }
    })
  }

  async checkForUpdates(): Promise<void> {
    if (!app.isPackaged) {
      this.emit({ state: 'not-available', version: null, percent: null, error: null })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      logger.warn('Проверка обновлений приложения не удалась', err)
    }
  }

  quitAndInstall(): void {
    if (!app.isPackaged) return
    autoUpdater.quitAndInstall()
  }

  maybeCheckOnLaunch(): void {
    if (this.settings.checkOnLaunch) void this.checkForUpdates()
  }
}
