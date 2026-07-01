import type { SourceManager } from '../sources'
import { SkillRegistry } from './SkillRegistry'
import { RegistryStore } from './store'

export { SkillRegistry } from './SkillRegistry'
export { RegistryStore } from './store'
export { scanInstalledSkills } from './installedScanner'
export { queryCatalog } from './query'

export interface SkillRegistryDeps {
  indexPath: string
  sourceManager: SourceManager
  /** Вызывается после любого изменения индекса (main рассылает catalog:updated). */
  onUpdated: () => void
}

export function createSkillRegistry(deps: SkillRegistryDeps): SkillRegistry {
  return new SkillRegistry(new RegistryStore(deps.indexPath), deps.sourceManager, deps.onUpdated)
}
