import { describe, it, expect } from 'vitest'
import { parseSemver, compareSemver, maxSemver } from '../src/main/version/semver'

describe('parseSemver', () => {
  it('разбирает major.minor.patch с префиксом v', () => {
    expect(parseSemver('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
  })

  it('патч по умолчанию 0', () => {
    expect(parseSemver('2.5')).toEqual({ major: 2, minor: 5, patch: 0, prerelease: [] })
  })

  it('выделяет pre-release и игнорирует build-метаданные', () => {
    expect(parseSemver('1.0.0-rc.1+build.5')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['rc', '1']
    })
  })

  it('возвращает null для мусора', () => {
    expect(parseSemver('latest')).toBeNull()
    expect(parseSemver(null)).toBeNull()
  })
})

describe('compareSemver', () => {
  it('сравнивает по major/minor/patch', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1)
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1)
    expect(compareSemver('1.2.3', 'v1.2.3')).toBe(0)
  })

  it('стабильный релиз старше pre-release той же версии', () => {
    expect(compareSemver('1.0.0', '1.0.0-rc1')).toBe(1)
    expect(compareSemver('1.0.0-rc1', '1.0.0')).toBe(-1)
  })

  it('сравнивает pre-release по правилам semver', () => {
    expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
    expect(compareSemver('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1) // больше полей — старше
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1) // числовое сравнение
    expect(compareSemver('1.0.0-1', '1.0.0-alpha')).toBe(-1) // числовой < алфавитного
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.1')).toBe(0)
  })

  it('null считается меньше любой валидной версии', () => {
    expect(compareSemver(null, '0.0.1')).toBe(-1)
    expect(compareSemver('0.0.1', null)).toBe(1)
    expect(compareSemver(null, null)).toBe(0)
  })
})

describe('maxSemver', () => {
  it('выбирает наибольшую, стабильную предпочитает pre-release', () => {
    expect(maxSemver(['1.0.0', '1.2.0', '1.1.5'])).toBe('1.2.0')
    expect(maxSemver(['2.0.0-rc.1', '2.0.0', '1.9.9'])).toBe('2.0.0')
    expect(maxSemver(['garbage', 'v3.1.0', 'x'])).toBe('v3.1.0')
    expect(maxSemver(['nope'])).toBeNull()
  })
})
