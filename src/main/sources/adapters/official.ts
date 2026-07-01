import type { Source, RawSkill } from '@shared/domain/source'
import { DEFAULT_OFFICIAL_URL } from '@shared/domain/source'
import { makeAppError } from '@shared/domain/error'
import type { SourceAdapter, IndexContext } from '../types'

type FetchFn = typeof fetch

interface ApiSkill {
  id?: string
  name: string
  slug: string
  description?: string | null
  source?: string
  installs?: number
}

/** Начальные запросы для формирования витрины официального каталога. */
const FEATURED_SEED_QUERIES = [
  'testing',
  'design',
  'security',
  'docs',
  'react',
  'typescript',
  'git',
  'database'
]

const SEARCH_LIMIT = 20

/**
 * Официальный источник skills.sh: получает каталог через API поиска.
 * Без запроса собирает витрину по нескольким seed-запросам (как reference-installer).
 */
export class OfficialSourceAdapter implements SourceAdapter {
  readonly type = 'official' as const
  readonly supportsWatch = false

  constructor(private readonly fetchFn: FetchFn = fetch) {}

  private baseUrl(source: Source): string {
    return source.config.url?.trim() || DEFAULT_OFFICIAL_URL
  }

  async validate(source: Source): Promise<void> {
    try {
      // Достаточно, чтобы базовый URL был валиден.
      new URL(this.baseUrl(source))
    } catch {
      throw makeAppError('SOURCE_UNAVAILABLE', 'Некорректный базовый URL официального каталога')
    }
  }

  async listSkills(source: Source, ctx: IndexContext): Promise<RawSkill[]> {
    const base = this.baseUrl(source)
    const byRef = new Map<string, RawSkill>()
    let done = 0
    for (const query of FEATURED_SEED_QUERIES) {
      if (ctx.signal.aborted) break
      try {
        const skills = await this.search(base, query)
        for (const s of skills) {
          const sourceRef = s.source ? `${s.source}@${s.slug}` : s.slug
          if (!byRef.has(sourceRef)) {
            byRef.set(sourceRef, {
              name: s.name,
              description: s.description ?? null,
              sourceRef,
              ref: null
            })
          }
        }
      } catch (err) {
        ctx.log('err', `Запрос "${query}" не удался: ${(err as Error).message}`)
      }
      done += 1
      ctx.progress(Math.round((done / FEATURED_SEED_QUERIES.length) * 100), `Каталог: ${query}`)
    }
    return [...byRef.values()]
  }

  private async search(base: string, query: string): Promise<ApiSkill[]> {
    const url = `${base.replace(/\/$/, '')}/api/search?q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`
    const res = await this.fetchFn(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      throw makeAppError('SOURCE_UNAVAILABLE', `skills.sh API: HTTP ${res.status}`)
    }
    const body = (await res.json()) as { skills?: ApiSkill[] }
    return body.skills ?? []
  }
}
