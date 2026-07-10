import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const LEVELS: readonly Level[] = ['debug', 'info', 'warn', 'error']

/** Валидирует строку уровня логирования (напр. из env), иначе null. */
export function parseLevel(value: string | undefined | null): Level | null {
  return value && (LEVELS as readonly string[]).includes(value) ? (value as Level) : null
}

let logFile: string | null = null
let minLevel: Level = 'info'

/** Настраивает файловое логирование (вызывается из main после app.ready). */
export function initLogger(logDir: string, level: Level = 'info'): void {
  try {
    mkdirSync(logDir, { recursive: true })
    logFile = join(logDir, 'main.log')
    minLevel = level
  } catch {
    logFile = null
  }
}

function write(level: Level, args: unknown[]): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${args
    .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
    .join(' ')}`
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](line)
  if (logFile) {
    try {
      appendFileSync(logFile, line + '\n')
    } catch {
      /* игнорируем ошибки записи лога */
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const logger = {
  debug: (...args: unknown[]): void => write('debug', args),
  info: (...args: unknown[]): void => write('info', args),
  warn: (...args: unknown[]): void => write('warn', args),
  error: (...args: unknown[]): void => write('error', args)
}
