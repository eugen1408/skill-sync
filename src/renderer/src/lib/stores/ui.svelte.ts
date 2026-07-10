export type View = 'catalog' | 'sources' | 'notifications' | 'settings' | 'help'

class UiStore {
  view = $state<View>('catalog')
  detailId = $state<string | null>(null)
  
  // Хранит состояние свернутости групп: false = свернуто. По умолчанию открыто (true/undefined).
  catalogGroupsOpen = $state<Record<string, boolean>>({})
  sourcesGroupsOpen = $state<Record<string, boolean>>({})

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
