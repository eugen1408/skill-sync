import { symlink, cp, rm, mkdir, stat, lstat } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function pathExists(p: string): Promise<boolean> {
  try {
    await lstat(p)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory()
  } catch {
    return false
  }
}

/** true — путь существует и является симлинком (а не реальной папкой/файлом). */
export async function isSymlink(p: string): Promise<boolean> {
  try {
    return (await lstat(p)).isSymbolicLink()
  } catch {
    return false
  }
}

/** Удаляет файл/симлинк/каталог по пути (идемпотентно). */
export async function removePath(target: string): Promise<void> {
  await rm(target, { recursive: true, force: true })
}

/**
 * Создаёт симлинк `linkPath` → `canonical`; при недоступности симлинков (напр. Windows
 * без прав) — копирует каталог. Идемпотентно: существующая цель перезаписывается.
 * Возвращает 'symlink' | 'copy'.
 */
export async function linkOrCopy(canonical: string, linkPath: string): Promise<'symlink' | 'copy'> {
  await mkdir(dirname(linkPath), { recursive: true })
  await removePath(linkPath)
  try {
    await symlink(canonical, linkPath, 'dir')
    return 'symlink'
  } catch {
    await cp(canonical, linkPath, { recursive: true })
    return 'copy'
  }
}

/** Копирует каталог skill в канонический путь (реальные файлы). */
export async function copyInto(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })
  await removePath(dest)
  await cp(src, dest, { recursive: true })
}
