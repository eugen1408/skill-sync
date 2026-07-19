import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LockEntry } from './types'
import { logger } from '../logger'

interface LockFile {
  version?: number
  skills?: Record<string, LockEntry>
}

/** Путь глобального lock CLI: $XDG_STATE_HOME/skills/.skill-lock.json или ~/.agents/.skill-lock.json. */
export function globalLockPath(): string {
  const xdg = process.env.XDG_STATE_HOME
  if (xdg) return join(xdg, 'skills', '.skill-lock.json')
  return join(homedir(), '.agents', '.skill-lock.json')
}

async function readLockFile(path: string): Promise<Record<string, LockEntry>> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as LockFile
    return parsed.skills ?? {}
  } catch {
    return {}
  }
}

export function readGlobalLock(): Promise<Record<string, LockEntry>> {
  return readLockFile(globalLockPath())
}

export function readLocalLock(projectDir: string): Promise<Record<string, LockEntry>> {
  return readLockFile(join(projectDir, 'skills-lock.json'))
}

/**
 * Удаляет запись skill из глобального lock CLI (best-effort). Нужна при удалении skill,
 * чтобы он не оставался в `.skill-lock.json` как «установленный». Тихо игнорирует отсутствие.
 */
export async function removeGlobalLockEntry(skillName: string): Promise<void> {
  const path = globalLockPath()
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as LockFile
    if (!parsed.skills || !(skillName in parsed.skills)) return
    delete parsed.skills[skillName]
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
  } catch {
    // Файла нет / не читается / не пишется — не критично для удаления.
  }
}

/** Находит запись skill сначала в локальном (если задан projectDir), затем в глобальном lock. */
export async function findLockEntry(
  skillName: string,
  projectDir?: string
): Promise<LockEntry | null> {
  if (projectDir) {
    const local = await readLocalLock(projectDir)
    if (local[skillName]) return local[skillName]
  }
  const global = await readGlobalLock()
  return global[skillName] ?? null
}

/** Обновляет поля записей skills в глобальном lock CLI. Создает запись, если ее не было. */
export async function updateGlobalLockEntries(
  patches: Record<string, Partial<LockEntry>>
): Promise<void> {
  if (Object.keys(patches).length === 0) return

  const path = globalLockPath()
  let parsed: LockFile = {}

  try {
    const raw = await readFile(path, 'utf8')
    parsed = JSON.parse(raw) as LockFile
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      parsed = { version: 3, skills: {} }
    } else {
      logger.warn('Не удалось прочитать глобальный lock файл для обновления', err)
      return
    }
  }

  if (!parsed.skills) parsed.skills = {}

  for (const [skillName, patch] of Object.entries(patches)) {
    parsed.skills[skillName] = {
      ...(parsed.skills[skillName] || ({} as any)),
      ...patch,
      updatedAt: new Date().toISOString()
    }
  }

  try {
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
  } catch (err) {
    logger.warn('Не удалось сохранить глобальный lock файл после обновления', err)
  }
}
