// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import type { CatalogEntry } from '@shared/domain/skill'

function entry(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    description: `${name} desc`,
    sourceId: 'installed',
    sourceType: 'local',
    installed: true,
    installations: [
      { agent: 'claude-code', installedVersion: 'v1', installPath: `/h/${name}`, isSymlink: false }
    ],
    latestVersion: null,
    hasUpdate: false,
    lastCheckedAt: null,
    updateStatus: 'unknown',
    sourceRef: name,
    installs: null
  }
}

const store: Record<string, CatalogEntry> = { a: entry('a', 'Alpha'), b: entry('b', 'Bravo') }
const get = vi.fn(async (id: string) => store[id] ?? null)
let catalogUpdated: (() => void) | null = null
;(window as unknown as { api: unknown }).api = {
  catalog: {
    get,
    audit: vi.fn(async () => ({ worstRisk: 'unknown', providers: [], description: null })),
    officialUrl: vi.fn(async () => null),
    readme: vi.fn(async () => null)
  },
  config: { get: vi.fn(async () => null) },
  update: { checkOne: vi.fn(), runOne: vi.fn() },
  events: {
    onCatalogUpdated: (cb: () => void) => {
      catalogUpdated = cb
      return () => {
        catalogUpdated = null
      }
    }
  }
}

const { ui } = await import('../src/renderer/src/lib/stores/ui.svelte')
const SkillDetail = (await import('../src/renderer/src/components/SkillDetail.svelte')).default

beforeEach(() => {
  get.mockClear()
  ui.detailId = null
})

describe('SkillDetail — переключение карточек', () => {
  it('при смене detailId показывает другой skill', async () => {
    ui.detailId = 'a'
    const { findByText, queryByText } = render(SkillDetail)
    expect(await findByText('Alpha')).toBeTruthy()

    // Переключаемся на второй skill.
    ui.detailId = 'b'
    await tick()
    expect(await findByText('Bravo')).toBeTruthy()
    expect(queryByText('Alpha')).toBeNull()
  })

  it('обновляет карточку по событию catalogUpdated (после установки/обновления)', async () => {
    ui.detailId = 'a'
    const { findByText } = render(SkillDetail)
    await findByText('Alpha')

    // Каталог изменился (напр. skill установлен) — карточка должна освежиться.
    store.a = { ...entry('a', 'Alpha'), latestVersion: 'v2' }
    catalogUpdated?.()
    await tick()
    await tick()
    expect(await findByText(/v2/)).toBeTruthy()
  })
})
