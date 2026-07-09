import { spawn } from 'node:child_process'
import type { InstallScope } from '@shared/domain/config'
import type { JobContext } from '../jobs/JobRunner'
import { makeAppError } from '@shared/domain/error'
import type { CliCheckResult } from '@shared/domain/install'
import { cleanCliOutput } from './cleanCliOutput'
import { resolveBinary, resolvedPath } from './resolvePath'

/** Зафиксированная версия CLI (Q-03): обновляется осознанно вместе с релизами приложения. */
export const PINNED_SKILLS_VERSION = '1.5.14'

/** Безопасные токены аргументов CLI (защита от shell-инъекций, shell:true на Windows). */
const SAFE_TOKEN = /^[\w./@:+#-]+$/

export function assertSafeToken(token: string): void {
  if (!SAFE_TOKEN.test(token)) {
    throw makeAppError('INSTALL_FAILED', `Небезопасный идентификатор источника: ${token}`)
  }
}

export interface OfficialArgsInput {
  sourceRef: string
  agents: string[]
  scope: InstallScope
  force: boolean
  cliPath: string | null
}

/** Собирает команду и аргументы `npx skills add …` (или явного бинаря CLI). */
export function buildOfficialInvocation(input: OfficialArgsInput): {
  command: string
  args: string[]
} {
  assertSafeToken(input.sourceRef)
  const isWin = process.platform === 'win32'
  const command = input.cliPath ?? (isWin ? 'npx.cmd' : 'npx')
  const args: string[] = []
  if (!input.cliPath) args.push('-y', `skills@${PINNED_SKILLS_VERSION}`)
  args.push('add', input.sourceRef)
  // `skills add` знает только `-g` (глобально). Проектный scope — дефолт, флага `-p` у него нет.
  if (input.scope === 'global') args.push('-g')
  args.push('-y')
  if (input.force) args.push('--force')
  for (const agent of input.agents) args.push('-a', agent)
  return { command, args }
}

const ALREADY_INSTALLED = [/already\s+installed/i, /\bskipped\b/i, /up[-\s]?to[-\s]?date/i]

export function detectAlreadyInstalled(output: string): boolean {
  return ALREADY_INSTALLED.some((re) => re.test(output))
}

export interface CliRunResult {
  code: number | null
  output: string
  /** Хвост stderr для диагностики ошибок (follow-up A3). */
  stderr: string
  /** Фактически запущенная команда (может быть резолвнута в абсолютный путь). */
  command: string
}

/** Оставляет последние N строк для компактной диагностики. */
export function tail(text: string, lines = 20): string {
  return text.split('\n').filter(Boolean).slice(-lines).join('\n')
}

/** Запускает CLI, стримит вывод в лог задачи, поддерживает отмену/kill по сигналу. */
export function runCli(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  ctx: JobContext
): Promise<CliRunResult> {
  // Резолвим бинарь через расширенный PATH (macOS GUI не наследует shell-PATH, follow-up A2).
  const resolvedCommand = resolveBinary(command) ?? command
  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    })
    let output = ''
    let errOutput = ''
    const onAbort = (): void => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2000)
    }
    ctx.signal.addEventListener('abort', onAbort, { once: true })

    const onData = (raw: string, stream: 'out' | 'err'): void => {
      const cleaned = cleanCliOutput(raw)
      if (!cleaned) return
      output += cleaned + '\n'
      if (stream === 'err') errOutput += cleaned + '\n'
      ctx.log(stream, cleaned)
    }
    child.stdout.on('data', (chunk: Buffer) => onData(chunk.toString(), 'out'))
    child.stderr.on('data', (chunk: Buffer) => onData(chunk.toString(), 'err'))
    child.on('error', (err: NodeJS.ErrnoException) => {
      ctx.signal.removeEventListener('abort', onAbort)
      const notFound = err.code === 'ENOENT'
      const suggestion = notFound
        ? `Не найден исполняемый файл «${command}». Установите Node.js/skills или укажите путь к CLI в Настройках → «Путь к исполняемому файлу skills».`
        : undefined
      reject(
        makeAppError(
          'INSTALL_FAILED',
          notFound
            ? `Не найден исполняемый файл: ${command} (${err.code})`
            : `Не удалось запустить ${command}`,
          err,
          {
            command: resolvedCommand,
            args,
            exitCode: null,
            stderr: tail(errOutput),
            suggestion
          }
        )
      )
    })
    child.on('close', (code) => {
      ctx.signal.removeEventListener('abort', onAbort)
      resolve({ code, output, stderr: tail(errOutput), command: resolvedCommand })
    })
  })
}

/** Готовит окружение для запуска CLI (неинтерактивно, опциональный npm-registry). */
export function cliEnv(npmRegistry: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Расширенный PATH: GUI-приложение macOS не наследует shell-PATH (follow-up A2).
    PATH: resolvedPath(),
    CI: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    npm_config_yes: 'true'
  }
  if (npmRegistry) env.npm_config_registry = npmRegistry
  return env
}

/**
 * Проверяет работоспособность CLI (`skills --version`): резолвит бинарь в расширенном PATH,
 * запускает с таймаутом и возвращает версию/ошибку для показа в настройках (follow-up UI).
 */
export function checkCliVersion(cliPath: string | null): Promise<CliCheckResult> {
  const isWin = process.platform === 'win32'
  const baseCmd = cliPath ?? (isWin ? 'npx.cmd' : 'npx')
  const args = cliPath
    ? ['--version']
    : ['-y', `skills@${PINNED_SKILLS_VERSION}`, '--version']
  const command = resolveBinary(baseCmd) ?? baseCmd
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: cliEnv(null),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
      timeout: 20_000
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (c: Buffer) => (out += c.toString()))
    child.stderr.on('data', (c: Buffer) => (err += c.toString()))
    child.on('error', (e: NodeJS.ErrnoException) =>
      resolve({
        ok: false,
        version: '',
        error: e.code === 'ENOENT' ? `${baseCmd}: не найден в PATH` : e.message
      })
    )
    child.on('close', (code) => {
      const lastLine = (line: string): string =>
        line.trim().split('\n').filter(Boolean).slice(-1)[0] ?? ''
      if (code === 0) {
        resolve({ ok: true, version: lastLine(cleanCliOutput(out) || cleanCliOutput(err)) || 'ok', error: '' })
      } else {
        resolve({ ok: false, version: '', error: lastLine(cleanCliOutput(err)) || `код ${code}` })
      }
    })
  })
}
