import type { CatalogPage, CatalogSort, CatalogStatusFilter } from '@shared/ipc/contract'
import { api } from '../api'

const EMPTY: CatalogPage = { items: [], total: 0, page: 0, pageSize: 20 }

class CatalogStore {
  text = $state('')
  status = $state<CatalogStatusFilter | null>(null)
  sourceIds = $state<string[] | null>(null)
  sort = $state<CatalogSort>('update-first')
  page = $state(0)
  // Индекс каталога держится в памяти — грузим все совпадения одним запросом,
  // список рендерится виртуализированно (follow-up [12]).
  pageSize = 100_000
  result = $state<CatalogPage>(EMPTY)
  loading = $state(false)
  private unsubs: Array<() => void> = []
  private initialized = false
  private queryId = 0
  private searchTimer: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs = 250

  async load(): Promise<void> {
    const id = ++this.queryId
    this.loading = true
    try {
      const page = await api.catalog.query({
        text: this.text || null,
        sourceIds: this.sourceIds,
        status: this.status,
        sort: this.sort,
        page: this.page,
        pageSize: this.pageSize
      })
      // Игнорируем ответ на устаревший запрос (гонка при быстром вводе/переключении).
      if (id !== this.queryId) return
      this.result = page
    } finally {
      if (id === this.queryId) this.loading = false
    }
  }

  init(): void {
    if (this.initialized) return
    this.initialized = true
    this.unsubs.push(api.events.onCatalogUpdated(() => void this.load()))
    void this.load()
  }

  /**
   * Переинициализация списка как при запуске приложения: пересканирует установленные
   * skills и пересобирает индекс, затем запускает фоновую перепроверку версий.
   */
  async refresh(): Promise<void> {
    this.loading = true
    try {
      await api.catalog.refreshIndex()
      void api.update.checkAll()
      await this.load()
    } finally {
      this.loading = false
    }
  }

  destroy(): void {
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = null
    this.initialized = false
  }

  setText(text: string): void {
    this.text = text
    this.page = 0
    // Debounce ввода: не дёргаем main на каждый символ.
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null
      void this.load()
    }, this.debounceMs)
  }

  setStatus(status: CatalogStatusFilter | null): void {
    this.status = status
    this.page = 0
    void this.load()
  }

  setSort(sort: CatalogSort): void {
    this.sort = sort
    this.page = 0
    void this.load()
  }

  setPage(page: number): void {
    this.page = page
    void this.load()
  }
}

export const catalog = new CatalogStore()
