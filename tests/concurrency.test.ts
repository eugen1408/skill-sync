import { describe, it, expect, afterEach } from 'vitest'
import { cpus } from 'node:os'
import { resolveConcurrency } from '../src/main/util/concurrency'

const ENV = 'SKILLS_TEST_CONCURRENCY'

afterEach(() => {
  delete process.env[ENV]
})

describe('resolveConcurrency', () => {
  it('использует валидный env-override, зажатый в [min,max]', () => {
    process.env[ENV] = '3'
    expect(resolveConcurrency({ envVar: ENV, min: 1, max: 6 })).toBe(3)

    process.env[ENV] = '100'
    expect(resolveConcurrency({ envVar: ENV, min: 1, max: 6 })).toBe(6)

    process.env[ENV] = '0'
    // 0 невалидно (< 1) — падаем на CPU-скейлинг, а не на 0
    expect(resolveConcurrency({ envVar: ENV, min: 2, max: 8 })).toBeGreaterThanOrEqual(2)
  })

  it('игнорирует нечисловой env и масштабируется под CPU в границах', () => {
    process.env[ENV] = 'abc'
    const cores = cpus().length
    const expected = Math.min(8, Math.max(2, cores))
    expect(resolveConcurrency({ envVar: ENV, min: 2, max: 8 })).toBe(expected)
  })

  it('без env берёт число ядер, зажатое в границы', () => {
    const result = resolveConcurrency({ envVar: 'SKILLS_UNSET_XYZ', min: 1, max: 4 })
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(4)
  })
})
