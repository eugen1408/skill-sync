/** Модель результатов внешнего аудита безопасности skill (источник — skills.sh /api/audit). */

export type AuditRisk = 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown'

/** Порядок серьёзности (по возрастанию). `unknown` — нет данных. */
export const RISK_SEVERITY: Record<AuditRisk, number> = {
  unknown: -1,
  safe: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
}

/** Результат одного провайдера аудита (ath / socket / snyk / zeroleaks). */
export interface AuditProviderResult {
  provider: string
  risk: AuditRisk
  score: number | null
  alerts: number | null
  analyzedAt: string | null
}

/** Сводка аудита по skill: агрегат провайдеров + максимальный риск. */
export interface SecurityAudit {
  worstRisk: AuditRisk
  providers: AuditProviderResult[]
}

/** Максимальный риск из набора (без учёта unknown; пусто → unknown). */
export function worstRisk(risks: AuditRisk[]): AuditRisk {
  let worst: AuditRisk = 'unknown'
  for (const r of risks) {
    if (RISK_SEVERITY[r] > RISK_SEVERITY[worst]) worst = r
  }
  return worst
}

/** Требует ли аудит предупреждения перед установкой (medium и выше). */
export function isRiskyAudit(audit: SecurityAudit | null | undefined): boolean {
  return !!audit && RISK_SEVERITY[audit.worstRisk] >= RISK_SEVERITY.medium
}

/** Есть ли вообще данные аудита. */
export function hasAuditData(audit: SecurityAudit | null | undefined): boolean {
  return !!audit && audit.providers.length > 0
}
