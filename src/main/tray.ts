import { Tray, Menu, nativeImage, nativeTheme } from 'electron'
import type { LocalePref } from '@shared/i18n/messages'
import { logger } from './logger'
import { resolveLocale, mt, plural } from './i18n'

// Встроенная иконка трея (32×32 PNG), чтобы не тянуть внешний ассет через сборку.
const ICON_NORMAL =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAADCUlEQVRYhe3XTYhWZRQH8J8lheRYUmAfSIINgYUtaiG2CyXMlkGkguRK0oI+Fm5CcFdEm8CVWi3CNhKhaJQJhiEuDCKaqGlMrWmgog9tJEudFue5vM/7zHvv+847M7iZPxy497nnPOd/z3nOOfcyhznMPgZxEN9hH267vnT4EhOZvD2bzuZ1eT6AC8XaBH7AML5PMpzkLP7FrdiLx3EeL+DTmSI9pj1CF3CxWKvkP4wkYvn677i5F2fze9A5gaey+6+xGkvE+RrEfZkMYmGxx2LcK87htHAnxvFruv5YvPFzXez2aY/QOG6aLhl4M234SrpfJlL2N5Y32L2V7C7jijhXK6ZLJo9OnoJtydkxnYtiRSIwJg73lqR/EjdOh1AZnQrzNKfuWHr2TLZ2OK293C+ZuuhUWKZz6jYmx59pj97dotL+0Wfq6qKTo0zdAEZF6a/soN9X6h7CTvEmddGpkKfufRxN12802EwpdetxVatUv+rB5mFcy2yuil5Uh66py/N8KJHKcS45qcMi3FGsHcUBrbFyPpGu8KzoU+fwAY6ISE8idBBPzgChEpdxRmv2DeN1ceYqbMJ7peE60cSq8F/C7Q2OFuC4yfNsD7aKs/QhhkSKOs2+Sj6qc/IgXkwbTYg0dmp+C/BJ0vkcf4o28Ed6qScK/RvELFsjKrckdKDhxRFD90RSfqmBzHHcIsp9FGtF2f+FBxr2P5KRGcej3QjBUvwmxsDqBjIyQrA9PR9Rf76q8t+Je3ohU2G9qJBL4mCOdiBTEoLdmV455ZeKtA5NhUiOX7Tne1REKkdJaL5Wo9xT6O5K68/3Q2bA5AM4ZnLrLwkRH2XfJpvtGdGfRMQX90OoclaS+kYM0orYz0lK3C86c1V5G5L9O/2SgcfwY9poSHTXql+NaH1uTIgPs7JNrE36+VjaUues219HjoXic4OYQ6/i6Q57vCsimGOH9v+503hkCr57xmuaO3CdlL9WM4ZV2qf9NVE9awo5VRA6PFuEYDO+SLK5Rucu7BdVtz/dz2EOs4L/AQbKH59x0RqQAAAAAElFTkSuQmCC'
const ICON_UPD_LIGHT =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAAD5klEQVRYhe3XW4jVVRTH8c+ZGYMxZ9AuNhVSlkNgF4N6iIKidCa8QA/doAJxHrqACl2ICkqwJ6OnDAnSqCg00CIsDZsJJXsoqKDISDPU0kLNHEdFx3POv4e9/8zf/5zr0EQP/WDDOZu19v7utfZe6xz+YyqM9wZDvb1TS+Xy0oT56I7TO/FxW0vLyo4tWw7+a0BHe3ruTZJkDTqqmAwVkqRv8sDA+nEHijDvNbBHUkiS+1KolgbW7sZGIcxvYHI9h6He3qkxMo0cuJAUCmuG5s69ENoacFiP6zJwBSyq5VAql5eqnqZK6iwWi0vwQj2gjgxMqoW4Fbvwcxy74tiD4WK5fFdrSyPBzyhJFjQCNIQ/0JWZO46puAJ35uyL2Hc6SaZPbA4HZtBYyrbjnsz3H3AzLhJS2B0XS0d3eWyPJWkEqAvzcBjX4m304DGsEqL3ed7pyPDwn5Pa289rEmg39V/Z05iIFXHzh4U0voQrqzl9NTi4u0kYkmRjPaAuPCJE57U4twfP4ly8rnJqZj63c+f1J0qlpAmcwdZSaWU9oGx0jmfmV+FT3C6kLq9XDw0PT1h34MAr4r2oowR9nVu3Hqb65esScnoS03NAcDm+Ew40K9rCg3hHuFe3HZ09++6kUFiDzir7DKJvSn//++lEtQhVi06qPUanrkO4W0UsRjJ5YGB924QJMxQKLx4+c2bviVLJqXK5lPCtJFneWizOyMJU0iwswykcwqQatgVsEUK+Dv3x88s1fDZFmydrQaSaj1J0SPB9Az43oJzxKYkFroouwRHhwDMrGWTv0EcRKqu9cZNq6sQFubl+bDDSVvZF6FSLhCa9Fx9gsxDpUUAbseAfAMrrNH4x0vt2CXct23wfwrt5x7nChUzDfxLn19ioHdsy9ulYjUeFu/QhdggpyttlxyfVNrkGj8eFEiGNlUpDu1CLEnyBoziGv+Kh5uXsW3AZ5uCpCkAbahwcocdtj8ZP1IDZJjz9/XH04IxQX66usf7mDMwJ3FIPCKYJbWNY6O7VYGSAiDVIKJbV7lf6/Jfh0kZgUs0XXshJ4WLurwCTByK0l9TunNya04S07mgGJKuDzs73fiFSWeWB2owUytU52+VxfslYYDqMvoC/o7UOEEzBT9FncQb0NyHiU8YClG6Wh/pRaKQp2IE48rpKqMzpy3sg+r85Vhi4A7/GhXYI1TWtV7vxWQZ0pdFloifaZ9tSX7XNmvntO8lI55+J53F/hTXeEiKY1TPO/j/3NW5sYu+GtULtClxtHBsPGLjJ2d2+LLyeObnxZQ5o03gBEf44fhPHwio2F2Ot8OrWxu//63+Ni/4GrCtvytgbISAAAAAASUVORK5CYII='
const ICON_UPD_DARK =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAAEJElEQVRYhe2XW4hVVRjHf+s4JiedYexiWkRZMwRaGdSTQVHMTHijh27QBOI8VAMqdCHqoQR7UnzKkCCVisICTULLGGdCyV6CCoqUtBG1xsSsHMcGs3POr4ezptmzPfucM5YR1B8W7POd7/Lb39prrb3hX6ZwoQsMdXRMK5ZKy4UFQGs07wfeb8jl1jb29Bz/x4BOtrc/oG4AGjNchoJ2Nff1bb7gQBHmnTpqGPTBEahcrcRqq7pN3a9uVJtrxQx1dEyLnannhoMhbBiaN+9ygIY6AjYDN8fr1lhkSbWAYqm0nOxpqqSmQqGwDHihKpDamIAZ0WL1DuAA8G0cB+I4FEI4ay53L6XSOHgAXVgTKIQwpB4DpifMp4FpwHXAPamQgnpkcNGimZ45Mz4gaIH6pmwPcH/i99fAXOAKylPYGpONjFZyufNZLNYEUqcD84ETwE3AG0A70B1CWAccAz5Oxw12dv7k8PAl4wTqh9qr7BngYmBVCOEY8CgwBKxWr88Kapg9u3+cMKDbqgLF7jxGuTuvAIQQDgHPAZOBV9Vzpkadle/uviXk844DZ3BCsbi2KhBju3M6YV8H7ATuArorxL0cmpsnXtTW9hLxuaghga6mXbtOQMbGFbvTDwwDM1NAqNcCX8YbmhNC6I/2TuBNys/VnYNtbfcZwgagKQNmEOia2tv77oghq0NZ3QEqT13cs1YDBWBpCMHmvr7NDRMnthDCi6G5+XDI5wmTJhUJ4Qt05YRCoSUJU6kzc9QV6hn1R3VKFd+g9ljW22pvvF5TJeaD6PNUJkTCeYFadFRf1RFzq1pKxBTVlir+V6o/xxueVcknJJy3U35nSeowUKzC1ARclrL1AlsYPVaOhBD+PEfUJcDGmHsrsCOE0FMJaBuw8G8ASus34CCjZ98Bys9a8vB9JITw1pgodZ5aSLR/WL00q4qaV3d7rtarj6tr1PfUvXGKqunDrCI3qk/ERKrbrbz55dWd0ecT9aR6Sv0l3tT8lH9OvUZtU5+uALSlao/VBnVPdH6yCsxudbI6EEe7+rs6qM6ukn9HAuZX9faqQDHoavWEeladmwUT7QPqQLxeGv/vVys+X44u/xXqVTVhEoELLC/rYfVgLDwGJg0Uf69L+F1U4UYL6t66QVIJjqfme0DNp3zSQA2ObpTrU74ro33Z+cA0eq5+UCdUA4q2qeo3MWZpAvT72PGp4wZKFEtrn9o5AqYeVY9WiL3B8s5cUOerD8f4184LJia9W/0uJtqrbnV0v+pXP0qArjW1TVheeQXHHktdWfXqfvdVp4yc/JbPoeeBhyrkeB3Yl7I9CyS/5z4LIdxWb+26pa6qMJ316FRWzppfrjW0lbFvhQLLKX8IJMenqbg9f7FuttTF6udxLM7wmaFusrzqNqkzLhjQ//rP6w/5ZUo3PIrPhQAAAABJRU5ErkJggg=='

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
