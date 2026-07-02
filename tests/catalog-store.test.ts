// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { CatalogPage, CatalogQuery } from '@shared/ipc/contract'

// window.api-стаб до импорта стора (api.ts захватывает window.api при загрузке).
const query = vi.fn<(q: CatalogQuery) => Promise<CatalogPage>>()
;(window as unknown as { api: unknown }).api = {
  catalog: { query, get: vi.fn() },
  events: { onCatalogUpdated: () => () => {} }
}

const { catalog } = await import('../src/renderer/src/lib/stores/catalog.svelte')

function page(ids: string[]): CatalogPage {
  return { items: ids.map((id) => ({ id }) as never), total: ids.length, page: 0, pageSize: 20 }
}

beforeEach(() => {
  query.mockReset()
  catalog.result = page([])
  catalog.text = ''
})
afterEach(() => vi.useRealTimers())

describe('catalog store — debounce поиска', () => {
  it('не дёргает query на каждый символ; один запрос после паузы', () => {
    vi.useFakeTimers()
    query.mockResolvedValue(page(['a']))

    catalog.setText('r')
    catalog.setText('re')
    catalog.setText('rea')
    expect(query).not.toHaveBeenCalled() // debounce ещё не сработал

    vi.advanceTimersByTime(250)
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][0]).toMatchObject({ text: 'rea' })
  })
})

describe('catalog store — стале-гард', () => {
  it('игнорирует ответ устаревшего запроса (гонка)', async () => {
    const resolvers: Array<(p: CatalogPage) => void> = []
    query.mockImplementation(() => new Promise<CatalogPage>((res) => resolvers.push(res)))

    catalog.setStatus('installed') // запрос #1
    catalog.setStatus('not_installed') // запрос #2 (актуальный)
    expect(query).toHaveBeenCalledTimes(2)

    // Разрешаем сначала актуальный (#2), затем устаревший (#1).
    resolvers[1](page(['B']))
    await Promise.resolve()
    resolvers[0](page(['A']))
    await Promise.resolve()

    expect(catalog.result.items.map((i) => i.id)).toEqual(['B'])
  })
})
