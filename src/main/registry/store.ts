import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CatalogEntry } from '@shared/domain/skill'

interface RegistryFile {
  version: number
  entries: CatalogEntry[]
  /** Slug'и skills, принудительно понижённых в local (свап official→local при ошибке, Часть 8). */
  demoted?: string[]
}

const REGISTRY_VERSION = 1

/** Персист локального индекса каталога (JSON, атомарная запись). */
export class RegistryStore {
  constructor(private readonly filePath: string) {}

  private read(): RegistryFile | null {
    if (!existsSync(this.filePath)) return null
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf8')) as RegistryFile
    } catch {
      return null
    }
  }

  load(): CatalogEntry[] {
    const parsed = this.read()
    return parsed && Array.isArray(parsed.entries) ? parsed.entries : []
  }

  /** Slug'и, понижённые в local (Часть 8, свап official→local). */
  loadDemoted(): string[] {
    const parsed = this.read()
    return parsed && Array.isArray(parsed.demoted) ? parsed.demoted : []
  }

  save(entries: CatalogEntry[], demoted: string[] = []): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const data: RegistryFile = { version: REGISTRY_VERSION, entries, demoted }
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(data), 'utf8')
    renameSync(tmp, this.filePath)
  }
}
