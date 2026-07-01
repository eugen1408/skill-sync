export type AppErrorCode =
  | 'SOURCE_UNAVAILABLE'
  | 'INSTALL_FAILED'
  | 'UPDATE_FAILED'
  | 'VERSION_RESOLVE_FAILED'
  | 'CONFIG_ERROR'
  | 'INTERNAL'

/** Единая сериализуемая модель ошибки для передачи в renderer. */
export interface AppError {
  code: AppErrorCode
  message: string
  cause: string | null
}

export function makeAppError(code: AppErrorCode, message: string, cause?: unknown): AppError {
  return {
    code,
    message,
    cause: cause == null ? null : cause instanceof Error ? cause.message : String(cause)
  }
}
