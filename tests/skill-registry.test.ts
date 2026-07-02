import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SkillRegistry } from '../src/main/registry/SkillRegistry'
import { RegistryStore } from '../src/main/registry/store'
import { queryCatalog } from '../src/main/registry/query'
import { catalogEntryId } from '../src/shared/domain/skill'
import type { AgentInstallation, CatalogEntry } from '../src/shared/domain/skill'
import type { Source, RawSkill } from '../src/shared/domain/source'
import type { SourceManager, IndexResult } from '../src/main/sources'

function source(id: string, enabled = true): Source {
  return {
    id,
    type: 'git',
    name: id,
    enabled,
    config: {
      url: `https://x/${id}`,
      ref: null,
      subpath: null,
      authMode: null,
      localPath: null,
      watch: false
    },
    lastIndexedAt: null,
    status: 'ok',
    lastError: null
  }
}

function fakeSourceManager(
  sources: Source[],
  skillsBySource: Record<string, RawSkill[]>
): { manager: SourceManager; fire: (r: IndexResult) => void } {
  let listener: ((r: IndexResult) => void) | null = null
  const manager = {
    list: () => sources,
    listSkills: (id: string) => skillsBySource[id] ?? [],
    onIndexed: (cb: (r: IndexResult) => void) => {
      listener = cb
      return () => {
        listener = null
      }
    }
  } as unknown as SourceManager
  return { manager, fire: (r) => listener?.(r) }
}

function raw(name: string): RawSkill {
  return { name, description: `${name} desc`, sourceRef: name.toLowerCase(), ref: null }
}

function inst(agent: string, path: string): AgentInstallation {
  return { agent, installedVersion: 'v1', installPath: path }
}

let dir: string
let store: RegistryStore
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skillsync-reg-'))
  store = new RegistryStore(join(dir, 'registry.json'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('queryCatalog', () => {
  const entries: CatalogEntry[] = [
    mkEntry('s1', 'Apple', { installed: true, hasUpdate: true }),
    mkEntry('s1', 'Banana', { installed: false }),
    mkEntry('s2', 'Cherry', { installed: true, hasUpdate: false })
  ]

  it('фильтрует по тексту и статусу, сортирует и пагинирует', () => {
    expect(queryCatalog(entries, q({ text: 'ban' })).total).toBe(1)
    expect(queryCatalog(entries, q({ status: 'installed' })).total).toBe(2)
    expect(queryCatalog(entries, q({ status: 'update_available' })).items[0].name).toBe('Apple')
    expect(queryCatalog(entries, q({ sourceIds: ['s2'] })).items[0].name).toBe('Cherry')
    const page = queryCatalog(entries, q({ pageSize: 2, page: 0 }))
    expect(page.items).toHaveLength(2)
    expect(page.total).toBe(3)
  })
})

describe('SkillRegistry', () => {
  it('строит каталог из источников + установленных, помечает сироты', async () => {
    const { manager } = fakeSourceManager([source('s1')], { s1: [raw('Alpha'), raw('Beta')] })
    const installed = new Map<string, AgentInstallation[]>([
      ['alpha', [inst('claude-code', '/h/.claude/skills/alpha')]],
      ['gamma', [inst('cursor', '/h/.cursor/skills/gamma')]]
    ])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    await reg.init()

    const all = reg.query(q({ pageSize: 100 }))
    expect(all.total).toBe(3) // Alpha, Beta, orphan gamma
    const byName = Object.fromEntries(all.items.map((e) => [e.name, e]))
    expect(byName['Alpha'].installed).toBe(true)
    expect(byName['Alpha'].installations).toHaveLength(1)
    expect(byName['Beta'].installed).toBe(false)
    expect(byName['Beta'].updateStatus).toBe('not_installed')
    expect(byName['gamma'].sourceId).toBe('installed')
    expect(byName['gamma'].installed).toBe(true)
  })

  it('buildOfficialEntries: пропускает уже присутствующие (локальные/установленные), добавляет новые', async () => {
    const { manager } = fakeSourceManager([source('s1')], { s1: [raw('Alpha')] })
    // 'react-best' установлен, но не покрыт источником → станет orphan в индексе.
    const installed = new Map<string, AgentInstallation[]>([
      ['react-best', [inst('claude-code', '/h/.claude/skills/react-best')]]
    ])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    await reg.init()

    const official = reg.buildOfficialEntries([
      { name: 'Alpha', slug: 'alpha', source: 'o/r', sourceRef: 'o/r@alpha', installs: 1 },
      {
        name: 'react-best',
        slug: 'react-best',
        source: 'o/r',
        sourceRef: 'o/r@react-best',
        installs: 2
      },
      {
        name: 'Fresh One',
        slug: 'fresh-one',
        source: 'o/r',
        sourceRef: 'o/r@fresh-one',
        installs: 3
      }
    ])

    // Alpha (локальный) и react-best (установлен → orphan) отсеяны; остаётся только новый.
    expect(official.map((e) => e.name)).toEqual(['Fresh One'])
    expect(official[0].sourceId).toBe('official')
    expect(official[0].sourceRef).toBe('o/r@fresh-one')
    expect(official[0].installed).toBe(false)
    expect(official[0].updateStatus).toBe('not_installed')
  })

  it('applyVersion обновляет статус обновления', async () => {
    const { manager } = fakeSourceManager([source('s1')], { s1: [raw('Alpha')] })
    const installed = new Map([['alpha', [inst('claude-code', '/h/.claude/skills/alpha')]]])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    await reg.init()

    const id = catalogEntryId('s1', 'Alpha')
    reg.applyVersion(
      id,
      {
        installedVersion: 'v1',
        latestVersion: 'v2',
        hasUpdate: true,
        resolvedBy: 'gitTag',
        unknown: false
      },
      '2026-07-01T00:00:00Z'
    )
    expect(reg.get(id)?.updateStatus).toBe('update_available')
    expect(reg.query(q({ status: 'update_available' })).total).toBe(1)
  })

  it('скрывает записи отключённых источников, но сохраняет сироты', async () => {
    const { manager } = fakeSourceManager([source('s1', false)], { s1: [raw('Alpha')] })
    const installed = new Map([['gamma', [inst('cursor', '/h/.cursor/skills/gamma')]]])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    await reg.init()
    const all = reg.query(q({ pageSize: 100 }))
    expect(all.items.map((e) => e.name)).toEqual(['gamma']) // Alpha скрыт (источник отключён)
  })
})

// -- helpers --

function q(over: Partial<Parameters<typeof queryCatalog>[1]> = {}) {
  return {
    text: null,
    sourceIds: null,
    status: null,
    sort: 'name-asc' as const,
    page: 0,
    pageSize: 20,
    ...over
  }
}

function mkEntry(sourceId: string, name: string, over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: catalogEntryId(sourceId, name),
    name,
    description: null,
    sourceId,
    sourceType: 'git',
    installed: false,
    installations: [],
    latestVersion: null,
    hasUpdate: false,
    lastCheckedAt: null,
    updateStatus: 'not_installed',
    sourceRef: name,
    ...over
  }
}
