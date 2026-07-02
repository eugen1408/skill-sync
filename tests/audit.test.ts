import { describe, it, expect } from 'vitest'
import { parseAudit } from '../src/main/security/AuditService'
import { worstRisk, isRiskyAudit } from '../src/shared/domain/audit'

describe('parseAudit (v1 audit)', () => {
  it('парсит providers, riskLevel и summary, вычисляет максимальный риск', () => {
    const audit = parseAudit({
      audits: [
        { provider: 'Gen Agent Trust Hub', status: 'pass', summary: 'No risks', riskLevel: 'LOW' },
        { provider: 'Socket', status: 'pass', summary: 'No alerts' },
        { provider: 'Snyk', status: 'fail', summary: 'Issue', riskLevel: 'HIGH' }
      ]
    })
    expect(audit.worstRisk).toBe('high')
    expect(audit.providers).toHaveLength(3)
    const ath = audit.providers.find((p) => p.provider === 'Gen Agent Trust Hub')!
    expect(ath.risk).toBe('low')
    expect(ath.summary).toBe('No risks')
    // без riskLevel — по status (pass → safe)
    expect(audit.providers.find((p) => p.provider === 'Socket')!.risk).toBe('safe')
  })

  it('status без riskLevel: warn → medium, fail → high', () => {
    const a = parseAudit({ audits: [{ provider: 'X', status: 'warn', summary: 's' }] })
    expect(a.worstRisk).toBe('medium')
  })

  it('riskLevel имеет приоритет: NONE → safe, CRITICAL → critical', () => {
    expect(parseAudit({ audits: [{ provider: 'A', riskLevel: 'NONE' }] }).worstRisk).toBe('safe')
    expect(parseAudit({ audits: [{ provider: 'B', riskLevel: 'CRITICAL' }] }).worstRisk).toBe(
      'critical'
    )
  })

  it('description берётся из содержательной сводки Agent Trust Hub', () => {
    const desc =
      'This skill provides a comprehensive set of performance optimization guidelines for React.'
    const a = parseAudit({
      audits: [
        { provider: 'Gen Agent Trust Hub', slug: 'agent-trust-hub', status: 'pass', summary: desc },
        { provider: 'Socket', slug: 'socket', status: 'pass', summary: 'No alerts' }
      ]
    })
    expect(a.description).toBe(desc)
  })

  it('description = null, если сводка ATH — короткая оценка-заглушка', () => {
    expect(
      parseAudit({ audits: [{ slug: 'agent-trust-hub', summary: 'No issues' }] }).description
    ).toBeNull()
    // Нет провайдера ATH → нет описания (у Socket/Snyk сводки не описательные).
    expect(
      parseAudit({ audits: [{ slug: 'socket', summary: 'a'.repeat(80) }] }).description
    ).toBeNull()
  })

  it('пустой/отсутствующий audits → нет данных', () => {
    expect(parseAudit(undefined)).toEqual({
      worstRisk: 'unknown',
      providers: [],
      description: null
    })
    expect(parseAudit({ audits: [] })).toEqual({
      worstRisk: 'unknown',
      providers: [],
      description: null
    })
  })
})

describe('worstRisk / isRiskyAudit', () => {
  it('worstRisk игнорирует unknown', () => {
    expect(worstRisk(['unknown', 'low', 'unknown'])).toBe('low')
    expect(worstRisk([])).toBe('unknown')
    expect(worstRisk(['safe', 'critical', 'medium'])).toBe('critical')
  })

  it('isRiskyAudit срабатывает с medium и выше', () => {
    expect(isRiskyAudit({ worstRisk: 'low', providers: [], description: null })).toBe(false)
    expect(isRiskyAudit({ worstRisk: 'medium', providers: [], description: null })).toBe(true)
    expect(isRiskyAudit(null)).toBe(false)
  })
})
