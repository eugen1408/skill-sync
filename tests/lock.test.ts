import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { removeGlobalLockEntry } from '../src/main/version/lock'

let dir: string
let lockPath: string
const prevXdg = process.env.XDG_STATE_HOME

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skillsync-lock-'))
  process.env.XDG_STATE_HOME = dir
  mkdirSync(join(dir, 'skills'), { recursive: true })
  lockPath = join(dir, 'skills', '.skill-lock.json')
})
afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_STATE_HOME
  else process.env.XDG_STATE_HOME = prevXdg
  rmSync(dir, { recursive: true, force: true })
})

describe('removeGlobalLockEntry', () => {
  it('удаляет запись skill, сохраняя остальные', async () => {
    writeFileSync(
      lockPath,
      JSON.stringify({ version: 3, skills: { alpha: { source: 'o/r' }, beta: { source: 'o/r' } } })
    )
    await removeGlobalLockEntry('alpha')
    const parsed = JSON.parse(readFileSync(lockPath, 'utf8'))
    expect(parsed.skills).toEqual({ beta: { source: 'o/r' } })
  })

  it('нет записи / нет файла → тихо игнорирует', async () => {
    await expect(removeGlobalLockEntry('ghost')).resolves.toBeUndefined()
    writeFileSync(lockPath, JSON.stringify({ version: 3, skills: { beta: {} } }))
    await removeGlobalLockEntry('ghost')
    expect(JSON.parse(readFileSync(lockPath, 'utf8')).skills).toEqual({ beta: {} })
  })
})
