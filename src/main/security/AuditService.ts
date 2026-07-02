import type { AuditRisk, AuditProviderResult, SecurityAudit } from '@shared/domain/audit'
import { worstRisk } from '@shared/domain/audit'
import { DEFAULT_OFFICIAL_URL } from '@shared/domain/source'
import { Cache } from '../sources/cache'
import { logger } from '../logger'

type FetchFn = typeof fetch

const AUDIT_TTL_MS = 30 * 60_000
const AUDIT_MAX_ENTRIES = 500
const KNOWN_RISKS: AuditRisk[] = ['safe', 'low', 'medium', 'high', 'critical']

interface RawProvider {
  risk?: string
  score?: number
  alerts?: number
  analyzedAt?: string
}

function normalizeRisk(value: unknown): AuditRisk {
  return typeof value === 'string' && (KNOWN_RISKS as string[]).includes(value)
    ? (value as AuditRisk)
    : 'unknown'
}

/**
 * Аудит безопасности skill через skills.sh `/api/audit` (провайдеры ath/socket/snyk/zeroleaks).
 * Отдаёт агрегированную сводку с максимальным риском. Результаты кэшируются (TTL 30 мин),
 * включая «пустые» (нет данных) — чтобы не долбить API. Ошибки/недоступность → пустая сводка.
 */
export class AuditService {
  private readonly cache = new Cache<SecurityAudit>({
    ttlMs: AUDIT_TTL_MS,
    maxEntries: AUDIT_MAX_ENTRIES
  })

  constructor(
    private readonly baseUrl: () => string = () => DEFAULT_OFFICIAL_URL,
    private readonly fetchFn: FetchFn = fetch
  ) {}

  /** source — `owner/repo`; skillId — slug внутри репозитория. */
  async get(source: string, skillId: string): Promise<SecurityAudit> {
    const key = `${source}::${skillId}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const audit = await this.fetchAudit(source, skillId)
    this.cache.set(key, audit)
    return audit
  }

  private async fetchAudit(source: string, skillId: string): Promise<SecurityAudit> {
    const base = this.baseUrl().replace(/\/$/, '')
    const url = `${base}/api/audit?source=${encodeURIComponent(source)}&skills=${encodeURIComponent(skillId)}`
    try {
      const res = await this.fetchFn(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) {
        logger.warn(`skills.sh /api/audit ${source}/${skillId}: HTTP ${res.status}`)
        return { worstRisk: 'unknown', providers: [] }
      }
      const body = (await res.json()) as Record<string, Record<string, RawProvider>>
      return parseAudit(body[skillId])
    } catch (err) {
      logger.warn('skills.sh /api/audit недоступен', err)
      return { worstRisk: 'unknown', providers: [] }
    }
  }
}

export function parseAudit(entry: Record<string, RawProvider> | undefined): SecurityAudit {
  if (!entry || typeof entry !== 'object') return { worstRisk: 'unknown', providers: [] }
  const providers: AuditProviderResult[] = []
  for (const [provider, data] of Object.entries(entry)) {
    if (!data || typeof data !== 'object' || data.risk === undefined) continue
    providers.push({
      provider,
      risk: normalizeRisk(data.risk),
      score: typeof data.score === 'number' ? data.score : null,
      alerts: typeof data.alerts === 'number' ? data.alerts : null,
      analyzedAt: typeof data.analyzedAt === 'string' ? data.analyzedAt : null
    })
  }
  return { worstRisk: worstRisk(providers.map((p) => p.risk)), providers }
}
