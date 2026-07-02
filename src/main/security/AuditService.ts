import type { AuditRisk, AuditProviderResult, SecurityAudit } from '@shared/domain/audit'
import { worstRisk } from '@shared/domain/audit'
import { DEFAULT_OFFICIAL_URL } from '@shared/domain/source'
import { Cache } from '../sources/cache'
import { logger } from '../logger'

type FetchFn = typeof fetch

const AUDIT_TTL_MS = 30 * 60_000
const AUDIT_MAX_ENTRIES = 500

interface V1AuditEntry {
  provider?: string
  slug?: string
  status?: string
  summary?: string
  auditedAt?: string
  riskLevel?: string
}

interface V1AuditResponse {
  audits?: V1AuditEntry[]
}

/** riskLevel (NONE/LOW/MEDIUM/HIGH/CRITICAL) или status (pass/warn/fail) → наша шкала. */
function toRisk(entry: V1AuditEntry): AuditRisk {
  switch (entry.riskLevel?.toUpperCase()) {
    case 'NONE':
      return 'safe'
    case 'LOW':
      return 'low'
    case 'MEDIUM':
      return 'medium'
    case 'HIGH':
      return 'high'
    case 'CRITICAL':
      return 'critical'
  }
  switch (entry.status?.toLowerCase()) {
    case 'pass':
      return 'safe'
    case 'warn':
      return 'medium'
    case 'fail':
      return 'high'
    default:
      return 'unknown'
  }
}

/**
 * Аудит безопасности skill через документированный skills.sh v1 API
 * `GET /api/v1/skills/audit/{source}/{slug}` (провайдеры Agent Trust Hub / Socket / Snyk /
 * Runlayer / ZeroLeaks). Эндпоинт доступен без Vercel OIDC. 404 — аудитов ещё нет.
 * Результаты (включая «пустые») кэшируются на 30 мин.
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
    // source может содержать «/» (owner/repo) — это часть пути, не кодируем целиком.
    const path = `${source}/${skillId}`
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
    const url = `${base}/api/v1/skills/audit/${path}`
    try {
      const res = await this.fetchFn(url, { headers: { Accept: 'application/json' } })
      if (res.status === 404) return { worstRisk: 'unknown', providers: [], description: null }
      if (!res.ok) {
        logger.warn(`skills.sh v1 audit ${source}/${skillId}: HTTP ${res.status}`)
        return { worstRisk: 'unknown', providers: [], description: null }
      }
      const body = (await res.json()) as V1AuditResponse
      return parseAudit(body)
    } catch (err) {
      logger.warn('skills.sh v1 audit недоступен', err)
      return { worstRisk: 'unknown', providers: [], description: null }
    }
  }
}

/** Однострочные оценки-заглушки провайдеров, не годящиеся как описание skill. */
const NON_DESCRIPTIVE = /^(no alerts|risk:|score:|\d+\/\d+ files|no issues)/i

/** Описание из сводки Agent Trust Hub — единственного провайдера с содержательным текстом. */
function pickDescription(audits: V1AuditEntry[]): string | null {
  const ath = audits.find(
    (a) => a.slug === 'agent-trust-hub' || /agent\s*trust\s*hub/i.test(a.provider ?? '')
  )
  const summary = ath?.summary?.trim()
  if (summary && !NON_DESCRIPTIVE.test(summary) && summary.length > 40) return summary
  return null
}

export function parseAudit(body: V1AuditResponse | undefined): SecurityAudit {
  const audits = body?.audits
  if (!Array.isArray(audits) || audits.length === 0) {
    return { worstRisk: 'unknown', providers: [], description: null }
  }
  const providers: AuditProviderResult[] = audits
    .filter((a) => a && (a.provider || a.slug))
    .map((a) => ({
      provider: a.provider ?? a.slug ?? 'unknown',
      risk: toRisk(a),
      summary: typeof a.summary === 'string' ? a.summary : null,
      analyzedAt: typeof a.auditedAt === 'string' ? a.auditedAt : null
    }))
  return {
    worstRisk: worstRisk(providers.map((p) => p.risk)),
    providers,
    description: pickDescription(audits)
  }
}
