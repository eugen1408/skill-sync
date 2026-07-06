import { Tray, Menu, nativeImage, nativeTheme } from 'electron'
import type { LocalePref } from '@shared/i18n/messages'
import { logger } from './logger'
import { resolveLocale, mt, plural } from './i18n'

// Встроенная иконка трея (32×32 PNG), чтобы не тянуть внешний ассет через сборку.
const ICON_NORMAL =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAJKADAAQAAAABAAAAJAAAAAAqDuP8AAADpklEQVRYCdWWuWtUURTGJxrBBcHEBXFpsqil4NJEEe1cUEE7S8FG8R8QbMTKRq1csE2jIqQQFGIIKrihViokpog2LmhcwIga/X5xzvO8O/fOvOco6Acf9yzfOedy33t3plL5x9BScj/d0m8S54uvxH5xWPQINdeUHPKCP2GzgYvi9wiJky+ikax5zFMLTiG2GYuNKA/Nj630oFfTuKAONuCb7EvikeqKbzlb62no1RQ6VW2DJmRvD7rhEy+j6Qh6FHanSHnCDbucqHzgNNgxUGubpie9o0gluqS+LR50Va3O9uaYc7ztwpVpzqEnvZlRg9iGEN4QVwfqGYFfxp0eiOnNjOimvHaqnHuiHe8n2fbifpU9SwwxoIDpsUNQQy0aetHT9MxiZobwhHYrs6qaHde6Ueyt+o+00qwsqKEW0Iue9AbMYmYSfcrY7g9XVWyawplVP1w4FavBjoFaetgB0NtqmJnEC2VM2JFU5RO3XA12EdDb5jAzic/KmNB/GckCJUZcDXYR0NvmMDODHaEFXpuh9by4wPkpc7ZLeNuFcyY96W3wMy2WrVdl2c5Zj2aZuLFYYfsK0WMvikuzKD39jCtZJjDa5b904gnZuwKNd7lb+kXfHJtYeO8olIGvit5Wx0xm1+CsIib6Int/jeJXYJnMQdH04UoOTQoHlGCG1TE7h7nyuBtMsDmXzTscuX9MVhOuaOo9cmZYDbNzp7TTJRt9uh+clhv4qfOx7VZmGNp6YJZtij1kF1W3q+I3ph5OKvlR7BPXiqOiAZsYOTRo6+GmS07uodUFipqHJIQp3FdiRyrZKG730JATrnP23zZ73AC/h8kXyv8Kb3HCRuaABPYeYBcFM6yO2e1h4RkneC97XyhI+L+zIXozwzbE7Bq0KfJcNBErx3hc3CO2iDEU2RC19KAXPf0MZjI7ihWKvhF9gdk0jKHIhqi1Pn5lFjMz2EttgScyjplTcPU9vF2knFnMzBD77B9n2Z/He04+x9rr4t5c6Bxvu3BWu0TBvaLde36W1+dsnqf/4rbmsnmHnH8E2EX1zEi+O/kxlcppN+hdYsg2xcmFGyJGLgQb9Xpm1CD15XAnPBSXuoq7srnq2UCPyE+EgUcKeCSGOzLQMwP9GtHwTMZKkZe6MJZLOSqGJxD6aNCW1aukPNpUckocF8ON8A6Q8zcsNjH/DlodPcjRM4nUIwsLaLJe7BT5tIfFQXFMjGGOghvELpF/h/wtuS6+Ff8v/ABwvnDw53SB1gAAAABJRU5ErkJggg=='
const ICON_UPD_LIGHT =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAADJUlEQVR4nM2Yu2tUQRTGfzemMIjgRqPio5AYtbBY8M0qol0S0QXTpbAQ0ij+A9bBIk2wioqdqKABSaVCFNGFoCgJiAoxCDFVlGhUTFDjlYEzcnb2zty7G13ywWXPzHwz59t5nXMvLDFEVfLbgKNAC/ABGAbepnAeAOP8Y7QAg0Cc8AxKe5ATF/Kx+9Q6Q2uAEaA1wHknv1uSGuNC3tsxKo1G1Qq6DZwU+zcwBLwEdgLHgQaHX8aJC/limgMtKk1Qq9ojZoqL4szCCLqjxinj+JYlJMr9dxqm7Zwq33XEIOUxVR6rRYzmN3ratwI3gN2qzsf97LFrQqNHzBNgnVPfRB3gLtky4KYSMy+b1OAAsKLegrqAXUrMEeC6lF8Bc/UW1K3sC3L/nJK9tF/NVirc+yUr3xW0T9nX5NeIeA5894zV5NtnWUVpnitolbLfZxkMWOuxM4mKSqM/dNkV9FHZt5IcJGClx04VFZVGXZ8VuO8Exd4UMRuBBcU39oaUPr2Oj3s+YjMwrYhm79gYloTlkn64kX1Y2nzokrEtf1p8V+CKIv0EzgQG3QY88qQasbQZjg9nxYflG99lWC33jiW0p0z5QkCMXr7Qkrcr7rw7S0XVaO6eEL4q7i9gQpUnpM6WDTeEEcUt6lNm0k4LE8dCuAh8k6i+F5hUbZNSNyQcww2hpOy2UAQP4bw8PrwATlAj7AzpJPwg9UNB2WUvAs0SOO16dlQx6EPVz9hZ0aH6zSUd/cuK8AXo+Y+CesSH7Wd8VyAHTDlHdxzolywgWoSgSMbolzG1jynxnYgdwIznXulehKBuz5gz4tMbXN8AfVSHhsB4aegTn3+RdOxfK3scuCrTajNHF+s9tobtuwk4re497cuLnHPiOgPczoRlyMqfC+0dF5dUx1mPk2PS5gqalbYkMZpvfFTAd3LMnWCyp82q7plc9bFcaCZEWJgltUti8VT4kfD3ONloXjZ1ZmyX2JQW1SeFWy2/JuSAASc10XtgwLlhm6VO70GdYgyk7Zusryo54JB8fDBH23yAMEmY79XZvCwclrdgkx2atOQx8Cn7XCwR/AGieUnHyHSpbgAAAABJRU5ErkJggg=='
const ICON_UPD_DARK =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAADL0lEQVR4nM2Yy2sUQRDGfxNzMIjgrkbFx0Fi1IMHwTcqorckoovmloMsQnBR/Ac8Bw+5BC+JiuQiKigiOakQJagQFMWAqBCDEHOKEo2KG9Q40lAttb3TM7MbXfLBsNXdX3d924/qmoF5hqBCfjNwEGgEPgCDwNsEzn1g9F8LagT6gKMRbbeAk2J7OWEhX1Yf9PYH1QhaBgwDTTGcd/K7LqoxLOS9HV1RaQTdBI6J/RsYAF4Cm4HDQJ3DL+GEhXwuyYEWlSSoSe2REMiJMwsj6LYap4QTFvKmnApWlPvvNEzbGVW+44hByiOqPFKNGM2v97SvB64B21Sdj/vZY1eFeo+YR8AKp76BGsBdsgXAdSVmRjapwW5gUa0FtQNblZgDwFUpvwKKtRbUoexzEn+Oy17apWYrEVFBLw3fFbRT2Vfk14h4Bnz3jNXg22dpRWmeK2iJst+nGQxY7rFTiQp6+3/osivoo7JvRDmIwGKPnSgq6O13fZbhnkRb+3QliFkNzCq+sVcl9OlyfNz1EbPApCKavWPvsCgslPQjdJ5BafOhXca2/EnxXYZLivQTOBUz6AZgKEKMfYaE48Np8WH5xncJlkrcsYSWhCmfjRGjly9uyVsUd8adpZxqNLEnDl8V9xcwpspjUmfLhhuHYcXN6VNm0k4Lc4/F4TzwTW71HcC4ahuXugHhGG4cHiu7Oe4Gj8NZeXx4DhyhStgZ0kn4XmqHPcoueRHIysVp17O1gkEfqH7GTotW1a8YdfQvKsIXoPM/CuoUH7af8V2GDDDhHN1RoEeygGAOggIZo0fG1D4mxHckNgFTnrjSMQdBHZ4xp8Sn93J9A3RTGepixktCt/j8i6hj/1rZo8BlmVabObpY6bE1bN81wAkV97QvLzLOiWuL4bZFLENafjFu77i4oDpOe5wckjZX0LS0RYnRfOOjDL6TY2LCC2CtqnsqoT6UgGauCAuzpHZJLJ4IPxD+dicb3SKbOjU2yt2UdKuPC7dSflXIyCcWnZroPdDnRNis1Ok9qFOMvqR9k/ZVJQPsk48P5mibDxAmCfO9OpuXhf3yFmyyQ5OWPAQ+pZ+LeYI/lgM1mC5UEPQAAAAASUVORK5CYII='

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
  /** Текущее предпочтение языка (из конфига) — для локализации меню трея. */
  getLanguage: () => LocalePref
}

