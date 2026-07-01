import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigStore, type Migration } from '../src/main/config/ConfigStore'
import { CONFIG_SCHEMA_VERSION } from '../src/shared/domain/config'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skillsync-config-'))
  file = join(dir, 'config.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('ConfigStore', () => {
  it('создаёт дефолтную конфигурацию при отсутствии файла', () => {
    const store = new ConfigStore(file)
    const cfg = store.get()
    expect(existsSync(file)).toBe(true)
    expect(cfg.schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
    expect(cfg.sources).toEqual([])
    expect(cfg.install.targetAgents).toContain('claude-code')
  })

  it('персистит изменения и переживает перезапуск', () => {
    const store = new ConfigStore(file)
    store.update({ network: { gitAuthMode: 'ssh', proxyUrl: 'http://proxy:8080' } })

    const reopened = new ConfigStore(file)
    expect(reopened.get().network.gitAuthMode).toBe('ssh')
    expect(reopened.get().network.proxyUrl).toBe('http://proxy:8080')
  })

  it('get() возвращает копию (мутация не влияет на store)', () => {
    const store = new ConfigStore(file)
    const cfg = store.get()
    cfg.sources.push({
      id: 'x',
      type: 'local',
      name: 'n',
      enabled: true,
      config: {
        url: null,
        ref: null,
        subpath: null,
        authMode: null,
        localPath: '/tmp',
        watch: false
      },
      lastIndexedAt: null,
      status: 'ok',
      lastError: null
    })
    expect(store.get().sources).toHaveLength(0)
  })

  it('делает бэкап и восстанавливает дефолт при повреждённом файле', () => {
    writeFileSync(file, '{ это не json')
    let errored = false
    const store = new ConfigStore(file, { events: { onError: () => (errored = true) } })
    expect(errored).toBe(true)
    expect(store.get().schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
    const backups = readdirSync(dir).filter((f) => f.includes('.corrupt-'))
    expect(backups.length).toBeGreaterThan(0)
  })

  it('применяет миграцию со старой версии схемы', () => {
    writeFileSync(file, JSON.stringify({ schemaVersion: 0, legacyFlag: true }))
    const migrations = new Map<number, Migration>()
    migrations.set(0, (raw) => ({ ...raw, schemaVersion: 1, migrated: true }))
    const store = new ConfigStore(file, { migrations })
    expect(store.get().schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
  })
})
