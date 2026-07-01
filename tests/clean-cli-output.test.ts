import { describe, it, expect } from 'vitest'
import { cleanCliOutput } from '../src/main/installer/cleanCliOutput'

describe('cleanCliOutput', () => {
  it('удаляет ANSI-цвета', () => {
    expect(cleanCliOutput('\x1B[32mOK\x1B[0m')).toBe('OK')
  })

  it('нормализует CRLF в LF', () => {
    expect(cleanCliOutput('a\r\nb')).toBe('a\nb')
  })

  it('схлопывает повторяющиеся строки со спиннером', () => {
    const spinner = ['⣾ Installing', '⣽ Installing', '⣻ Installing', 'Done'].join('\n')
    expect(cleanCliOutput(spinner)).toBe('⣾ Installing\nDone')
  })

  it('пустой вход → пустая строка', () => {
    expect(cleanCliOutput('')).toBe('')
  })
})
