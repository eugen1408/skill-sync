import { Tray, Menu, nativeImage } from 'electron'
import { logger } from './logger'

// Встроенная иконка трея (32×32 PNG), чтобы не тянуть внешний ассет через сборку.
const ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAgUlEQVR42u2XMRLAIAgEeWIexmPzA63SOJMgF9STsbjS2W3AQy69ZWVkRwE1MkzgARQjLpFIMCTSAy8/o6hABNyUmAH/lJgFf5WgE/DA27eQBCJgTQ4sEAF3S2wl4P0zjkA+gfxTsHwRUazi8xtSFBKKSkZRSilqOcVhQnOa5byOKwr4BGw1kkaqAAAAAElFTkSuQmCC'

export interface TrayDeps {
  show: () => void
  checkUpdates: () => void
  quit: () => void
}

/** Иконка в системном трее с меню (follow-up [8]): открыть, проверить обновления, выход. */
export function createTray(deps: TrayDeps): Tray | null {
  try {
    const image = nativeImage.createFromDataURL(`data:image/png;base64,${ICON_BASE64}`)
    const tray = new Tray(image)
    tray.setToolTip('Skill Sync')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Открыть Skill Sync', click: deps.show },
        { label: 'Проверить обновления', click: deps.checkUpdates },
        { type: 'separator' },
        { label: 'Выход', click: deps.quit }
      ])
    )
    tray.on('click', deps.show)
    return tray
  } catch (err) {
    logger.warn('Не удалось создать иконку трея', err)
    return null
  }
}
