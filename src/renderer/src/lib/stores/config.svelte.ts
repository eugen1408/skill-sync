import type { AppConfig } from '@shared/domain/config'
import type { ConfigPatch, AppUpdateStatus } from '@shared/ipc/contract'
import { api } from '../api'

class ConfigStoreView {
  config = $state<AppConfig | null>(null)
  appUpdate = $state<AppUpdateStatus | null>(null)

  async load(): Promise<void> {
    this.config = await api.config.get()
  }

  init(): void {
    api.events.onAppUpdateStatus((s) => {
      this.appUpdate = s
    })
    void this.load()
  }

  async update(patch: ConfigPatch): Promise<void> {
    this.config = await api.config.update(patch)
  }
}

export const config = new ConfigStoreView()
