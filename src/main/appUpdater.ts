import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppUpdateStatus } from '@shared/ipc/contract'
import type { AppUpdateSettings } from '@shared/domain/config'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import { once } from 'node:events'
import { fetch } from 'undici'
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

    autoUpdater.autoDownload = process.platform !== 'darwin'
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null

    autoUpdater.on('checking-for-update', () =>
      this.emit({ state: 'checking', version: null, percent: null, error: null })
    )
    autoUpdater.on('update-available', (info) => {
      this.latestAvailableVersion = info.version
      this.emit({ state: 'available', version: info.version, percent: null, error: null })
      if (process.platform === 'darwin') {
        this.isCustomMacUpdate = true
        void this.startCustomMacDownload()
      }
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
      const res = await fetch(`https://api.github.com/repos/eugen1408/skill-sync/releases/tags/v${version}`, {
        headers: { 'User-Agent': 'skill-sync-updater' }
      })
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`)
      const release = (await res.json()) as any
      
      const isArm = process.arch === 'arm64'
      const assets = release.assets || []
      const zipAsset = assets.find((a: any) => a.name.endsWith('.zip') && (isArm ? a.name.includes('arm64') : !a.name.includes('arm64')))
      
      if (!zipAsset) throw new Error(`No .zip asset found for arch ${process.arch}`)
      
      const downloadUrl = zipAsset.browser_download_url
      const zipPath = path.join(os.tmpdir(), `skill-sync-update-${version}.zip`)
      
      const dlRes = await fetch(downloadUrl)
      if (!dlRes.ok) throw new Error(`Download failed with ${dlRes.status}`)
      
      const totalBytes = Number(dlRes.headers.get('content-length')) || 0
      let downloadedBytes = 0

      const dest = fs.createWriteStream(zipPath)
      if (!dlRes.body) throw new Error('No body in response')
      try {
        for await (const chunk of dlRes.body as any) {
          downloadedBytes += chunk.length
          // Уважаем backpressure: не буферизуем весь zip (100+ МБ) в памяти.
          if (!dest.write(chunk)) await once(dest, 'drain')
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100)
            this.emit({ state: 'downloading', percent, version, error: null })
          }
        }
      } finally {
        // Дожидаемся фактической записи на диск перед пометкой «загружено».
        await new Promise<void>((resolve, reject) =>
          dest.end((err?: Error | null) => (err ? reject(err) : resolve()))
        )
      }

      // Проверяем целостность: файл должен быть непустым и совпадать с Content-Length.
      const written = fs.statSync(zipPath).size
      if (written === 0) throw new Error('Downloaded archive is empty')
      if (totalBytes > 0 && written !== totalBytes) {
        throw new Error(`Incomplete download: ${written}/${totalBytes} bytes`)
      }

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
      // Каноничная раскладка Electron: <Name>.app/Contents/MacOS/<exe> → .app на два уровня выше.
      const appPath = path.resolve(path.dirname(exePath), '..', '..')
      const bundleName = path.basename(appPath)

      // Пути передаются как аргументы ($1..$3), а не интерполируются в тело — нет shell-инъекции.
      // Порядок безопасен: сначала распаковываем во временный каталог и проверяем bundle,
      // только потом заменяем текущий .app (со откатом при сбое) — «удаление до проверки» исключено.
      const scriptContent = `#!/bin/bash
set -euo pipefail
sleep 2
ZIP="$1"; APP="$2"; NAME="$3"
STAGE="$(mktemp -d)"
echo "Unzipping new app..."
unzip -q "$ZIP" -d "$STAGE"
if [ ! -d "$STAGE/$NAME" ]; then
  echo "New app bundle not found in archive: $NAME" >&2
  rm -rf "$STAGE"
  exit 1
fi
echo "Swapping app..."
BACKUP="$APP.bak.$$"
mv "$APP" "$BACKUP" 2>/dev/null || true
if ! mv "$STAGE/$NAME" "$APP"; then
  echo "Swap failed, rolling back" >&2
  rm -rf "$APP"
  mv "$BACKUP" "$APP" 2>/dev/null || true
  rm -rf "$STAGE"
  exit 1
fi
rm -rf "$BACKUP" "$STAGE" 2>/dev/null || true
echo "Removing quarantine..."
xattr -rd com.apple.quarantine "$APP" 2>/dev/null || true
echo "Relaunching..."
open "$APP"
`
      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 })

      spawn('bash', [scriptPath, this.customUpdateZipPath, appPath, bundleName], {
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
