export type AppErrorCode =
  | 'SOURCE_UNAVAILABLE'
  | 'INSTALL_FAILED'
  | 'UPDATE_FAILED'
  | 'VERSION_RESOLVE_FAILED'
  | 'CONFIG_ERROR'
  | 'INTERNAL'

/**
 * Диагностический контекст ошибки установки/обновления для показа в событиях (follow-up A3):
 * позволяет пользователю понять, что именно и почему упало, без чтения логов приложения.
 */
export interface AppErrorDetails {
  /** Имя skill, с которым связана ошибка. */
  skillName?: string
  /** Источник (id/имя) и его ref. */
  sourceId?: string
  sourceRef?: string
  /** Запущенная команда CLI и её аргументы. */
  command?: string
  args?: string[]
  /** Код завершения процесса (null — не завершился штатно). */
  exitCode?: number | null
  /** Хвост stderr/stdout процесса. */
  stderr?: string
  /** Ожидавшийся путь (напр. каталог источника/канон). */
  expectedPath?: string
  /** Рекомендация пользователю, что делать дальше. */
  suggestion?: string
}

/** Единая сериализуемая модель ошибки для передачи в renderer. */
export interface AppError {
  code: AppErrorCode
  message: string
  cause: string | null
  details?: AppErrorDetails
}

export function makeAppError(
  code: AppErrorCode,
  message: string,
  cause?: unknown,
  details?: AppErrorDetails
): AppError {
  return {
    code,
    message,
    cause: cause == null ? null : cause instanceof Error ? cause.message : String(cause),
    ...(details ? { details } : {})
  }
}
