import type { CatalogPage, CatalogSort, CatalogStatusFilter } from '@shared/ipc/contract'
import { api } from '../api'

const EMPTY: CatalogPage = { items: [], total: 0, page: 0, pageSize: 20 }

class CatalogStore {
  text = $state('')
  status = $state<CatalogStatusFilter | null>(null)
  sourceIds = $state<string[] | null>(null)
  sort = $state<CatalogSort>('update-first')
  page = $state(0)
  pageSize = 20
  result = $state<CatalogPage>(EMPTY)
  loading = $state(false)

  async load(): Promise<void> {
    this.loading = true
    try {
      this.result = await api.catalog.query({
        text: this.text || null,
        sourceIds: this.sourceIds,
        status: this.status,
        sort: this.sort,
        page: this.page,
        pageSize: this.pageSize
      })
    } finally {
      this.loading = false
    }
  }

  init(): void {
    api.events.onCatalogUpdated(() => void this.load())
    void this.load()
  }

  setText(text: string): void {
    this.text = text
    this.page = 0
    void this.load()
  }

  setStatus(status: CatalogStatusFilter | null): void {
    this.status = status
    this.page = 0
    void this.load()
  }

  setSort(sort: CatalogSort): void {
    this.sort = sort
    void this.load()
  }

  setPage(page: number): void {
    this.page = page
    void this.load()
  }
}

export const catalog = new CatalogStore()
