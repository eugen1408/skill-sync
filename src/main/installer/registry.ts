import type { SourceType } from '@shared/domain/source'
import type { InstallerProvider } from './types'

/** Реестр провайдеров установки; выбор по типу источника. Расширяется регистрацией. */
export class InstallerRegistry {
  private readonly providers: InstallerProvider[] = []

  register(provider: InstallerProvider): this {
    this.providers.push(provider)
    return this
  }

  resolve(sourceType: SourceType): InstallerProvider {
    const provider = this.providers.find((p) => p.supports(sourceType))
    if (!provider) throw new Error(`Нет провайдера установки для источника типа ${sourceType}`)
    return provider
  }
}
