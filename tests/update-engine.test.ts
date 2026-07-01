import { describe, it, expect, vi } from 'vitest'
import { NotificationCenter } from '../src/main/notifications/NotificationCenter'
import { UpdateEngine } from '../src/main/update/UpdateEngine'
import { buildResolveContext } from '../src/main/update/resolveContext'
import type { AppNotification } from '../src/shared/domain/notification'
import type { CatalogEntry, VersionInfo } from '../src/shared/domain/skill'
import type { Source } from '../src/shared/domain/source'
import type { InstallResult } from '../src/shared/domain/install'
import type { JobContext } from '../src/main/jobs/JobRunner'

// -- NotificationCenter --

describe('NotificationCenter', () => {
  function make() {
    const emitted: AppNotification[] = []
    const native: AppNotification[] = []
    const nc = new NotificationCenter({
      emit: (n) => emitted.push(n),
      nativeNotify: (n) => native.push(n)
    })
    return { nc, emitted, native }
  }

  it('добавляет, эмитит и шлёт нативно; ведёт историю и unread', () => {
    const { nc, emitted, native } = make()
    const n = nc.add({ type: 'update_success', title: 'T', message: 'M' })
    expect(n).not.toBeNull()
    expect(emitted).toHaveLength(1)
    expect(native).toHaveLength(1)
    expect(nc.unreadCount()).toBe(1)
    nc.markRead(n!.id)
    expect(nc.unreadCount()).toBe(0)
    nc.clear()
    expect(nc.list()).toHaveLength(0)
  })

  it('дедуплицирует по ключу', () => {
    const { nc } = make()
    const a = nc.add({ type: 'update_available', title: 'T', message: 'M', skillId: 's' }, 'v2')
    const b = nc.add({ type: 'update_available', title: 'T', message: 'M', skillId: 's' }, 'v2')
    expect(a).not.toBeNull()
    expect(b).toBeNull()
  })
})

// -- buildResolveContext --

describe('buildResolveContext', () => {
  it('для git собирает skillPath из subpath + sourceRef + SKILL.md', () => {
    const entry = mkEntry({ sourceType: 'git', sourceRef: 'skills/alpha' })
    const source = mkSource('git', { url: 'https://github.com/o/r', subpath: 'pkg', ref: 'main' })
    const ctx = buildResolveContext(entry, source, null)
    expect(ctx.repo.skillPath).toBe('pkg/skills/alpha/SKILL.md')
    expect(ctx.repo.url).toBe('https://github.com/o/r')
    expect(ctx.localPath).toBeNull()
  })

  it('для local собирает localPath из каталога + sourceRef', () => {
    const entry = mkEntry({ sourceType: 'local', sourceRef: 'alpha' })
    const source = mkSource('local', { localPath: '/src' })
    const ctx = buildResolveContext(entry, source, null)
    expect(ctx.localPath).toBe('/src/alpha')
    expect(ctx.repo.skillPath).toBeNull()
  })
})

// -- UpdateEngine --

interface FakeRunner {
  start: (
    kind: string,
    exec: (ctx: JobContext) => Promise<unknown>
  ) => { jobId: string; promise: Promise<unknown> }
  last: Promise<unknown> | null
}

function fakeRunner(): FakeRunner {
  const ctx: JobContext = {
    jobId: 'j',
    signal: new AbortController().signal,
    progress() {},
    log() {},
    throwIfCancelled() {}
  }
  const r: FakeRunner = {
    last: null,
    start(_kind, exec) {
      const promise = exec(ctx)
      r.last = promise
      return { jobId: 'j', promise }
    }
  }
  return r
}

