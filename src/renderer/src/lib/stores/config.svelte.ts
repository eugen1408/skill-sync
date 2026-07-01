import type { AppConfig } from '@shared/domain/config'
import type { ConfigPatch, AppUpdateStatus } from '@shared/ipc/contract'
import { api } from '../api'

class ConfigStoreView {
  config = $state<AppConfig | null>(null)
  appUpdate = $state<AppUpdateStatus | null>(null)
  private unsubs: Array<() => void> = []
  private initialized = false

  async load(): Promise<void> {
    this.config = await api.config.get()
  }

  init(): void {
    if (this.initialized) return
    this.initialized = true
    this.unsubs.push(
      api.events.onAppUpdateStatus((s) => {
        this.appUpdate = s
      })
    )
    void this.load()
  }

  destroy(): void {
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.initialized = false
  }

  async update(patch: ConfigPatch): Promise<void> {
    this.config = await api.config.update(patch)
  }
}

export const config = new ConfigStoreView()
