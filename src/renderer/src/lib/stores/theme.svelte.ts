export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'skill-sync:theme-mode'

function readSaved(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

/**
 * Тема оформления (follow-up [14]). Переключает класс .dark на <html>; Skeleton через
 * light-dark()/color-scheme подхватывает изменение. Предпочтение хранится в localStorage
 * (UI-настройка, вне конфигурации приложения).
 */
class ThemeStore {
  mode = $state<ThemeMode>('system')
  private mql: MediaQueryList | null = null
  private readonly onSystemChange = (): void => this.apply()

  /** Применяет сохранённую тему как можно раньше (можно звать до монтирования UI). */
  init(): void {
    this.mode = readSaved()
    this.mql = window.matchMedia('(prefers-color-scheme: dark)')
    this.mql.addEventListener('change', this.onSystemChange)
    this.apply()
  }

  destroy(): void {
    this.mql?.removeEventListener('change', this.onSystemChange)
    this.mql = null
  }

  set(mode: ThemeMode): void {
    this.mode = mode
    localStorage.setItem(STORAGE_KEY, mode)
    this.apply()
  }

  private get isDark(): boolean {
    if (this.mode === 'system') return this.mql?.matches ?? false
    return this.mode === 'dark'
  }

  private apply(): void {
    document.documentElement.classList.toggle('dark', this.isDark)
  }
}

export const theme = new ThemeStore()
