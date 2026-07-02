import { cpus } from 'node:os'

export interface ConcurrencyOptions {
  /** Имя env-переменной для явного переопределения (напр. SKILLS_INSTALL_CONCURRENCY). */
  envVar: string
  /** Нижняя граница (по умолчанию 1). */
  min?: number
  /** Верхняя граница (по умолчанию 16). */
  max?: number
  /** Значение, если число CPU определить не удалось (по умолчанию min). */
  fallback?: number
}

/**
 * Разрешает уровень параллелизма: сначала валидный env-override, иначе — число ядер CPU,
 * зажатое в [min, max]. Позволяет масштабировать проверки/установки под железо и
 * переопределять их вручную без пересборки (follow-up [18]).
 */
export function resolveConcurrency(opts: ConcurrencyOptions): number {
  const { envVar, min = 1, max = 16 } = opts
  const clamp = (n: number): number => Math.min(max, Math.max(min, Math.floor(n)))

  const raw = process.env[envVar]
  if (raw !== undefined && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 1) return clamp(n)
  }

  const cores = cpus().length
  if (cores > 0) return clamp(cores)
  return clamp(opts.fallback ?? min)
}
