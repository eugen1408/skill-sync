import { describe, it, expect } from 'vitest'
import { GitCommitShaStrategy } from '../src/main/version/strategies/gitCommitSha'
import type { VersionPorts, ResolveContext } from '../src/main/version/types'

function ports(over: Partial<VersionPorts['git']> = {}): VersionPorts {
  return {
    github: { getFolderTreeSha: async () => null },
    git: {
      listRemoteTags: async () => [],
      getRemoteRefSha: async () => null,
      lastCommitShaForPath: async () => null,
      ...over
    },
    files: { computeFolderHash: async () => '', readChangelogTopVersion: async () => null }
  }
}

function ctx(over: Partial<ResolveContext> = {}): ResolveContext {
  return {
    skillId: 's',
    sourceType: 'git',
    installPath: null,
    lockEntry: null,
    repo: { url: 'https://github.com/o/r', ref: null, skillPath: null },
    localPath: null,
    ...over
  }
}

describe('GitCommitShaStrategy', () => {
  it('сравнивает SHA по общему префиксу (7 vs 40 символов)', () => {
    const s = new GitCommitShaStrategy(ports())
    // Установленный короткий SHA совпадает с префиксом полного → нет обновления.
    expect(s.compare('abcdef1', 'abcdef1234567890abcdef1234567890abcdef12')).toBe(false)
    // Различаются → есть обновление.
    expect(s.compare('abcdef1', 'fedcba9876543210fedcba9876543210fedcba98')).toBe(true)
    // Отсутствие данных → нет обновления.
    expect(s.compare(null, 'abcdef1')).toBe(false)
  })

  it('latest берётся из локального клона, если есть localDir', async () => {
    const s = new GitCommitShaStrategy(
      ports({
        lastCommitShaForPath: async () => 'LOCALSHA',
        getRemoteRefSha: async () => 'REMOTESHA'
      })
    )
    const withLocal = ctx({
      repo: { url: 'https://github.com/o/r', ref: null, skillPath: 'skills/x', localDir: '/clone' }
    })
    expect(await s.resolveLatest(withLocal)).toBe('LOCALSHA')
  })

  it('latest берётся из ls-remote, если локального клона нет', async () => {
    const s = new GitCommitShaStrategy(ports({ getRemoteRefSha: async () => 'REMOTESHA' }))
    expect(await s.resolveLatest(ctx())).toBe('REMOTESHA')
  })

  it('применима при наличии url или localDir', () => {
    const s = new GitCommitShaStrategy(ports())
    expect(s.isApplicable(ctx())).toBe(true)
    expect(s.isApplicable(ctx({ repo: { url: null, ref: null, skillPath: null } }))).toBe(false)
  })
})
