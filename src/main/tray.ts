import { Tray, Menu, nativeImage, nativeTheme } from 'electron'
import type { LocalePref } from '@shared/i18n/messages'
import { logger } from './logger'
import { resolveLocale, mt, plural } from './i18n'

// Встроенная иконка трея (32×32 PNG), чтобы не тянуть внешний ассет через сборку.
const ICON_NORMAL =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAJKADAAQAAAABAAAAJAAAAAAqDuP8AAADpklEQVRYCdWWuWtUURTGJxrBBcHEBXFpsqil4NJEEe1cUEE7S8FG8R8QbMTKRq1csE2jIqQQFGIIKrihViokpog2LmhcwIga/X5xzvO8O/fOvOco6Acf9yzfOedy33t3plL5x9BScj/d0m8S54uvxH5xWPQINdeUHPKCP2GzgYvi9wiJky+ikax5zFMLTiG2GYuNKA/Nj630oFfTuKAONuCb7EvikeqKbzlb62no1RQ6VW2DJmRvD7rhEy+j6Qh6FHanSHnCDbucqHzgNNgxUGubpie9o0gluqS+LR50Va3O9uaYc7ztwpVpzqEnvZlRg9iGEN4QVwfqGYFfxp0eiOnNjOimvHaqnHuiHe8n2fbifpU9SwwxoIDpsUNQQy0aetHT9MxiZobwhHYrs6qaHde6Ueyt+o+00qwsqKEW0Iue9AbMYmYSfcrY7g9XVWyawplVP1w4FavBjoFaetgB0NtqmJnEC2VM2JFU5RO3XA12EdDb5jAzic/KmNB/GckCJUZcDXYR0NvmMDODHaEFXpuh9by4wPkpc7ZLeNuFcyY96W3wMy2WrVdl2c5Zj2aZuLFYYfsK0WMvikuzKD39jCtZJjDa5b904gnZuwKNd7lb+kXfHJtYeO8olIGvit5Wx0xm1+CsIib6Int/jeJXYJnMQdH04UoOTQoHlGCG1TE7h7nyuBtMsDmXzTscuX9MVhOuaOo9cmZYDbNzp7TTJRt9uh+clhv4qfOx7VZmGNp6YJZtij1kF1W3q+I3ph5OKvlR7BPXiqOiAZsYOTRo6+GmS07uodUFipqHJIQp3FdiRyrZKG730JATrnP23zZ73AC/h8kXyv8Kb3HCRuaABPYeYBcFM6yO2e1h4RkneC97XyhI+L+zIXozwzbE7Bq0KfJcNBErx3hc3CO2iDEU2RC19KAXPf0MZjI7ihWKvhF9gdk0jKHIhqi1Pn5lFjMz2EttgScyjplTcPU9vF2knFnMzBD77B9n2Z/He04+x9rr4t5c6Bxvu3BWu0TBvaLde36W1+dsnqf/4rbmsnmHnH8E2EX1zEi+O/kxlcppN+hdYsg2xcmFGyJGLgQb9Xpm1CD15XAnPBSXuoq7srnq2UCPyE+EgUcKeCSGOzLQMwP9GtHwTMZKkZe6MJZLOSqGJxD6aNCW1aukPNpUckocF8ON8A6Q8zcsNjH/DlodPcjRM4nUIwsLaLJe7BT5tIfFQXFMjGGOghvELpF/h/wtuS6+Ff8v/ABwvnDw53SB1gAAAABJRU5ErkJggg=='
const ICON_UPD_LIGHT =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAJKADAAQAAAABAAAAJAAAAAAqDuP8AAAEXklEQVRYCdWYS4wWVRCFb49oICCRwQegLoighLAwMuBjIBPdgQrKsGPBwoSQYFyyYW1cuDGsQCPukMQXAeVhoobI+MAE0RgfYVADBgEVEDAOCH9zvqarrb5/d0+PiYlWcrjnVp26VX/f27cnhPAfs2SM/cyW/hHhFuEX4T1hWPAWa95X8LAXNPG2DdHAJmFFxWJvyrc299dqhgbue3vmpAkDIQnTQxp+Dmm6c8auj8hN/ZptGrpZCZ8Id/nEiP+Qz2dG/jD1hnFhS9/csLB3chxST2Eo6fzx5PTdn/O0MxtnpGHkV1szHfEdwlfCPGGZ0CP4RkqaV/rmLl/QO7nyhydJ6E97Jr6l/MVC9qQqhQqa0YidERKeEGjIjIa2C7ZOSXN86UODSU/P6yauG9NOZ6W27w3i/Lo6I/aMC+4R980QYv4FJDe40yQ0PLolyeMmqtuyWRK8KvSZUGOd9qzTeM7PneZi9ZSDnltVEZrZL9xmonycEM1Hn3bCicY9sBV463KLt+w6+bcJ1syIOIcUe1CYmLHW/6Ru+xqSdAVYNG5opQLz8yDNPCxszedfa/wz560G7hle7SbxqZFL3+X3USaLG1rlkp8T5/5ZLXCWHhDsaYm2spR75kqaflylPnD6XFiy/9CPimWvPBp7XeHYSeHWjF27e77PedNA0/fngk810nhsia6AFYG3SQf4zKXL59d/OTz4zonf0J0S7IjEeeGiPHQLru+KVjto2nLa/ABWYW3LoWZh8Zb9WkRCeE3cnpZzd9Ebncdz5y5R1mRtM1/TfMX4rph1zvhsEakmt8t9RbAc+IxqaeFlTdMz7i0iEenVnP00MQd4MNL46XhN+PPD9DbiI1ZnvMmsbXpqUrvLXpLHRH+Jr+tS/O24W3SfYPp4JIamzp5WgBqWR+2STdWMe8cES0rR8oRH7rfJcuIRTdOWU8NyqF16SnzFLchr3GTnFTTtZfEjbg7HZ3G0TUYt09JD8aWZ7bL4jjXZRgUvCDuEhcJRwQyOjxgatE025IJZD1UfV6eppBvkBXV2UIHldcHR/HYPHXbCRY7/27TfFfA9ZAeKD6ft51InHI1+4PLgbY0aVo/avXHii05wTnxNLKiZ/5OGWJsa1hC1u2yKPD8JJmLkMb4grBLiD7FcmbVpiFzWYC3W9DWoSe1KmyPvacEnGGfBKmvTELm2jh+pRc3C7FCb41uR523ScvRreN4mnVrULKzqtf+miF57vC9rzmPd6vyeTnMTz527yL1DzqcEu/d8La8vcfbTv3GPlqLlCTG/BfC2emrUnp1ymRA2u0K/1xR5TH5icUP4iMVGo15PjS6re3O4Ew4Jd7qMz8S56mmgX+ATYcaWYmyJ2QER9NRAv0AwOyZyr8Chbm33SHlUiJ9APEeDdqx6pYzdpihlkzAixI1wBoj5GxaOz59By2MNYqxZa3VbFiewyGKB/3zg1R4W9glnhSq7Sc4BYZbAX4f8WfKhcEb4f9lV2BNuxvXxiS8AAAAASUVORK5CYII='
const ICON_UPD_DARK =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAJKADAAQAAAABAAAAJAAAAAAqDuP8AAAEyUlEQVRYCdWYXYhVVRTHz7k2VIjljH2o1UOkZmBg9GVaSL05ak7qS8xDD4EERm+95GtDD0JET+rQS0EFlkVFX1CDlGUFmSRpjFrYkJXhaFOojN3d739m73PXPrPPvXceglrwn/3fa/3X3uuc/XFmJsv+Y5bPpB7n3GL0D4CrwSnwUZ7nR2lLS2g+RjNaCjqQrgpiEhWwA2xMjLcH32Pen9Y4t+fUloffuXhybHWWZwsyl53MnHt74bufKdfZMTsWRDFXkbAf3GQTK/wH37+x4s+aZ8ez8aFt2eThb6shasr25c2/Hlrw3gG97cIuCaRNq6cOxTThb4FDYBl4EDSALaSlcW7Zmaef2jB55FDywfM8W+Uas98g/z5QvKmkkGBhvB0VEvaIEgbYDyqoMOIq6E0Qxok0P/ev3JQ3Gq9Nqet/umZzM8v3uhR6uqQxmWJPmOD7thj5ff+g0RyMNbkK7mx5vj6IkktGMYsQvALuCELapBb/GaOxXI8738TqqTa6t2mT+GI+JX5tEPn28kq/c7eZ/VK/BiZdp85btGQUMwv/qyAUcx6uTSq7h/jsKdrtT1fut7YZXAEhHhWEczO43QdVzP3gZd//jvac5101umdyjnY7cWNu3/f+Pipk1YIGTfIzbFDdP48A7aUV9MPbMrK21DnumSxvfJ5S9dxyazbv2eEfiRVHXppwXMW5qNyvNNcUHe4eCjjueW1Djoq+2wu+IGdFQpxzBWzkWK7XTT1rzpUTV2x9ctOlK7m48/w3ELZInMrgF0Cwnjia7iE+HhLE06rYi67H5Fyw0eqS/W6Cu0kKb8u4p9E5xmO5cbeoH3N3y5PZOY0bivhDU7noUKyIe8SvA39L6E18YayKe8SHgti3H1hF+YYI9hFYboLaaF+bfkTRX4bjRVCO4flLPhbpTecAvNzE8Nv83EYihXPDINgkZGusaPWILQF7gzjRKraklREzYo8DzRFsOFLgnQfOhyjtmkhgOsT0yu0ymbSISlO75MTWGLXm1gpNGZ0BE9QxrjV0E0Z7EX7M9MXlCzZROxABRPuDkHZA2rD+i02ivmPt7HmCfwJ9Fu4CJ0AwcfkUk0badrbPBIsapn1cjSBJucS2ERAK48kCLVriOggbIucMOuENjZqcew3/t+kqM0GrBp6yD5wDwfqNsC0lYSQkibcVmyDafpOnuftMuNhgu4zgD/iWSFDTQTdi8roqSGMDzRFs17ThifSCsaDw7Sjtc2AQRB/iMAD+ERAsWRDBHGgMjaUxrWnO3jBe1BJYCk5bteGDkdh3iI8YTV1BKiZlmmupHTds6sLHCTkC2W4FXXA7huVdpGbb/ZylNnXsD5fRLNPOfwGMgfCbowkXdL5xWG7cZe71OB8F4d6zc1l9i/MKtZfsiVvbisYM3VpQtW71miO9d+JpihO308xyFj5tEnzrgGJVk29dYkwVb/U7qxr1606O7oRvwA0SefuKVle9A7rQ9IkIpiWVaUmCfQmRXnNIfycI9hNkOfvndHB0bHmam8EJ0MmkkXZG+o4FpARM0gt2APurCd3CtAcUK29Yce+zexBXYRpD+rb7Jrlk1eL8IPoPhf75oKN9FOzllcd/OuOUoZ9LsxosAvrT6Rj4BP047f/L/gGJj3QfL07iTQAAAABJRU5ErkJggg=='

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
