import { describe, it, expect } from 'vitest'
import { parseAudit } from '../src/main/security/AuditService'
import { worstRisk, isRiskyAudit } from '../src/shared/domain/audit'

describe('parseAudit', () => {
  it('парсит провайдеров и вычисляет максимальный риск', () => {
    const audit = parseAudit({
      ath: { risk: 'safe', analyzedAt: '2026-01-01' },
      socket: { risk: 'safe', alerts: 0, score: 90 },
      snyk: { risk: 'high' },
      zeroleaks: { risk: 'safe', score: 93 }
    })
    expect(audit.worstRisk).toBe('high')
    expect(audit.providers).toHaveLength(4)
    const socket = audit.providers.find((p) => p.provider === 'socket')!
    expect(socket.score).toBe(90)
    expect(socket.alerts).toBe(0)
  })

  it('пустой/отсутствующий вход → нет данных', () => {
    expect(parseAudit(undefined)).toEqual({ worstRisk: 'unknown', providers: [] })
    expect(parseAudit({})).toEqual({ worstRisk: 'unknown', providers: [] })
  })

  it('нераспознанный risk трактуется как unknown', () => {
    const audit = parseAudit({ x: { risk: 'weird' } })
    expect(audit.providers[0].risk).toBe('unknown')
    expect(audit.worstRisk).toBe('unknown')
  })
})

describe('worstRisk / isRiskyAudit', () => {
  it('worstRisk игнорирует unknown', () => {
    expect(worstRisk(['unknown', 'low', 'unknown'])).toBe('low')
    expect(worstRisk([])).toBe('unknown')
    expect(worstRisk(['safe', 'critical', 'medium'])).toBe('critical')
  })

  it('isRiskyAudit срабатывает с medium и выше', () => {
    expect(isRiskyAudit({ worstRisk: 'low', providers: [] })).toBe(false)
    expect(isRiskyAudit({ worstRisk: 'medium', providers: [] })).toBe(true)
    expect(isRiskyAudit({ worstRisk: 'critical', providers: [] })).toBe(true)
    expect(isRiskyAudit(null)).toBe(false)
  })
})
