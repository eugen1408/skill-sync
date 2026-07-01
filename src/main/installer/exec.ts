import { spawn } from 'node:child_process'
import type { InstallScope } from '@shared/domain/config'
import type { JobContext } from '../jobs/JobRunner'
import { makeAppError } from '@shared/domain/error'

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
  args.push('add', input.sourceRef, input.scope === 'global' ? '-g' : '-p', '-y')
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
}

/** Запускает CLI, стримит вывод в лог задачи, поддерживает отмену/kill по сигналу. */
export function runCli(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  ctx: JobContext
): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    })
    let output = ''
    const onAbort = (): void => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2000)
    }
    ctx.signal.addEventListener('abort', onAbort, { once: true })

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      output += text
      ctx.log('out', text.trimEnd())
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      output += text
      ctx.log('err', text.trimEnd())
    })
    child.on('error', (err) => {
      ctx.signal.removeEventListener('abort', onAbort)
      reject(makeAppError('INSTALL_FAILED', `Не удалось запустить ${command}`, err))
    })
    child.on('close', (code) => {
      ctx.signal.removeEventListener('abort', onAbort)
      resolve({ code, output })
    })
  })
}

/** Готовит окружение для запуска CLI (неинтерактивно, опциональный npm-registry). */
export function cliEnv(npmRegistry: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    npm_config_yes: 'true'
  }
  if (npmRegistry) env.npm_config_registry = npmRegistry
  return env
}
