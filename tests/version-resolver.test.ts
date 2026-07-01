import { describe, it, expect } from 'vitest'
import { StrategyRegistry } from '../src/main/version/registry'
import { VersionResolver } from '../src/main/version/VersionResolver'
import { SkillFolderHashStrategy } from '../src/main/version/strategies/skillFolderHash'
import { GitTagStrategy } from '../src/main/version/strategies/gitTag'
import { compareSemver, maxSemver } from '../src/main/version/semver'
import { parseGithubRepo } from '../src/main/version/parseRepo'
import type { VersionPorts, ResolveContext, VersionStrategy } from '../src/main/version/types'

function fakePorts(over: Partial<VersionPorts> = {}): VersionPorts {
  return {
    github: { getFolderTreeSha: async () => null, ...over.github },
    git: {
      listRemoteTags: async () => [],
      getRemoteRefSha: async () => null,
      lastCommitShaForPath: async () => null,
      ...over.git
    },
    files: {
      computeFolderHash: async () => 'localhash',
      readChangelogTopVersion: async () => null,
      ...over.files
    }
  }
}

function ctx(over: Partial<ResolveContext> = {}): ResolveContext {
  return {
    skillId: 's1',
    sourceType: 'git',
    installPath: null,
    lockEntry: null,
    repo: { url: null, ref: null, skillPath: null },
    localPath: null,
    ...over
  }
}

describe('semver utils', () => {
  it('сравнивает и выбирает максимум', () => {
    expect(compareSemver('1.2.0', '1.10.0')).toBe(-1)
    expect(compareSemver('v2.0.0', '1.9.9')).toBe(1)
    expect(maxSemver(['v1.0.0', 'v1.2.3', 'nope', '1.2.0'])).toBe('v1.2.3')
  })
})

describe('parseGithubRepo', () => {
  it('разбирает форматы URL', () => {
    expect(parseGithubRepo('https://github.com/o/r')).toEqual({ owner: 'o', repo: 'r' })
    expect(parseGithubRepo('git@github.com:o/r.git')).toEqual({ owner: 'o', repo: 'r' })
    expect(parseGithubRepo('o/r')).toEqual({ owner: 'o', repo: 'r' })
    expect(parseGithubRepo(null)).toBeNull()
  })
})

describe('SkillFolderHashStrategy', () => {
  it('находит обновление при расхождении хэшей (lock vs GitHub tree)', async () => {
    const ports = fakePorts({ github: { getFolderTreeSha: async () => 'NEWSHA' } })
    const s = new SkillFolderHashStrategy(ports)
    const c = ctx({
      lockEntry: { source: 'o/r', sourceType: 'github', skillFolderHash: 'OLDSHA' },
      repo: { url: 'https://github.com/o/r', ref: 'main', skillPath: 'skills/x/SKILL.md' }
    })
    expect(s.isApplicable(c)).toBe(true)
    expect(await s.resolveInstalled(c)).toBe('OLDSHA')
    expect(await s.resolveLatest(c)).toBe('NEWSHA')
    expect(s.compare('OLDSHA', 'NEWSHA')).toBe(true)
    expect(s.compare('SAME', 'SAME')).toBe(false)
  })

  it('локальный источник использует computedHash содержимого', async () => {
    const ports = fakePorts({
      files: { computeFolderHash: async () => 'H', readChangelogTopVersion: async () => null }
    })
    const s = new SkillFolderHashStrategy(ports)
    const c = ctx({ sourceType: 'local', localPath: '/src', installPath: '/inst' })
    expect(s.isApplicable(c)).toBe(true)
    expect(await s.resolveLatest(c)).toBe('H')
  })
})

describe('GitTagStrategy', () => {
  it('latest = максимальный semver-тег, обновление при большем latest', async () => {
    const ports = fakePorts({
      git: {
        listRemoteTags: async () => ['v1.0.0', 'v1.4.2', 'v1.2.0'],
        getRemoteRefSha: async () => null,
        lastCommitShaForPath: async () => null
      }
    })
    const s = new GitTagStrategy(ports)
    const c = ctx({
      repo: { url: 'https://github.com/o/r', ref: null, skillPath: null },
      lockEntry: { source: 'o/r', sourceType: 'github', ref: 'v1.2.0' }
    })
    expect(await s.resolveLatest(c)).toBe('v1.4.2')
    expect(await s.resolveInstalled(c)).toBe('v1.2.0')
    expect(s.compare('v1.2.0', 'v1.4.2')).toBe(true)
    expect(s.compare('v1.4.2', 'v1.4.2')).toBe(false)
  })
})

describe('VersionResolver', () => {
  it('пропускает неприменимые/пустые стратегии и берёт первую результативную', async () => {
    const notApplicable: VersionStrategy = {
      id: 'na',
      isApplicable: () => false,
      resolveInstalled: async () => 'x',
      resolveLatest: async () => 'x',
      compare: () => true
    }
    const nullLatest: VersionStrategy = {
      id: 'nl',
      isApplicable: () => true,
      resolveInstalled: async () => null,
      resolveLatest: async () => null,
      compare: () => false
    }
    const winner: VersionStrategy = {
      id: 'win',
      isApplicable: () => true,
      resolveInstalled: async () => '1.0.0',
      resolveLatest: async () => '2.0.0',
      compare: () => true
    }
    const registry = new StrategyRegistry()
      .register(notApplicable, 10)
      .register(nullLatest, 20)
      .register(winner, 30)
    const info = await new VersionResolver(registry).resolve(ctx())
    expect(info).toMatchObject({
      resolvedBy: 'win',
      installedVersion: '1.0.0',
      latestVersion: '2.0.0',
      hasUpdate: true,
      unknown: false
    })
  })

  it('возвращает unknown, когда ни одна стратегия не применима', async () => {
    const registry = new StrategyRegistry()
    const info = await new VersionResolver(registry).resolve(ctx())
    expect(info.unknown).toBe(true)
    expect(info.hasUpdate).toBe(false)
  })

  it('расширяемость: кастомная стратегия с высшим приоритетом побеждает', async () => {
    const custom: VersionStrategy = {
      id: 'custom',
      isApplicable: () => true,
      resolveInstalled: async () => 'a',
      resolveLatest: async () => 'b',
      compare: () => true
    }
    const registry = new StrategyRegistry().register(custom, 1)
    const info = await new VersionResolver(registry).resolve(ctx())
    expect(info.resolvedBy).toBe('custom')
  })
})
