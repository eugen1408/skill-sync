import { Tray, Menu, nativeImage, nativeTheme } from 'electron'
import type { LocalePref } from '@shared/i18n/messages'
import { logger } from './logger'
import { resolveLocale, mt, plural } from './i18n'

// Встроенная иконка трея (32×32 PNG), чтобы не тянуть внешний ассет через сборку.
const ICON_NORMAL =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAADUklEQVRYhc3YT4jVVRQH8M+MkYVY4Wu0NjGFLlKKIooCEZRatAgijEioaJEOVrRrq+1a5KIopE0thCmJglaRRo1hLay1kFmLcipyRmRqUKuZ5+LeX+++37/7ZqYXfuHyfr97z73ne88595z7e1xhGBlApoMn4vNhzA6PTh7rMY1ubNOxb2hYlRl/Ck8m72txF9bgBixiTiBbRgfP4l78iAuDEMq5bDfezshcigq/j+00ZvAmNkSZX3A3fl8poTH8jNXxvYsXsYCN2BTbbYlMEybkN+eqzPgdUdEPOCG4byd26HfTKG6JJDfiMTxUWmsxR2YQTEXF2wVrHonvezPzbsU/eodhEfetlExhheNJ37gQxH8KlmjCgTj3CCbj8xcGSzONmNKzToq9GQWb8Rd+xfWWZtlG1FmnQE7B53FsV9I3bjDLNmJKvXVyCnbFeV+qWi9n2Ua0WadNwVqcwd+4s0Z+ya7rRMFT2q1Tp+B9fBafX2uZM25A15Vr1iWD1ax7hCNdzCsSZhtaXVd0TOBgaWxG2E0brsONpb6j+EgoIafxk/6kOIJPhcR5WIi3f28RBaG6mnUWfyyDUBl1tW4EbyX6K7VuTAjIbtJ2ZhRdi2OlOQtChZ8QYuljnMTFklxd21NWsC52HhDS/m+4uYXM0bjQVzgvXC+6eKdGflQI6Acj2eIwpO25tt3v1wu88p0pJXNMuBtNC2Y/KcTLjrbFBY+cS8iciX2NGE12sS9DRiQ0jW2R0He4JkPqw7jOq4J3slgv7HoBb+AlvQyekkkJwbs1GyljlXCKZ+VvrX14VNXXX5fIlAl1hNNyEbc3rPtAXGuyPDCaIXRTTd8k5lvmzOJl4WJ3UH3dejj+fpLRX8FuVQudUi0rqYVEEkUpeaZm3W+EUNhQM9aKcn5K88lxPCK46HxsnWTuJiEVzOg/QWORzImlkilQ5Kc98Xmr3u6Lutf03bZfNTc9HfteWS6hJmzXuxmk7YVE5mrV3PRelLv/vyZEfYzN43VsiTJpblpjmcd9UJRjbC4qK96/jaQP6ZWZrpAUh4ZyjK3G40JGL+5Kc/rvTecM+T+CJmwR3Dev6tpKdf8/8XwNodbqPmyUY62xuq/oS3KJWCfEFnwgxNGVj8uyKzF1pdk1lQAAAABJRU5ErkJggg=='
const ICON_UPD_LIGHT =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAAEJUlEQVRYhc2XXWhcRRTHf7ubGG1IWptkYxWlSKJo8cEKRSGoSZtAqIJKqqioGGhSP6Jv4ouxvknRB63SSvEDlJZqjYhINB80tVYkFRQfArapBOmKNBvZ5gOj2d3xYc4007lz790NRvqHy86de+bMf845c85ZuMSQKEGmDnhIxoeBmXI2mOvoSBeKxecUbAeaZfoU8GVFMrm3ZmjoXDmE0sCPwNXy/jtwK3AudIWFXHv7DqXUu0BNGN+EUt3rRkePmIlkjM4HLDLI+CNgF7AN2Bim46eWlm6l1OEIMgA1KpH4OLd1a5eZiLNQD/BOjMzfwK/AaXkmt6xduzSwefOB6lSqlJAAmK2orGyqGRycrogR/Ax4E6iSdwX0AQWgCR0TzcD1wE1mUUd9PdWpVIlcAKjN5/N9QH8coVuEzBlgHHgY6ALahJxBErhOSDbd39i4h2hXBaHUPUB/XAz1y+9O4FFgGLgbeMqRKwJTwAiwf+OaNWWZR9AE0UHdBtwFnACOoi3SA8wBe4wCH5aUirO8DyqOkLHOS9bcFPAiUA0cwH8pbj49P1+5AkJnogi51rGxj3DXAbz1VTZb6u1ahlJfRBHyWefCUsJd9wjQ+kEm8718LxXnU4XC3jBCUdYxmCLouhohmM8sLvYmlOrm4psYBgV0146NZV1CdcDTwH5591nHhu26Q+icdQ3wBvDzutHRIwmlHgRmI3ScB7quHBkZMBPG127N+ge4lviadRtw0tJTBG4EJo3AXGdnQz6f70Op7cANS0pVTszPV43nclOPpdNbNhw/Pm0rNIp2yYltZGNOB1AL1Dtzw8CAkJoEfhOi9p5fA+3o7uEbrC7CEPLVrGniA9NHyEWg1sm+b1v7B7qIBuAsOsDMc6ECh+AK4JizpgA8ibb4a8DnwASw6Mj5nl53g/Uy+TqQB/4ANkSQGRZFJ4Ac8Je8v+eRT6JblW1CdshDaGfU6XeL0FHArUs2mWPoq59Bm30CHS9tUcrRHvnTInNW5kKRtE7xcgwZhFAGuFMI/QJcHkPqU9HzKto7sUijT11A90TPA2MeMjYhgPc9B3GRQt/iGYIeiMR9BH39nUPGJVSHvi2LWE2bgztE10H3Q1w/dJVn7iCwELFmBngB3djtw98RdMrvYMz+AfQQtNApoNWRsy2EkBgR+Sc8ek+iQ6GxXEJufrLzybfAvWgX5eSps9Y2o1NBlotvUIOQGS+XjIHJT70ybmH59Aqdic04g74MBrsJ5qbHZe6VlRIKQyvafa5Ln7VkLiOYmw6J3O3/NSHwx9gCugXZJDJ2bqpmhde9VLgxNiubmfcfhPSHLJcZhU6KqwY3xqqAHeiMXrSImrFCl420T9lqYxPafQsEXRuo7v8nnvEQiqzuqw031kKre/n/n1aO9ejYAvgEHUeXPv4FwAtyQIclyCEAAAAASUVORK5CYII='
const ICON_UPD_DARK =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAAEa0lEQVRYhc2Xf2iVZRTHP+furhVjYltbvywyZrGkPyKIBlHNXzBWELElFSwa6OyH9V/2T6v+C6k/1EJDsj8KZaVGRFxyG87IGBoE/ZFkGiOciE6ZM1nqvffbH/e87t27977vtpZ04OU+z/Oe5zyf55zznue58D8TS1OQVAes9m6vmZ2dzQIXVq1qKBSLrwnagCU+fBT4NpvJbKnZt+/0jIEkNQA/A7f50EngATM7XX7WpIytXNkh6ROgphyvSV0LBwZ2BwOZFJtPh2Dw9ueS1klaIekuSbE2xjs7uyT1JsAA1Mjsi7Hly9uDgTQPrQU+ToG+BPwB/O7PscKRI1f+2rBhuyYmUlPCZTxbWdlYk8udyaYofgVsBqoCRmA9UAAaKeXEEuBuoCmYdGVoCE1MzJAFgAX5fH490JMGdL/DHAcOAc8C7cAyM1Og5GG70yEbLw8ObiQ5VNNFegLoScuhHv9dAzwP9AGPAy+FlcysaGbDZtZvZtuKp05VzAqmJI2QkNSSlgGPAQfNbL97ZC1wAdgoqbHcXMtm0zwfu2QiEJPeeevqQmbDwJtANbBd0rSklXRfZtGiyjkAHS8LFPVO5PVWyoTO5cPK5uaZfl3hRb8pC0SMdwJJCp2k54CWqra2IX8/UzlfUShsiQVK8U4ANUwkdJJqgI1A3urru03qwvMiRQR0LRgcHJ0CJKlO0svANh+a5p2IhEO3i1LNuh3YZGa/LBwY2G3SM8B4go3zQPuN/f17r27WYaJn1mXgjrQzS9KDwGEmK34RuNfMjgU6F1pb6/P5/HqkNuAey2YrM4sXV2WbmoYLudxDNbncmbDNAGid7zgsoym7A1gA3BQZ6wP2Asf8+dPMiqFNGPAdsBLoBb4ndIsIgOLOrDOkJ2YcUFSmnXW+7kdMenbqLUJSvaQTmirt021PiqQbJB2IzClIetFvA+9L+lrSr5L+Vrp0RxeoldQt6QNJeUmnJN2aANPnhg5KGpM04f0dMfoZv6qscNh9MUBrknb/jivtl1QReReGOSCpWtKIpJPujaJKpSPJfr2kcyGYE5LqkyZkQrt4OwnGx0f8edSBfpN0fQrUHrfznqTaJN1gQoPvuiBps6TXJQ1GYcJA3v40upEY2xWSRiWdjUYgDeqpmFj/GIaJAaqTdFqlRG4qY7fZbe2Mvku7D90SM7bTzC6Wm+D15A1KF7utirkRAK3+m0tZf6pIWhvjoaOSWiJ6Vz3kfZPU7/ovxNg97Klw82yBovUpXE9+kPSkh2jMn7rQ3CUqlYJRhb4gt1mQdGhWMCEDQX3q9vYjod1L0qVQe0SlczGYG5SPHaGxTh97d05ACaAtHr6ovBrSuU6R2iRpl+s9PK9Abjwuxy5K2iRpqeuEa1O15vK5zwIommPjvlggPzn0Z94/6L975h0mBBXNsSpJHSpV9GIINGhLpWOjId36/MMu9fBdjAltd7qF/w7slRig8qf7NQCK5lrZ0332/5/mDlULdHj3SzM7d63W/lfyD5gOxEkFgVcnAAAAAElFTkSuQmCC'

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
