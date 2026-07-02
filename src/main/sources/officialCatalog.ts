import { DEFAULT_OFFICIAL_URL } from '@shared/domain/source'
import { Cache } from './cache'
import { logger } from '../logger'

type FetchFn = typeof fetch

const SEARCH_TTL_MS = 60_000
const SEARCH_MAX_ENTRIES = 100
const SEARCH_LIMIT = 50
const MIN_QUERY = 2

/** Позиция живого поиска по официальному каталогу skills.sh. */
export interface OfficialSkill {
  name: string
  slug: string
  /** GitHub owner/repo или well-known домен. */
  source: string
  /** Идентификатор для установки/аудита: `owner/repo@slug`. */
  sourceRef: string
  installs: number
}

interface ApiSkill {
  name: string
  skillId?: string
  slug?: string
  source?: string
  installs?: number
}

/**
 * Живой доступ к официальному каталогу skills.sh через поиск `/api/search` (без Vercel OIDC).
 * Каталог НЕ индексируется в локальный реестр — результаты запрашиваются по мере поиска
 * (документированный v1 leaderboard/curated требует OIDC и десктопу недоступен).
 */
export class OfficialCatalog {
  private readonly cache = new Cache<OfficialSkill[]>({
    ttlMs: SEARCH_TTL_MS,
    maxEntries: SEARCH_MAX_ENTRIES
  })

  constructor(
    private readonly baseUrl: () => string = () => DEFAULT_OFFICIAL_URL,
    private readonly fetchFn: FetchFn = fetch
  ) {}

  async search(query: string): Promise<OfficialSkill[]> {
    const q = query.trim()
    if (q.length < MIN_QUERY) return []
    const base = this.baseUrl().replace(/\/$/, '')
    const key = `${base}::${q.toLowerCase()}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const url = `${base}/api/search?q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`
    try {
      const res = await this.fetchFn(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) {
        logger.warn(`skills.sh /api/search: HTTP ${res.status}`)
        return []
      }
      const body = (await res.json()) as { skills?: ApiSkill[] }
      const skills = (body.skills ?? []).flatMap(mapApiSkill)
      this.cache.set(key, skills)
      return skills
    } catch (err) {
      logger.warn('skills.sh /api/search недоступен', err)
      return []
    }
  }
}

function mapApiSkill(s: ApiSkill): OfficialSkill[] {
  const slug = s.slug ?? s.skillId
  if (!s.name || !slug) return []
  const source = s.source ?? ''
  return [
    {
      name: s.name,
      slug,
      source,
      sourceRef: source ? `${source}@${slug}` : slug,
      installs: typeof s.installs === 'number' ? s.installs : 0
    }
  ]
}
