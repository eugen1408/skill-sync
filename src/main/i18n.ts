import { app } from 'electron'
import { messages, type Locale, type LocalePref, type MessageKey } from '@shared/i18n/messages'

/** Разрешает предпочтение языка в конкретную локаль: `system` → по локали ОС (Electron). */
export function resolveLocale(pref: LocalePref): Locale {
  if (pref === 'en' || pref === 'ru') return pref
  const sys = (typeof app?.getLocale === 'function' ? app.getLocale() : '') || ''
  return sys.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

/** Перевод по ключу с подстановкой `{param}` (main-процесс; фолбэк en → ключ). */
export function mt(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  let str: string = messages[locale][key] ?? messages.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{${k}}`, String(v))
  }
  return str
}

/** Плюрализация числа: ru — по правилам склонения, прочие локали — one/many. */
export function plural(locale: Locale, n: number, one: string, few: string, many: string): string {
  if (locale === 'ru') {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return one
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
    return many
  }
  return n === 1 ? one : many
}
