import { stat } from 'node:fs/promises'
import type { Source, RawSkill } from '@shared/domain/source'
import { makeAppError } from '@shared/domain/error'
import type { SourceAdapter, IndexContext } from '../types'
import { discoverSkills } from '../skillDiscovery'

/** Локальный источник: сканирует указанный каталог на SKILL.md. Поддерживает watch. */
export class LocalSourceAdapter implements SourceAdapter {
  readonly type = 'local' as const
  readonly supportsWatch = true

  async validate(source: Source): Promise<void> {
    const path = source.config.localPath?.trim()
    if (!path) throw makeAppError('SOURCE_UNAVAILABLE', 'Не задан путь локального каталога')
    try {
      const info = await stat(path)
      if (!info.isDirectory()) {
        throw makeAppError('SOURCE_UNAVAILABLE', 'Указанный путь не является каталогом')
      }
    } catch (err) {
      if ((err as { code?: string })?.code === 'ENOENT') {
        throw makeAppError('SOURCE_UNAVAILABLE', 'Локальный каталог не найден')
      }
      throw err
    }
  }

  async listSkills(source: Source, ctx: IndexContext): Promise<RawSkill[]> {
    const path = source.config.localPath!.trim()
    ctx.progress(null, 'Сканирование каталога…')
    return discoverSkills(path)
  }
}
