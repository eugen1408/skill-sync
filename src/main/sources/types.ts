import type { Source, SourceType, RawSkill } from '@shared/domain/source'
export type { AddSourceInput } from '@shared/domain/source'

/** Подмножество JobContext, необходимое адаптерам (стрим прогресса/лога, отмена). */
export interface IndexContext {
  readonly signal: AbortSignal
  progress(percent: number | null, message?: string): void
  log(stream: 'out' | 'err', text: string): void
}

/**
 * Адаптер источника. Выбор адаптера по `Source.type`. Добавление нового типа
 * источника не требует изменений в UI — только регистрация нового адаптера.
 */
export interface SourceAdapter {
  readonly type: SourceType
  /** Только Local поддерживает watch. */
  readonly supportsWatch: boolean
  /** Проверка параметров источника; бросает при некорректных. */
  validate(source: Source): Promise<void>
  /** Список доступных skills источника (стримит прогресс/лог). */
  listSkills(source: Source, ctx: IndexContext): Promise<RawSkill[]>
}
