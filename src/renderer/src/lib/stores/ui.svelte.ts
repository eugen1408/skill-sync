export type View = 'catalog' | 'sources' | 'notifications' | 'settings'

class UiStore {
  view = $state<View>('catalog')
  detailId = $state<string | null>(null)

  go(view: View): void {
    this.view = view
    this.detailId = null
  }

  openDetail(id: string): void {
    this.detailId = id
  }

  closeDetail(): void {
    this.detailId = null
  }
}

export const ui = new UiStore()