describe('UpdateEngine', () => {
  function build(entry: CatalogEntry, info: VersionInfo, installResult: InstallResult) {
    const runner = fakeRunner()
    const applied: Array<{ id: string; info: VersionInfo }> = []
    const emittedNotifs: AppNotification[] = []
    const notifications = new NotificationCenter({ emit: (n) => emittedNotifs.push(n) })
    const checked = vi.fn()

    const deps = {
      jobRunner: runner as never,
      sourceManager: {
        get: () => mkSource('git', { url: 'https://github.com/o/r' }),
        onIndexed: () => () => {}
      } as never,
      skillRegistry: {
        query: () => ({ items: [entry], total: 1, page: 0, pageSize: 100 }),
        get: () => entry,
        applyVersion: (id: string, i: VersionInfo) => applied.push({ id, info: i })
      } as never,
      installer: {
        startInstall: () => ({ jobId: 'i', promise: Promise.resolve(installResult) })
      } as never,
      resolver: { resolve: async () => info } as never,
      notifications,
      configStore: {
        get: () => ({
          update: { watchLocalSources: false },
          install: { targetAgents: ['claude-code'], scope: 'global' }
        }),
        update: () => {}
      } as never,
      onChecked: checked
    }
    return { engine: new UpdateEngine(deps), runner, applied, emittedNotifs, checked }
  }

  it('checkAll резолвит версии, пишет в Registry и уведомляет о новой версии', async () => {
    const entry = mkEntry({ installed: true })
    const info: VersionInfo = {
      installedVersion: 'v1',
      latestVersion: 'v2',
      hasUpdate: true,
      resolvedBy: 'gitTag',
      unknown: false
    }
    const { engine, runner, applied, emittedNotifs, checked } = build(
      entry,
      info,
      okResult(entry.id)
    )

    engine.checkAll()
    await runner.last

    expect(applied[0]).toMatchObject({ id: entry.id })
    expect(applied[0].info.hasUpdate).toBe(true)
    expect(emittedNotifs.some((n) => n.type === 'update_available')).toBe(true)
    expect(checked).toHaveBeenCalledWith(expect.objectContaining({ updatesAvailable: 1 }))
  })

  it('runAll переустанавливает обновляемые и уведомляет об успехе', async () => {
    const entry = mkEntry({ installed: true, hasUpdate: true })
    const info: VersionInfo = {
      installedVersion: 'v1',
      latestVersion: 'v2',
      hasUpdate: true,
      resolvedBy: 'gitTag',
      unknown: false
    }
    const { engine, runner, emittedNotifs } = build(entry, info, okResult(entry.id))

    engine.runAll()
    const summary = (await runner.last) as { ok: number }

    expect(summary.ok).toBe(1)
    expect(emittedNotifs.some((n) => n.type === 'update_success')).toBe(true)
  })

  it('runAll не трогает skills без обновления (фильтр hasUpdate)', async () => {
    const entry = mkEntry({ installed: true, hasUpdate: false })
    const info: VersionInfo = {
      installedVersion: 'v1',
      latestVersion: 'v1',
      hasUpdate: false,
      resolvedBy: 'gitTag',
      unknown: false
    }
    const { engine, runner, emittedNotifs } = build(entry, info, okResult(entry.id))

    engine.runAll()
    const summary = (await runner.last) as { ok: number; failed: number; skipped: number }

    expect(summary).toEqual({ ok: 0, failed: 0, skipped: 0 })
    expect(emittedNotifs.some((n) => n.type === 'update_success')).toBe(false)
  })
})

// -- helpers --

function mkEntry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 's1:alpha',
    name: 'alpha',
    description: null,
    sourceId: 's1',
    sourceType: 'git',
    installed: false,
    installations: [
      { agent: 'claude-code', installedVersion: 'v1', installPath: '/h/.claude/skills/alpha' }
    ],
    latestVersion: null,
    hasUpdate: false,
    lastCheckedAt: null,
    updateStatus: 'unknown',
    sourceRef: 'alpha',
    ...over
  }
}

function mkSource(type: Source['type'], config: Partial<Source['config']>): Source {
  return {
    id: 's1',
    type,
    name: 's1',
    enabled: true,
    config: {
      url: null,
      ref: null,
      subpath: null,
      authMode: null,
      localPath: null,
      watch: false,
      ...config
    },
    lastIndexedAt: null,
    status: 'ok',
    lastError: null
  }
}

function okResult(skillId: string): InstallResult {
  return { skillId, status: 'ok', installedVersion: 'v2', outcomes: [], error: null }
}
