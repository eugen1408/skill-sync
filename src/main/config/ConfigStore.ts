import { readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync } from 'node:fs'
import type { AppConfig } from '@shared/domain/config'
import { CONFIG_SCHEMA_VERSION, defaultConfig } from '@shared/domain/config'
import type { ConfigPatch } from '@shared/ipc/contract'

/** Функция миграции конфигурации с версии N на N+1. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

export interface ConfigStoreEvents {
  onError?: (message: string, cause?: unknown) => void
}

/**
 * Персистентный JSON-store конфигурации приложения.
 * Секреты здесь не хранятся (эпик Q-04). Запись атомарна (temp → rename).
 * Повреждённый файл или несовместимая версия → бэкап + дефолт/миграция.
 */
export class ConfigStore {
  private config: AppConfig
  private readonly filePath: string
  private readonly migrations: Map<number, Migration>
  private readonly events: ConfigStoreEvents

  constructor(
    filePath: string,
    options: { migrations?: Map<number, Migration>; events?: ConfigStoreEvents } = {}
  ) {
    this.filePath = filePath
    this.migrations = options.migrations ?? new Map()
    this.events = options.events ?? {}
    this.config = this.load()
  }

  get(): AppConfig {
    return structuredClone(this.config)
  }

  /** Частичное обновление верхнеуровневых секций; schemaVersion не изменяется. */
  update(patch: ConfigPatch): AppConfig {
    this.config = { ...this.config, ...patch, schemaVersion: this.config.schemaVersion }
    this.persist()
    return this.get()
  }

  private load(): AppConfig {
    if (!existsSync(this.filePath)) {
      const fresh = defaultConfig()
      
      try {
        const xdgStateHome = process.env.XDG_STATE_HOME
        const lockPath = xdgStateHome
          ? join(xdgStateHome, 'skills', '.skill-lock.json')
          : join(homedir(), '.agents', '.skill-lock.json')

        if (existsSync(lockPath)) {
          const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
          if (Array.isArray(lock.lastSelectedAgents) && lock.lastSelectedAgents.length > 0) {
            fresh.install.targetAgents = lock.lastSelectedAgents
          }
        }
      } catch (err) {
        // silently ignore issues with reading the lockfile
      }

      this.config = fresh
      this.persist()
      return fresh
    }

    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as Record<string, unknown>
    } catch (err) {
      this.backupCorrupt()
      this.events.onError?.(
        'Не удалось прочитать конфигурацию, восстановлены значения по умолчанию',
        err
      )
      const fresh = defaultConfig()
      this.config = fresh
      this.persist()
      return fresh
    }

    try {
      const migrated = this.migrate(raw)
      // Слияние с дефолтом гарантирует наличие всех секций после расширения схемы.
      return { ...defaultConfig(), ...migrated, schemaVersion: CONFIG_SCHEMA_VERSION } as AppConfig
    } catch (err) {
      this.backupCorrupt()
      this.events.onError?.(
        'Миграция конфигурации не удалась, восстановлены значения по умолчанию',
        err
      )
      const fresh = defaultConfig()
      this.config = fresh
      this.persist()
      return fresh
    }
  }

  private migrate(raw: Record<string, unknown>): Record<string, unknown> {
    let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0
    let current = raw
    while (version < CONFIG_SCHEMA_VERSION) {
      const migration = this.migrations.get(version)
      if (!migration) {
        throw new Error(`Нет миграции с версии ${version}`)
      }
      current = migration(current)
      version += 1
    }
    return current
  }

  private backupCorrupt(): void {
    try {
      if (existsSync(this.filePath)) {
        copyFileSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}.bak`)
      }
    } catch {
      /* бэкап best-effort */
    }
  }

  private persist(): void {
    const dir = dirname(this.filePath)
    mkdirSync(dir, { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.config, null, 2), 'utf8')
    renameSync(tmp, this.filePath)
  }
}
