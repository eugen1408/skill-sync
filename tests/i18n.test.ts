// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

const ls = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => ls.set(k, String(v)),
  removeItem: (k: string) => ls.delete(k),
  clear: () => ls.clear()
})

const { messages } = await import('../src/shared/i18n/messages')
const { i18n, t } = await import('../src/renderer/src/lib/i18n.svelte')

beforeEach(() => {
  ls.clear()
  i18n.set('en')
})

describe('messages catalog', () => {
  it('en и ru содержат один и тот же набор ключей', () => {
    const en = Object.keys(messages.en).sort()
    const ru = Object.keys(messages.ru).sort()
    expect(ru).toEqual(en)
  })

  it('нет пустых значений', () => {
    for (const locale of ['en', 'ru'] as const) {
      for (const [key, value] of Object.entries(messages[locale])) {
        expect(value, `${locale}:${key}`).not.toBe('')
      }
    }
  })
})

describe('t()', () => {
  it('возвращает строку выбранной локали', () => {
    i18n.set('en')
    expect(t('nav.catalog')).toBe('Catalog')
    i18n.set('ru')
    expect(t('nav.catalog')).toBe('Каталог')
  })

  it('подставляет параметры {name}', () => {
    i18n.set('en')
    expect(t('toast.sourceAdded', { name: 'acme' })).toBe('Source acme added')
    expect(t('catalog.total', { count: 42 })).toBe('Total: 42')
  })

  it('set() сохраняет предпочтение в localStorage', () => {
    i18n.set('ru')
    expect(ls.get('skill-sync:locale')).toBe('ru')
  })
})
