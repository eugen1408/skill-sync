import { resolveLocale, mt } from '../../i18n'
import type { Source, RawSkill } from '@shared/domain/source'
import { DEFAULT_OFFICIAL_URL } from '@shared/domain/source'
import { makeAppError } from '@shared/domain/error'
import type { SourceAdapter, IndexContext } from '../types'

/**
 * Официальный источник skills.sh. Каталог НЕ индексируется в локальный реестр —
 * он живой: поиск идёт через `OfficialCatalog` (`/api/search`) по запросу (v1 leaderboard/
 * curated требуют Vercel OIDC и десктопу недоступны). Адаптер существует только для валидации
 * записи источника; `listSkills` намеренно пуст.
 */
export class OfficialSourceAdapter implements SourceAdapter {
  readonly type = 'official' as const
  readonly supportsWatch = false

  private baseUrl(source: Source): string {
    return source.config.url?.trim() || DEFAULT_OFFICIAL_URL
  }

  async validate(source: Source): Promise<void> {
    try {
      new URL(this.baseUrl(source))
    } catch {
      throw makeAppError('SOURCE_UNAVAILABLE', 'Некорректный базовый URL официального каталога')
    }
  }

  // Официальный каталог живой — индексация отсутствует.
  async listSkills(_source: Source, _ctx: IndexContext): Promise<RawSkill[]> {
    return []
  }
}
