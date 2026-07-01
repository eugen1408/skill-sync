import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { lstat, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reconcileAgents } from '../src/main/installer/agentReconciler'
import type { PathContext } from '../src/main/installer/paths'
import { getAgent } from '../src/shared/domain/agent'

const CLAUDE = getAgent('claude-code')!
const CURSOR = getAgent('cursor')!

let base: string
let pathCtx: PathContext
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'skillsync-rec-'))
  pathCtx = { scope: 'global', home: base, cwd: base }
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('reconcileAgents — граничные случаи', () => {
  it('посевает канон из существующей установки, если канона нет', async () => {
    // Канона нет, но skill установлен у claude (реальные файлы).
    const existing = join(base, CLAUDE.dir, 'foo')
    mkdirSync(existing, { recursive: true })
    writeFileSync(join(existing, 'SKILL.md'), 'seed')

    const summary = await reconcileAgents(
      [{ name: 'foo', installPaths: [existing] }],
      [CURSOR],
      [],
      pathCtx
    )

    expect(summary.linked).toBe(1)
    // Канон создан из существующей установки.
    const canonical = join(base, '.agents', 'skills', 'foo')
    expect((await lstat(canonical)).isDirectory()).toBe(true)
    // Cursor получил рабочую ссылку.
    expect(await readFile(join(base, CURSOR.dir, 'foo', 'SKILL.md'), 'utf8')).toBe('seed')
  })

  it('пропускает skill без канона и без существующих установок', async () => {
    const summary = await reconcileAgents(
      [{ name: 'ghost', installPaths: [join(base, 'nope')] }],
      [CURSOR],
      [],
      pathCtx
    )
    expect(summary.skipped).toBe(1)
    expect(summary.linked).toBe(0)
  })

  it('снятие всех агентов удаляет ссылки, канон остаётся', async () => {
    const canonical = join(base, '.agents', 'skills', 'foo')
    mkdirSync(canonical, { recursive: true })
    writeFileSync(join(canonical, 'SKILL.md'), 'x')
    // Была ссылка у claude.
    await reconcileAgents([{ name: 'foo', installPaths: [] }], [CLAUDE], [], pathCtx)

    // Снимаем всех.
    const summary = await reconcileAgents(
      [{ name: 'foo', installPaths: [] }],
      [],
      [CLAUDE],
      pathCtx
    )
    expect(summary.unlinked).toBe(1)
    await expect(lstat(join(base, CLAUDE.dir, 'foo'))).rejects.toThrow()
    expect((await lstat(canonical)).isDirectory()).toBe(true)
  })
})
