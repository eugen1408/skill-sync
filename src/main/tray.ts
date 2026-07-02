import { Tray, Menu, nativeImage } from 'electron'
import { logger } from './logger'

// Встроенная иконка трея (32×32 PNG), чтобы не тянуть внешний ассет через сборку.
const ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAgUlEQVR42u2XMRLAIAgEeWIexmPzA63SOJMgF9STsbjS2W3AQy69ZWVkRwE1MkzgARQjLpFIMCTSAy8/o6hABNyUmAH/lJgFf5WgE/DA27eQBCJgTQ4sEAF3S2wl4P0zjkA+gfxTsHwRUazi8xtSFBKKSkZRSilqOcVhQnOa5byOKwr4BGw1kkaqAAAAAElFTkSuQmCC'

/** Русское склонение существительного по числу: 1 обновление, 2 обновления, 5 обновлений. */
function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export interface UpdatableSkill {
  skillId: string
  name: string
  installedVersion: string | null
  latestVersion: string | null
}

export interface TrayDeps {
  show: () => void
  checkUpdates: () => void
  quit: () => void
  getUpdatableSkills: () => UpdatableSkill[]
  updateOne: (skillId: string) => void
  updateAll: () => void
}

/** Иконка в системном трее с динамическим меню обновлений. */
export class AppTray {
  private tray: Tray | null = null

  constructor(private readonly deps: TrayDeps) {
    try {
      const image = nativeImage.createFromDataURL(`data:image/png;base64,${ICON_BASE64}`)
      this.tray = new Tray(image)
      this.tray.on('click', deps.show)
      this.rebuild()
    } catch (err) {
      logger.warn('Не удалось создать иконку трея', err)
    }
  }

  rebuild(): void {
    if (!this.tray) return
    const updatable = this.deps.getUpdatableSkills()

    if (updatable.length > 0) {
      const word = pluralizeRu(updatable.length, 'обновление', 'обновления', 'обновлений')
      this.tray.setToolTip(`Skill Sync (${updatable.length} ${word})`)
    } else {
      this.tray.setToolTip('Skill Sync')
    }

    const template: Electron.MenuItemConstructorOptions[] = [
      { label: 'Открыть Skill Sync', click: this.deps.show },
      { label: 'Проверить обновления', click: this.deps.checkUpdates },
      { type: 'separator' }
    ]

    let updateSubmenu: Electron.MenuItemConstructorOptions[] = []
    if (updatable.length === 0) {
      updateSubmenu = [{ label: 'Нет обновлений', enabled: false }]
    } else {
      updateSubmenu.push({ label: 'Обновить все', click: this.deps.updateAll })
      updateSubmenu.push({ type: 'separator' })

      const MAX_ITEMS = 15
      const displayed = updatable.slice(0, MAX_ITEMS)

      for (const skill of displayed) {
        updateSubmenu.push({
          label: `${skill.name} (${skill.installedVersion || '?'} → ${skill.latestVersion || '?'})`,
          click: () => this.deps.updateOne(skill.skillId)
        })
      }

      if (updatable.length > MAX_ITEMS) {
        updateSubmenu.push({ type: 'separator' })
        updateSubmenu.push({
          label: `И ещё ${updatable.length - MAX_ITEMS}... (открыть приложение)`,
          click: this.deps.show
        })
      }
    }

    template.push({ label: 'Обновления', submenu: updateSubmenu })
    template.push({ type: 'separator' })
    template.push({ label: 'Выход', click: this.deps.quit })

    this.tray.setContextMenu(Menu.buildFromTemplate(template))
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
