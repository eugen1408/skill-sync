import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigStore } from '../src/main/config/ConfigStore'
import { JobRunner, type JobEmitter } from '../src/main/jobs/JobRunner'
import { SourceManager, type IndexResult } from '../src/main/sources'
import type { SourceAdapter } from '../src/main/sources/types'
import type { SourceType } from '../src/shared/domain/source'

const noopEmitter: JobEmitter = { progress() {}, log() {}, done() {}, error() {} }

const SKILLS = [{ name: 'a', description: 'A', sourceRef: 'a', ref: null }]

function fakeAdapter(over: Partial<SourceAdapter> = {}): SourceAdapter {
  return {
    type: 'git',
    supportsWatch: false,
    validate: async () => {},
    listSkills: async () => SKILLS,
    ...over
  }
}

function makeManager(adapter: SourceAdapter, file: string): SourceManager {
  const configStore = new ConfigStore(file)
  const jobRunner = new JobRunner(noopEmitter)
  const adapters = new Map<SourceType, SourceAdapter>([['git', adapter]])
  return new SourceManager(configStore, jobRunner, adapters)
}

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skillsync-sm-'))
  file = join(dir, 'config.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('SourceManager', () => {
  it('добавляет источник, отклоняет дубликат', async () => {
    const m = makeManager(fakeAdapter(), file)
    const src = await m.add({
      type: 'git',
      name: 'Repo',
      config: { url: 'https://x/y', ref: 'main' }
    })
    expect(src.id).toBeTruthy()
    expect(m.list()).toHaveLength(1)
    await expect(
      m.add({ type: 'git', name: 'Dup', config: { url: 'https://x/y', ref: 'main' } })
    ).rejects.toThrow(/уже подключён/)
  })

  it('отклоняет источник при ошибке валидации адаптера', async () => {
    const m = makeManager(
      fakeAdapter({
        validate: async () => {
          throw new Error('плохой url')
        }
      }),
      file
    )
    await expect(m.add({ type: 'git', name: 'X', config: { url: 'bad' } })).rejects.toThrow(
      /плохой url/
    )
  })

  it('refresh индексирует, кэширует skills и эмитит onIndexed', async () => {
    const m = makeManager(fakeAdapter(), file)
    const src = await m.add({ type: 'git', name: 'Repo', config: { url: 'https://x/y' } })

    const indexed = new Promise<IndexResult>((resolve) => m.onIndexed(resolve))
    const jobId = m.refresh(src.id)
    expect(jobId).toBeTruthy()

    const result = await indexed
    expect(result.error).toBeNull()
    expect(result.skills).toEqual(SKILLS)
    expect(m.listSkills(src.id)).toEqual(SKILLS)
    expect(m.get(src.id)?.status).toBe('ok')
    expect(m.get(src.id)?.lastIndexedAt).toBeTruthy()
  })

  it('отключённый источник не индексируется (refresh → null)', async () => {
    const m = makeManager(fakeAdapter(), file)
    const src = await m.add({ type: 'git', name: 'Repo', config: { url: 'https://x/y' } })
    const disabled = m.setEnabled(src.id, false)
    expect(disabled.status).toBe('disabled')
    expect(m.refresh(src.id)).toBeNull()
  })

  it('remove удаляет источник и его кэш', async () => {
    const m = makeManager(fakeAdapter(), file)
    const src = await m.add({ type: 'git', name: 'Repo', config: { url: 'https://x/y' } })
    m.remove(src.id)
    expect(m.list()).toHaveLength(0)
    expect(m.listSkills(src.id)).toEqual([])
  })

  it('ensureDefaultOfficial создаёт skills.sh один раз', () => {
    const m = makeManager(fakeAdapter(), file)
    expect(m.ensureDefaultOfficial()).toBe(true)
    const official = m.list().find((s) => s.type === 'official')
    expect(official?.id).toBe('official')
    expect(official?.name).toBe('skills.sh')
    // Повторный вызов не дублирует.
    expect(m.ensureDefaultOfficial()).toBe(false)
    expect(m.list().filter((s) => s.type === 'official')).toHaveLength(1)
  })

  it('нельзя добавить второй official и нельзя удалить дефолтный', async () => {
    const m = makeManager(fakeAdapter(), file)
    m.ensureDefaultOfficial()
    await expect(m.add({ type: 'official', name: 'x', config: {} })).rejects.toThrow(/по умолчанию/)
    expect(() => m.remove('official')).toThrow(/нельзя удалить/)
  })

  it('defaultName выводит имя из basename url/каталога', async () => {
    const m = makeManager(fakeAdapter(), file)
    const src = await m.add({
      type: 'git',
      name: '',
      config: { url: 'https://github.com/o/my-repo.git' }
    })
    expect(src.name).toBe('my-repo')
  })
})
