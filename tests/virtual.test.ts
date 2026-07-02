import { describe, it, expect } from 'vitest'
import { computeWindow } from '../src/renderer/src/lib/virtual'

const ROW = 100

describe('computeWindow', () => {
  it('в начале списка рендерит вьюпорт + overscan снизу', () => {
    const w = computeWindow(0, 500, ROW, 100, 4)
    expect(w.start).toBe(0)
    expect(w.end).toBe(9) // ceil(500/100)=5 + overscan 4
    expect(w.padTop).toBe(0)
    expect(w.totalHeight).toBe(10000)
  })

  it('в середине списка окно смещается с overscan сверху и снизу', () => {
    const w = computeWindow(1000, 500, ROW, 100, 4)
    // first = 10 → start = 6, end = 10 + 5 + 4 = 19, padTop = 600
    expect(w.start).toBe(6)
    expect(w.end).toBe(19)
    expect(w.padTop).toBe(600)
  })

  it('не выходит за границы списка', () => {
    const w = computeWindow(100000, 500, ROW, 100, 4)
    expect(w.end).toBe(100)
    expect(w.start).toBeGreaterThanOrEqual(0)
    expect(w.start).toBeLessThan(w.end)
  })

  it('пустой список — нулевое окно', () => {
    const w = computeWindow(0, 500, ROW, 0)
    expect(w).toEqual({ start: 0, end: 0, padTop: 0, totalHeight: 0 })
  })

  it('нулевой вьюпорт (ещё не измерен) рендерит только overscan', () => {
    const w = computeWindow(0, 0, ROW, 100, 4)
    expect(w.start).toBe(0)
    expect(w.end).toBe(4)
  })
})
