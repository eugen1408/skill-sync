// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Стаб matchMedia (jsdom его не реализует). Управляемое поле matches.
const mql = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
vi.stubGlobal(
  'matchMedia',
  vi.fn(() => mql)
)

// Стаб localStorage (в этой сборке jsdom не предоставляет storage).
const ls = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => ls.set(k, String(v)),
  removeItem: (k: string) => ls.delete(k),
  clear: () => ls.clear()
})

// Импорт после стаба: theme.init() читает matchMedia.
const { theme } = await import('../src/renderer/src/lib/stores/theme.svelte')

const hasDark = (): boolean => document.documentElement.classList.contains('dark')

beforeEach(() => {
  localStorage.clear()
  mql.matches = false
  document.documentElement.classList.remove('dark')
})

describe('theme store', () => {
  it('set(dark) добавляет класс .dark и сохраняет предпочтение', () => {
    theme.set('dark')
    expect(hasDark()).toBe(true)
    expect(localStorage.getItem('skill-sync:theme-mode')).toBe('dark')
  })

  it('set(light) убирает класс .dark', () => {
    theme.set('dark')
    theme.set('light')
    expect(hasDark()).toBe(false)
    expect(localStorage.getItem('skill-sync:theme-mode')).toBe('light')
  })

  it('system следует за prefers-color-scheme', () => {
    theme.init()
    mql.matches = true
    theme.set('system')
    expect(hasDark()).toBe(true)

    mql.matches = false
    theme.set('system')
    expect(hasDark()).toBe(false)
  })

  it('init применяет сохранённое предпочтение', () => {
    localStorage.setItem('skill-sync:theme-mode', 'dark')
    theme.init()
    expect(theme.mode).toBe('dark')
    expect(hasDark()).toBe(true)
  })
})
