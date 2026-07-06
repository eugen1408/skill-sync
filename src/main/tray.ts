import { Tray, Menu, nativeImage, nativeTheme } from 'electron'
import type { LocalePref } from '@shared/i18n/messages'
import { logger } from './logger'
import { resolveLocale, mt, plural } from './i18n'

// Встроенная иконка трея (32×32 PNG), чтобы не тянуть внешний ассет через сборку.
const ICON_NORMAL =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAADM0lEQVRYhcXYTYgcRRQH8F9vNgmCESWJIrrrZ0ZyMag5mOBFyUVQQZBoBHOMEs9iJJho8CJ48SDeXPAQ9exNBRcSQdaV+IUikhyMC5IPRVFilOx6qNdOT0/1TM/sxv1DsT1Vr978u957/1eztMN0jFXHHfgcSzHm0VktMgW+qpApxxex1gYrerKdDJlyHMIu3IyJzN6xT3bQm3bwfQsfF3EKP8Q4iedwS83uS9wVBMciVOAEttXmz+NF3IYtMW7F+hbkO0F6bOzVG6q/sYgna3YTUvh2SeFsCvXtyyEDs+HocdyI7fgTF7CjYU8hJX6dzLfaF0MWD4Sj47X5x3AJZzW/cUfKpSqhT5dLaDYc3Z9Ze0H3ra9p2H84bJ7GB/G8f1wyTadTxZthM4t1mfX3Yn2rlF+/4w9j5tGs5tMpsRYfht1bmfVvpCJYG5/3h+3HRgjdNJ4w/HRKXKWr5gdqZC/i68pcYYTQ1ZV1CU+1IEQKx8965WBr+Hg3Yzs0dCvRs+py8Ixui6mjGrqbZHrdoJ71Rjh/CHdi4wBSpRz8U9l/Un8PK/BJ7Xv+63WF9j2rxAX8iAX8VHlewEyGdL2HFfhOSpM+u0JzzzqNZ3FDjGlJrcvnK0Z4idPSyZESfqrBrjMZzHfjKO6JhaX4wnm837B5Y43og3hkBJI59N0EpsL5S7qJt2aIk/vwkeY8PKG3OJp6Xd2uBxO6mnFY/uZXJ3JcKoD5ytyifBPuSNeY0m5OusYMxLU4o78a9mSIPFzbO4VXY/1gxvcanMOvUum3QqG/Y1dHjkgVm6SKXNBtHyV2hI+jbckwWJ/aqviMbtFUcWREP0MJHcGGFj5K/TlWm/9MEtHrRiHUVA2L8fc3vG54DhwL++3xeXOQmRuFTImO3qqZw05JFsoquSRp1c4GH7vDbiY+l/f0l8chVKLUpyquxD6pDVSrcC8mK3aTklL/JYXonbC9dzmEBmFCqrbysrYk/U57HleHzcGYfw2/SKc7THBXBHfjbemmWM2zR6XQloTP+5//R3C93jzLjVHuWyuGDXhlAKmh7eJyYJCeLfuX7DgYq7tfbuT0bFXCVUdOz3rwLzXbP/VNiQs1AAAAAElFTkSuQmCC'
const ICON_UPD_LIGHT =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAAEGUlEQVRYhcXYW4hVVRgH8N85M5OUM5I5WZnaRR3pKpkPOgSCliFaUYlUlJFEFKJPQYJ5yaKIIggp60GEHpRCKrIQJkXL6kENlaS8oFimkGleycqZs3tYa+eeM+eqDv1hsc/+1re+/d/f+i5rH2rD0Dh6Hbkq8yOxAqPj/fd4DLtrfcCpSZMGdhUKcxKmYEQU78YXjfn8kpaOjsO1EsphO24rkm/HHUiqkfl67NjnbmlufiNP33J8c0ky8/J161algnwFeyNKkIFRmI+7cX0ZGyMfHzRo363Nze9WIAMtSS730fGJE6elgkoeasOuCvMp/sY+7Ilj79V9+szd3N4+tLmhoYbl4GRjU9PwljVrfm+soLRH2J5RRfKjgoeGCV4cgRtxU6rw9ODB6iAD/To7O2djQaUtS/BWkewsrsAJPI8HcDMuww24BwvvbW2th0x8WjKVyjEEM+P1EQxBO85gGcZl9ArYj7V4eVjfvoX6GRlejdAEjMe3+BC/YguexCX4LDVShKRPPn/mPAgl1QgtiNf5RfJVeBGtkVT/4oX5EH/1Ym8lQlnvrC8x/xreEwL5E8FjWXxeN50kWV2JUDnvZDFHiJnxkdx/aMznl/xZKNQTRycaurqWlCI0VAjgSt5JcRYP4wc8hbnpREtHx7FZO3YUqpbygAQz+23YcCRLaKTQp37Gyih7vwZjJ3E/fsOrQp+D4Z8ePtw4d+fO76JOOZzAtP5r136cCnIuQs/CGHwlvOAEoZguxcJTkycv7ezsnC1JpqDtbJI0/Xj6dJ9Nx4/v33Xq1EPLDh06il+yxtriQ0uNd/AspuJ2DKhAahq6hK1M1++N9rPICeGQfc6WVC+n9p6V4kx8o4NCbUp/H8TyEqSLPZ3DT0KY9NBLt2yrnj3rAGbh2jiGYnDm96V1vMQBwXPQJFT9UmhrjMynCwexO+NEEh+4BavLLB5QRHSyEOAXgh7xOiQaXxQn16Na275LqEfl4nCr7secHLbVoNcNeXRExYVKn6mLiXwjJMCWjKygexNO0SYcY1K9Tc4db8tiIA7rmQ2PliByX9HaIXg9zs8rYbsBR3AM11UjkiInpG25rShFJItWISMPCoGcxbhoY0WtZKhcn56o0cZy55Imi8V12qlKaDFaarCR1p+NRfLNQhG9qh5C5bKhEK8n8LbqMbAx6o+J91dGMpvqIZOiTfes2SQcYxc5lyVdQq1qL2NjetRbHu9nxPuXzodQirQ+ZdGMZ4Q2kM3CGch+zTQKlfovYYtWRt2xF0KoEvJCtn2ZIbYPL+DyqDMvyt/EH4J36/pOOl+Mxgf4R/c4e1DY2pTwUT1PAb2Ka3SPs1Jjm+p/dlx0tOCVCqSqtoveQKV6Vuq7rtdxXt29t1Gqnv0v21WMUvWsG/4F9qFm7nX6MeoAAAAASUVORK5CYII='
const ICON_UPD_DARK =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QA/wD/AP+gvaeTAAAEaklEQVRYhb2Xb2hVdRjHP8/1XMPlRMuMSLes7Y4FJZkvcgQDLcF/i2qICRX6IsyYbwwSbNo/iiiCktJexKAXSiGFrVDXRKMMkYlKLyTHhjkVMjfbCpfu7nx7cX53nJ177rn3+u+Bwznn+X2f5/e5v3/PuVCCSaqSVFWK9nrNioDUATuAuc51FFhlZqdK7eCfRYtmjPr+esFSoNa5TwE/eKnU1sqOjgslAUky4ATwUKTpBPCImakozNq1L2d7ez/A928vJDFpzdT9+3flHKmEfLUxMABzgFZJT0i6T1JeDkl1V/bu7c329HyWAANQKbOv/164sDnnSBqhDPB7QrKcXQF6gW539WhgYOPQ6tVVuny5hHAAhrx0uqZyz56/vARRN8H0zIn4+4FW4AGCUawF7gfqxwh376YMGIAp2Wy2BdhccMrcGvko4h4B7gAGzexVM3vKzB4EKoDZwJPAlpHDh8uBCUxaBslrCGCNu68EZgENwDDwhaT5IXjfzE6bWSfwtn/+vF8+ETWJQJIWAI3AITP7yszOmlkX8CIwEfhOUk00zsykq1eHrwFIiUDAZndvjXS4C3gdmO6gpuVF+n73NQD1FASKjM6BaLuZvQdsJ1jI30qaGJF8XzaO1F4QiAKjE7H1QCcB+PZwg5dKbbVJk8pZR4MTRke35gG5mrWShNHJmZmNAM8CvwGrJW3MtU3et+9SxYYNPpZYmca6BdZMOXjw4hiQpDpJR4E/gJ1O+HmxTGY2BDQBfwLvSlrlmmrSjY1exbp1vwJDCSkGgeZpnZ3fjOW8ETVL0jzgJ/cDFxAcptuALf8uWbItm822IC0FMuZ56dTs2bd59fWnverqZ9JNTf1mdiacLKPC9qmktZKWSXpY0p0JUM2SRiWNhOJ7XAkK60zSoUg/XTmdlVGzcjYMnAHOAWdDz+eANiAKPW6k3YycBOpidU5wjPya1Qe8AtzrripgZuh5Uhk/oo+g7ACkCU79OMt4ZiZJKwg+xB51DXIddplZe1ykm74w6GKCBX49Nn69SpolaaakN9zcHpA0ITGD9LikzoR1eMzNQk5vko4X00U7SUnqcMItivmmjgH5xW2ArpDPV6gIh2IzkvpDuiOSaqO6aNAMSRdidsNzMSDLY0b6fde+KSb3BEkXJV2SVJ0IEgoyBdu2kOWBROKnSxqWdE5SOtI23+XYURKMC0o6n54vMUeb06+I+N8qlKfYB1ohq5VUWYLuE3dvifgXAz7QUXKPKrwbfHcflPRxsTUg6Wenn+fe71Jwoh8pGSaULKPxu+aIpAYFx0Jul4xKapfUUCDHCqdrc+8vuPc3ywYKJZ0laWbEN1nSS5JOhoC7XIdeSOdJ6pP0n6S7Je102seuGagIbErSckk/hsB6Jb0maarTbHL+DyUNuNFNPHBvFNxcSV9KuhpZZ0+7qc1ZvyJfATcb7J7IOouz4ypUKm4iWKWkdxKgksvFTYJKOmDz/tfdCqDyq/stgIo7z279dMWA5Z1nUfsfcDeg/yELlZcAAAAASUVORK5CYII='

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
