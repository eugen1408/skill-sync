import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanInstalledSkills } from '../src/main/registry/installedScanner'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'skillsync-scan-'))
})
afterEach(() => rmSync(home, { recursive: true, force: true }))

describe('scanInstalledSkills', () => {
  it('находит установленные по каталогам агентов, группирует по slug, включает симлинки, пропускает dot', async () => {
    // Claude: обычный каталог + служебный dot-каталог (пропускается).
    mkdirSync(join(home, '.claude', 'skills', 'alpha'), { recursive: true })
    writeFileSync(join(home, '.claude', 'skills', 'alpha', 'SKILL.md'), 'x')
    mkdirSync(join(home, '.claude', 'skills', '.system'), { recursive: true })

    // Cursor: другой skill.
    mkdirSync(join(home, '.cursor', 'skills', 'beta'), { recursive: true })

    // Codex: симлинк на канонический каталог (модель CLI).
    mkdirSync(join(home, '.agents', 'skills', 'gamma'), { recursive: true })
    mkdirSync(join(home, '.codex', 'skills'), { recursive: true })
    symlinkSync(join(home, '.agents', 'skills', 'gamma'), join(home, '.codex', 'skills', 'gamma'))

    const map = await scanInstalledSkills(home)

    expect(map.get('alpha')?.map((i) => i.agent)).toEqual(['claude-code'])
    expect(map.get('beta')?.map((i) => i.agent)).toEqual(['cursor'])
    expect(map.get('gamma')?.map((i) => i.agent)).toEqual(['codex']) // симлинк учтён
    expect(map.has('system')).toBe(false) // .system пропущен
  })

  it('пустой home → пустая карта', async () => {
    const map = await scanInstalledSkills(home)
    expect(map.size).toBe(0)
  })
})
