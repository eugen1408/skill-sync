import type { Source, AddSourceInput } from '@shared/domain/source'
import { api } from '../api'

class SourcesStore {
  items = $state<Source[]>([])

  async load(): Promise<void> {
    this.items = await api.source.list()
  }

  init(): void {
    api.events.onSourceIndexed(() => void this.load())
    void this.load()
  }

  async add(input: AddSourceInput): Promise<void> {
    const source = await api.source.add(input)
    await this.load()
    await api.source.refresh(source.id)
  }

  async remove(id: string): Promise<void> {
    await api.source.remove(id)
    await this.load()
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await api.source.setEnabled(id, enabled)
    await this.load()
  }

  async refresh(id: string): Promise<void> {
    await api.source.refresh(id)
  }
}

export const sources = new SourcesStore()
