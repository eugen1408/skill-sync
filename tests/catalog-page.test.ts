// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import type { CatalogEntry } from '@shared/domain/skill'

function entry(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    description: null,
    sourceId: 's1',
    sourceType: 'git',
    installed: false,
    installations: [],
    latestVersion: null,
    hasUpdate: false,
    lastCheckedAt: null,
    updateStatus: 'not_installed',
    sourceRef: name,
    installs: null
  }
}

// jsdom не предоставляет ResizeObserver (нужен bind:clientHeight виртуализации).
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
)
;(window as unknown as { api: unknown }).api = {
  catalog: { query: vi.fn(async () => ({ items: [], total: 0, page: 0, pageSize: 20 })) },
  events: { onCatalogUpdated: () => () => {} }
}

const { ui } = await import('../src/renderer/src/lib/stores/ui.svelte')
const { catalog } = await import('../src/renderer/src/lib/stores/catalog.svelte')
const CatalogPage = (await import('../src/renderer/src/components/CatalogPage.svelte')).default

beforeEach(() => {
  ui.detailId = null
  catalog.result = {
    items: [entry('s1:alpha', 'Alpha'), entry('s1:bravo', 'Bravo')],
    total: 2,
    page: 0,
    pageSize: 20
  }
  catalog.loading = false
})

describe('CatalogPage — открытие карточки', () => {
  it('клик по разным карточкам переключает ui.detailId', async () => {
    const { getByText } = render(CatalogPage)

    getByText('Alpha').click()
    await tick()
    expect(ui.detailId).toBe('s1:alpha')

    getByText('Bravo').click()
    await tick()
    expect(ui.detailId).toBe('s1:bravo')
  })
})
