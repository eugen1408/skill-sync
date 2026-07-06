import { messages, type Locale, type MessageKey, type LocalePref } from '@shared/i18n/messages'

export type { LocalePref }

// Кэш предпочтения для мгновенного первого рендера (до загрузки конфига по IPC).
// Источник истины — конфиг (`ui.language`), доступный и main-процессу (трей).
const STORAGE_KEY = 'skill-sync:locale'

/** Язык системы (Electron/Chromium отдаёт локаль ОС через navigator.languages). */
function systemLocale(): Locale {
  const langs =
    typeof navigator !== 'undefined'
      ? (navigator.languages ?? [navigator.language]).filter(Boolean)
      : []
  return langs.some((l) => l.toLowerCase().startsWith('ru')) ? 'ru' : 'en'
}

function readSaved(): LocalePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'en' || v === 'ru' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Локализация UI (item 9). Предпочтение (system/en/ru) хранится в конфиге (`ui.language`),
 * localStorage — лишь кэш для мгновенного первого рендера. `t()` реактивен: читает
 * `i18n.locale` ($state), поэтому смена языка сразу перерисовывает все строки.
 */
class I18n {
  pref = $state<LocalePref>('system')
  private sys = $state<Locale>('en')

  /** Применяет сохранённый язык как можно раньше (до монтирования UI). */
  init(): void {
    this.sys = systemLocale()
    this.pref = readSaved()
  }

  get locale(): Locale {
    return this.pref === 'system' ? this.sys : this.pref
  }

  set(pref: LocalePref): void {
    this.pref = pref
    try {
      localStorage.setItem(STORAGE_KEY, pref)
    } catch {
      // недоступность localStorage не критична
    }
  }
}

export const i18n = new I18n()

/** Перевод по ключу с подстановкой параметров вида `{name}`. Фолбэк: en → сам ключ. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let str: string = messages[i18n.locale][key] ?? messages.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v))
    }
  }
  return str
}

/** Дата + время в выбранной локали. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

/** Только дата в выбранной локали. */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium' }).format(new Date(iso))
}

/** Только время в выбранной локали. */
export function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat(i18n.locale, { timeStyle: 'short' }).format(new Date(iso))
}