/** Иконка в системном трее с динамическим меню обновлений. */
export class AppTray {
  private tray: Tray | null = null

  constructor(private readonly deps: TrayDeps) {
    try {
      const image = nativeImage.createFromBuffer(Buffer.from(ICON_NORMAL, 'base64'), {
        scaleFactor: 2
      })
      image.setTemplateImage(true)
      this.tray = new Tray(image)
      this.tray.on('click', deps.show)
      nativeTheme.on('updated', () => this.rebuild())
      this.rebuild()
    } catch (err) {
      logger.warn('Не удалось создать иконку трея', err)
    }
  }

  rebuild(): void {
    if (!this.tray) return
    const locale = resolveLocale(this.deps.getLanguage())
    const updatable = this.deps.getUpdatableSkills()

    if (updatable.length > 0) {
      const base64 = nativeTheme.shouldUseDarkColors ? ICON_UPD_DARK : ICON_UPD_LIGHT
      const image = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'), {
        scaleFactor: 2
      })
      image.setTemplateImage(false)
      this.tray.setImage(image)

      const word = plural(
        locale,
        updatable.length,
        mt(locale, 'tray.updWordOne'),
        mt(locale, 'tray.updWordFew'),
        mt(locale, 'tray.updWordMany')
      )
      this.tray.setToolTip(mt(locale, 'tray.tooltipCount', { count: updatable.length, word }))
    } else {
      const image = nativeImage.createFromBuffer(Buffer.from(ICON_NORMAL, 'base64'), {
        scaleFactor: 2
      })
      image.setTemplateImage(true)
      this.tray.setImage(image)

      this.tray.setToolTip(mt(locale, 'tray.tooltip'))
    }

    const template: Electron.MenuItemConstructorOptions[] = [
      { label: mt(locale, 'tray.open'), click: this.deps.show },
      { label: mt(locale, 'tray.checkUpdates'), click: this.deps.checkUpdates },
      { type: 'separator' }
    ]

    let updateSubmenu: Electron.MenuItemConstructorOptions[] = []
    if (updatable.length === 0) {
      updateSubmenu = [{ label: mt(locale, 'tray.noUpdates'), enabled: false }]
    } else {
      updateSubmenu.push({ label: mt(locale, 'tray.updateAll'), click: this.deps.updateAll })
      updateSubmenu.push({ type: 'separator' })

      const MAX_ITEMS = 15
      const displayed = updatable.slice(0, MAX_ITEMS)

      for (const skill of displayed) {
        updateSubmenu.push({
          label: skill.name,
          click: () => this.deps.updateOne(skill.skillId)
        })
      }

      if (updatable.length > MAX_ITEMS) {
        updateSubmenu.push({ type: 'separator' })
        updateSubmenu.push({
          label: mt(locale, 'tray.more', { n: updatable.length - MAX_ITEMS }),
          click: this.deps.show
        })
      }
    }

    template.push({ label: mt(locale, 'tray.updates'), submenu: updateSubmenu })
    template.push({ type: 'separator' })
    template.push({ label: mt(locale, 'tray.quit'), click: this.deps.quit })

    this.tray.setContextMenu(Menu.buildFromTemplate(template))
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
