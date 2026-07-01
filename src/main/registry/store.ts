import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CatalogEntry } from '@shared/domain/skill'

interface RegistryFile {
  version: number
  entries: CatalogEntry[]
}

const REGISTRY_VERSION = 1

/** Персист локального индекса каталога (JSON, атомарная запись). */
export class RegistryStore {
  constructor(private readonly filePath: string) {}

  load(): CatalogEntry[] {
    if (!existsSync(this.filePath)) return []
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as RegistryFile
      return Array.isArray(parsed.entries) ? parsed.entries : []
    } catch {
      return []
    }
  }

  save(entries: CatalogEntry[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const data: RegistryFile = { version: REGISTRY_VERSION, entries }
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(data), 'utf8')
    renameSync(tmp, this.filePath)
  }
}
