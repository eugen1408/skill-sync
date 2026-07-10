import type { CatalogEntry } from '@shared/domain/skill'
import type { CatalogQuery, CatalogPage, CatalogStatusFilter } from '@shared/ipc/contract'

function matchesText(entry: CatalogEntry, text: string): boolean {
  const needle = text.toLowerCase()
  return (
    entry.name.toLowerCase().includes(needle) ||
    (entry.description?.toLowerCase().includes(needle) ?? false)
  )
}

function matchesStatus(entry: CatalogEntry, status: CatalogStatusFilter): boolean {
  switch (status) {
    case 'installed':
      return entry.installed
    case 'not_installed':
      return !entry.installed
    case 'update_available':
      return entry.hasUpdate
  }
}

function sortEntries(entries: CatalogEntry[], sort: CatalogQuery['sort']): CatalogEntry[] {
  const byName = (a: CatalogEntry, b: CatalogEntry): number => a.name.localeCompare(b.name)
  switch (sort) {
    case 'name-desc':
      return [...entries].sort((a, b) => byName(b, a))
    case 'update-first':
      return [...entries].sort((a, b) => {
        // Группы: требуют обновления → актуально (установлено без обновления) → установить (не установлено).
        const rank = (e: CatalogEntry): number => (e.hasUpdate ? 0 : e.installed ? 1 : 2)
        const ra = rank(a)
        const rb = rank(b)
        if (ra !== rb) return ra - rb

        // Внутри группы — популярность skills.sh, затем по алфавиту.
        const aInstalls = a.installs ?? -1
        const bInstalls = b.installs ?? -1
        if (aInstalls !== bInstalls) {
          return bInstalls - aInstalls
        }

        return byName(a, b)
      })
    case 'installs-desc':
      return [...entries].sort((a, b) => {
        const aInstalls = a.installs ?? -1
        const bInstalls = b.installs ?? -1
        if (aInstalls !== bInstalls) {
          return bInstalls - aInstalls
        }
        return byName(a, b)
      })
    case 'name-asc':
    default:
      return [...entries].sort(byName)
  }
}

/** Поиск/фильтрация/сортировка/пагинация по индексу каталога (без сетевых вызовов). */
export function queryCatalog(all: CatalogEntry[], query: CatalogQuery): CatalogPage {
  let items = all
  if (query.text && query.text.trim()) {
    const text = query.text.trim()
    items = items.filter((e) => matchesText(e, text))
  }
  if (query.sourceIds && query.sourceIds.length > 0) {
    const set = new Set(query.sourceIds)
    items = items.filter((e) => set.has(e.sourceId))
  }
  if (query.statuses && query.statuses.length > 0) {
    const statuses = query.statuses
    // OR-семантика: запись проходит, если совпал хотя бы один выбранный статус.
    items = items.filter((e) => statuses.some((s) => matchesStatus(e, s)))
  }

  items = sortEntries(items, query.sort)

  const total = items.length
  const pageSize = Math.max(1, query.pageSize)
  const page = Math.max(0, query.page)
  const start = page * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize
  }
}
