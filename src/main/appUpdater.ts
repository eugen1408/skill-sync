import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppUpdateStatus } from '@shared/ipc/contract'
import type { AppUpdateSettings } from '@shared/domain/config'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import { request } from 'undici'
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
  private customUpdateZipPath: string | null = null
  private isCustomMacUpdate = false

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
        this.isCustomMacUpdate = true
        void this.startCustomMacDownload()
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

  private async startCustomMacDownload(): Promise<void> {
    if (!this.latestAvailableVersion) return
    const version = this.latestAvailableVersion
    this.emit({ state: 'downloading', percent: 0, version, error: null })
    
    try {
      const res = await request(`https://api.github.com/repos/eugen1408/skill-sync/releases/tags/v${version}`, {
        headers: { 'User-Agent': 'skill-sync-updater' }
      })
      if (res.statusCode !== 200) throw new Error(`GitHub API returned ${res.statusCode}`)
      const release = (await res.body.json()) as any
      
      const isArm = process.arch === 'arm64'
      const assets = release.assets || []
      const zipAsset = assets.find((a: any) => a.name.endsWith('.zip') && (isArm ? a.name.includes('arm64') : !a.name.includes('arm64')))
      
      if (!zipAsset) throw new Error(`No .zip asset found for arch ${process.arch}`)
      
      const downloadUrl = zipAsset.browser_download_url
      const zipPath = path.join(os.tmpdir(), `skill-sync-update-${version}.zip`)
      
      const dlRes = await request(downloadUrl, { maxRedirections: 5 } as any)
      if (dlRes.statusCode !== 200 && dlRes.statusCode !== 302) throw new Error(`Download failed with ${dlRes.statusCode}`)
      
      const totalBytes = Number(dlRes.headers['content-length']) || 0
      let downloadedBytes = 0
      
      const dest = fs.createWriteStream(zipPath)
      for await (const chunk of dlRes.body) {
        dest.write(chunk)
        downloadedBytes += chunk.length
        if (totalBytes > 0) {
          const percent = Math.round((downloadedBytes / totalBytes) * 100)
          this.emit({ state: 'downloading', percent, version, error: null })
        }
      }
      dest.end()
      
      this.customUpdateZipPath = zipPath
      this.emit({ state: 'downloaded', version, percent: 100, error: null })
    } catch (err) {
      logger.error('Custom Mac download failed', err)
      this.emit({ state: 'manual-download', version: this.latestAvailableVersion, percent: null, error: null })
    }
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
    
    if (this.isCustomMacUpdate && this.customUpdateZipPath) {
      const scriptPath = path.join(os.tmpdir(), 'skill-sync-install.sh')
      const exePath = app.getPath('exe')
      const appPath = exePath.split('.app/')[0] + '.app'
      
      const scriptContent = `#!/bin/bash
sleep 2
echo "Removing old app..."
rm -rf "${appPath}"
echo "Unzipping new app..."
unzip -q "${this.customUpdateZipPath}" -d "$(dirname "${appPath}")"
echo "Removing quarantine..."
xattr -rd com.apple.quarantine "${appPath}"
echo "Relaunching..."
open "${appPath}"
`
      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 })
      
      spawn('bash', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      }).unref()
      
      app.quit()
      return
    }

    autoUpdater.quitAndInstall()
  }

  maybeCheckOnLaunch(): void {
    if (this.settings.checkOnLaunch) void this.checkForUpdates()
  }
}
