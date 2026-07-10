import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Source } from '@shared/domain/source'
import type { IndexContext } from './types'
import { makeAppError } from '@shared/domain/error'
import { resolvedPath } from '../installer/resolvePath'
import { KeyedQueue } from '../util/keyedQueue'

const exec = promisify(execFile)
const GIT_TIMEOUT = 120_000

/**
 * Кэш постоянных клонов Git-источников (Q2-01): при первом обращении — shallow-clone,
 * при последующих — fetch + reset. Аутентификация опирается на системный git/ssh (Q-04).
 */
export class GitCache {
  constructor(private readonly baseDir: string) {}

  /**
   * Сериализация `ensure` по source.id: несколько skills из одного репозитория делят рабочий
   * каталог клона, а параллельные `git fetch`/`reset --hard` конфликтуют по `.git/index.lock`
   * и падают. Из-за этого «обновить все» останавливалось после первого skill общего репозитория.
   */
  private readonly ensureQueue = new KeyedQueue()

  dirFor(source: Source): string {
    return join(this.baseDir, source.id)
  }

  /**
   * Каталог уже существующего клона (репозиторий root), либо null, если клон ещё не создан.
   * Не обращается к сети — пригодно для offline-проверки версий (follow-up [6]).
   */
  async existingDir(source: Source): Promise<string | null> {
    const dir = this.dirFor(source)
    return (await this.isRepo(dir)) ? dir : null
  }

  /** Гарантирует актуальный локальный клон; возвращает каталог для обхода (с учётом subpath). */
  ensure(source: Source, ctx: IndexContext): Promise<string> {
    return this.ensureQueue.run(source.id, () => this.ensureInner(source, ctx))
  }

  private async ensureInner(source: Source, ctx: IndexContext): Promise<string> {
    const url = source.config.url?.trim()
    if (!url) throw makeAppError('SOURCE_UNAVAILABLE', 'Не задан URL Git-репозитория')

    const dir = this.dirFor(source)
    const ref = source.config.ref?.trim() || null
    await mkdir(this.baseDir, { recursive: true })

    const cloned = await this.isRepo(dir)
    if (!cloned) {
      ctx.progress(null, 'Клонирование репозитория…')
      const args = ['clone', '--depth', '1']
      if (ref) args.push('--branch', ref)
      args.push(url, dir)
      await this.git(args, ctx)
    } else {
      ctx.progress(null, 'Обновление репозитория…')
      await this.git(['-C', dir, 'fetch', '--depth', '1', 'origin', ref ?? 'HEAD'], ctx)
      await this.git(['-C', dir, 'reset', '--hard', 'FETCH_HEAD'], ctx)
    }

    const subpath = source.config.subpath?.trim()
    return subpath ? join(dir, subpath) : dir
  }

  private async isRepo(dir: string): Promise<boolean> {
    try {
      await stat(join(dir, '.git'))
      return true
    } catch {
      return false
    }
  }

  private async git(args: string[], ctx: IndexContext): Promise<void> {
    try {
      // Расширенный PATH: GUI-приложение macOS не наследует shell-PATH (follow-up A2).
      const { stderr } = await exec('git', args, {
        signal: ctx.signal,
        timeout: GIT_TIMEOUT,
        env: { ...process.env, PATH: resolvedPath() }
      })
      if (stderr) ctx.log('err', stderr.trim())
    } catch (err) {
      throw makeAppError('SOURCE_UNAVAILABLE', `git ${args[0]} не удался`, err)
    }
  }
}
