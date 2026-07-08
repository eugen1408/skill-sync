import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, delimiter } from 'node:path'
import { logger } from '../logger'

/**
 * Разрешение PATH и бинарей для запуска CLI (follow-up A2).
 *
 * GUI-приложение macOS, запущенное из Finder/Applications, не наследует PATH из
 * пользовательского shell — поэтому `npx`/`skills` из `/opt/homebrew/bin` не находятся.
 * Здесь мы один раз при старте собираем расширенный PATH: PATH из login-shell +
 * стандартные каталоги + npm-global — и используем его при spawn CLI.
 */

/** Стандартные каталоги бинарей (Homebrew ARM/Intel + системные). */
const STANDARD_BIN_DIRS =
  process.platform === 'win32'
    ? []
    : [
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/local/sbin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin'
      ]

let cachedPath: string | null = null

/** Получает PATH из login-interactive shell пользователя. null — если не удалось. */
function loginShellPath(): Promise<string | null> {
  if (process.platform === 'win32') return Promise.resolve(null)
  const shell = process.env.SHELL || '/bin/zsh'
  return new Promise((resolve) => {
    try {
      const child = spawn(shell, ['-ilc', 'printf %s "$PATH"'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000
      })
      let out = ''
      child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()))
      child.on('error', () => resolve(null))
      child.on('close', () => resolve(out.trim() || null))
    } catch {
      resolve(null)
    }
  })
}

/**
 * Инициализирует расширенный PATH (login-shell + стандартные каталоги + npm-global) и кеширует.
 * Вызывается один раз при старте приложения. Идемпотентно.
 */
export async function initEnvPath(): Promise<string> {
  const parts: string[] = []
  const shellPath = await loginShellPath()
  if (shellPath) parts.push(...shellPath.split(delimiter))
  if (process.env.PATH) parts.push(...process.env.PATH.split(delimiter))
  parts.push(...STANDARD_BIN_DIRS)
  parts.push(join(homedir(), '.local', 'bin'))
  parts.push(join(homedir(), '.npm-global', 'bin'))

  const seen = new Set<string>()
  const merged = parts.filter((p) => p && !seen.has(p) && (seen.add(p), true))
  cachedPath = merged.join(delimiter)
  logger.info('PATH для CLI инициализирован', {
    entries: merged.length,
    fromLoginShell: Boolean(shellPath)
  })
  return cachedPath
}

/** Текущий расширенный PATH (после initEnvPath); fallback — process.env.PATH. */
export function resolvedPath(): string {
  return cachedPath ?? process.env.PATH ?? ''
}

/**
 * Резолвит абсолютный путь исполняемого файла в расширенном PATH.
 * Абсолютный/относительный путь с разделителем — проверяется как есть. null — не найден.
 */
export function resolveBinary(name: string): string | null {
  if (name.includes('/') || name.includes('\\')) return existsSync(name) ? name : null
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : ['']
  for (const dir of resolvedPath().split(delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      const full = join(dir, name + ext)
      if (existsSync(full)) return full
    }
  }
  return null
}
