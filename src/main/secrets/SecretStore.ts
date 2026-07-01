import { safeStorage } from 'electron'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { logger } from '../logger'

export { GITHUB_TOKEN_KEY, applyGithubTokenEnv } from './env'

/**
 * Хранилище секретов в OS keychain через Electron safeStorage (эпик Q-04).
 * На диск пишется только зашифрованный blob; расшифрованные значения — в памяти.
 * Renderer'у значения секретов НЕ отдаются (только set/has/delete/available).
 */
export class SecretStore {
  private secrets: Record<string, string> = {}
  private readonly available: boolean

  constructor(private readonly filePath: string) {
    this.available = safeStorage.isEncryptionAvailable()
    if (!this.available) {
      logger.warn('safeStorage недоступен — секреты не будут сохранены между запусками')
    }
    this.load()
  }

  isAvailable(): boolean {
    return this.available
  }

  has(key: string): boolean {
    return Boolean(this.secrets[key])
  }

  /** Только для main-процесса; наружу (в renderer) не экспонируется. */
  get(key: string): string | null {
    return this.secrets[key] ?? null
  }

  set(key: string, value: string): void {
    if (!value) {
      this.delete(key)
      return
    }
    this.secrets[key] = value
    this.persist()
  }

  delete(key: string): void {
    delete this.secrets[key]
    this.persist()
  }

  private load(): void {
    if (!this.available || !existsSync(this.filePath)) return
    try {
      const encrypted = readFileSync(this.filePath)
      const json = safeStorage.decryptString(encrypted)
      this.secrets = JSON.parse(json) as Record<string, string>
    } catch (err) {
      logger.warn('Не удалось прочитать секреты, начинаем с пустого хранилища', err)
      this.secrets = {}
    }
  }

  private persist(): void {
    if (!this.available) return
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      const encrypted = safeStorage.encryptString(JSON.stringify(this.secrets))
      const tmp = `${this.filePath}.tmp`
      writeFileSync(tmp, encrypted)
      renameSync(tmp, this.filePath)
    } catch (err) {
      logger.error('Не удалось сохранить секреты', err)
    }
  }
}
