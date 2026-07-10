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
    hasIndexed: () => true,
    get: (id: string) => sources.find((s) => s.id === id),
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
  return { agent, installedVersion: 'v1', installPath: path, isSymlink: false }
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
    expect(queryCatalog(entries, q({ statuses: ['installed'] })).total).toBe(2)
    expect(queryCatalog(entries, q({ statuses: ['update_available'] })).items[0].name).toBe('Apple')
    expect(queryCatalog(entries, q({ sourceIds: ['s2'] })).items[0].name).toBe('Cherry')
    const page = queryCatalog(entries, q({ pageSize: 2, page: 0 }))
    expect(page.items).toHaveLength(2)
    expect(page.total).toBe(3)
  })

  it('сортировка update-first: обновление → актуально → установить, внутри — по популярности и алфавиту', () => {
    const mix: CatalogEntry[] = [
      mkEntry('s1', 'NotInstalledPopular', { installed: false, installs: 500 }),
      mkEntry('s1', 'UpToDateB', { installed: true, hasUpdate: false, installs: 10 }),
      mkEntry('s1', 'NeedsUpdate', { installed: true, hasUpdate: true, installs: 1 }),
      mkEntry('s1', 'UpToDateA', { installed: true, hasUpdate: false, installs: 10 }),
      mkEntry('s1', 'NotInstalledRare', { installed: false, installs: 5 })
    ]
    const items = queryCatalog(mix, q({ sort: 'update-first' })).items
    expect(items.map((e) => e.name)).toEqual([
      'NeedsUpdate', // требуют обновления
      'UpToDateA', // актуально (installs равны → по алфавиту A < B)
      'UpToDateB',
      'NotInstalledPopular', // установить: по популярности skills.sh
      'NotInstalledRare'
    ])
  })

  it('сортировка installs-desc: больше установок выше, без счётчика — в конце', () => {
    const withInstalls: CatalogEntry[] = [
      mkEntry('s1', 'Low', { installs: 10 }),
      mkEntry('s1', 'None', { installs: null }),
      mkEntry('s1', 'High', { installs: 9999 })
    ]
    const items = queryCatalog(withInstalls, q({ sort: 'installs-desc' })).items
    expect(items.map((e) => e.name)).toEqual(['High', 'Low', 'None'])
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

    // get() находит запись живого поиска (её нет в индексе) — клик по карточке работает.
    expect(reg.get(official[0].id)?.name).toBe('Fresh One')
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
    expect(reg.query(q({ statuses: ['update_available'] })).total).toBe(1)
  })

  it('пересборка (rescan после install/update) сохраняет статус версии установленных', async () => {
    // Установлен skill без покрытия источником → orphan-запись (sourceId 'installed').
    const { manager } = fakeSourceManager([source('s1')], { s1: [raw('Alpha')] })
    const installed = new Map([['gamma', [inst('cursor', '/h/.cursor/skills/gamma')]]])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    await reg.init()

    const id = 'installed:gamma'
    reg.applyVersion(
      id,
      {
        installedVersion: 'v1',
        latestVersion: 'v1',
        hasUpdate: false,
        resolvedBy: 'skillFolderHash',
        unknown: false
      },
      '2026-07-02T00:00:00Z'
    )
    expect(reg.get(id)?.updateStatus).toBe('up_to_date')

    // Пересборка (как после установки/обновления) не должна сбрасывать статус в 'unknown'.
    await reg.rescanInstalled()
    expect(reg.get(id)?.updateStatus).toBe('up_to_date')
    expect(reg.get(id)?.latestVersion).toBe('v1')
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

describe('SkillRegistry — атрибуция из lock (Часть 8)', () => {
  it('атрибутирует установленный skill к official-источнику по карте', async () => {
    const { manager } = fakeSourceManager([officialSource()], {})
    const installed = new Map([['analyst', [inst('claude-code', '/h/.claude/skills/analyst')]]])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    reg.setLockAttribution(
      new Map([
        [
          'analyst',
          { sourceKind: 'official', sourceUrl: null, sourceRef: 'eugen1408/analyst@analyst' }
        ]
      ])
    )
    await reg.init()

    const entry = reg.get(catalogEntryId('official', 'analyst'))
    expect(entry?.sourceId).toBe('official')
    expect(entry?.sourceType).toBe('official')
    expect(entry?.sourceRef).toBe('eugen1408/analyst@analyst')
    expect(entry?.installed).toBe(true)
    // Больше нет локального сироты.
    expect(reg.get('installed:analyst')).toBeNull()
  })

  it('атрибутирует к git-источнику при совпадении URL, иначе — local', async () => {
    const gitSrc = source('g1') // url https://x/g1
    const { manager } = fakeSourceManager([gitSrc], {})
    const installed = new Map([
      ['gitskill', [inst('claude-code', '/h/.claude/skills/gitskill')]],
      ['nomatch', [inst('claude-code', '/h/.claude/skills/nomatch')]]
    ])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    reg.setLockAttribution(
      new Map([
        ['gitskill', { sourceKind: 'git', sourceUrl: 'https://x/g1', sourceRef: 'gitskill' }],
        ['nomatch', { sourceKind: 'git', sourceUrl: 'https://x/absent', sourceRef: 'nomatch' }]
      ])
    )
    await reg.init()

    expect(reg.get(catalogEntryId('g1', 'gitskill'))?.sourceId).toBe('g1')
    // URL не совпал с подключённым источником → локальный сирота.
    expect(reg.get('installed:nomatch')?.sourceType).toBe('local')
  })

  it('skill без lock-записи остаётся локальным сиротой', async () => {
    const { manager } = fakeSourceManager([officialSource()], {})
    const installed = new Map([['loner', [inst('cursor', '/h/.cursor/skills/loner')]]])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    reg.setLockAttribution(new Map()) // пустая карта
    await reg.init()
    expect(reg.get('installed:loner')?.sourceType).toBe('local')
  })

  it('demoteToLocal свапает official→local и переживает пересборку', async () => {
    const { manager } = fakeSourceManager([officialSource()], {})
    const installed = new Map([['analyst', [inst('claude-code', '/h/.claude/skills/analyst')]]])
    const attribution = new Map([
      ['analyst', { sourceKind: 'official' as const, sourceUrl: null, sourceRef: 'o/r@analyst' }]
    ])
    const reg = new SkillRegistry(
      store,
      manager,
      () => {},
      async () => installed
    )
    reg.setLockAttribution(attribution)
    await reg.init()

    const officialId = catalogEntryId('official', 'analyst')
    expect(reg.get(officialId)?.sourceType).toBe('official')

    reg.demoteToLocal(officialId)
    expect(reg.get(officialId)).toBeNull()
    expect(reg.get('installed:analyst')?.sourceType).toBe('local')

    // Пересборка не возвращает запись в official (slug помечен demoted, персист).
    await reg.refreshIndex()
    expect(reg.get(officialId)).toBeNull()
    expect(reg.get('installed:analyst')?.sourceType).toBe('local')
    expect(store.loadDemoted()).toContain('analyst')
  })
})

// -- helpers --

function officialSource(): Source {
  return {
    id: 'official',
    type: 'official',
    name: 'skills.sh',
    enabled: true,
    config: { url: null, ref: null, subpath: null, authMode: null, localPath: null, watch: false },
    lastIndexedAt: null,
    status: 'ok',
    lastError: null
  }
}

function q(over: Partial<Parameters<typeof queryCatalog>[1]> = {}) {
  return {
    text: null,
    sourceIds: null,
    statuses: null,
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
    installs: null,
    ...over
  }
}
