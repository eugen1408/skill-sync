export interface VirtualWindow {
  /** Индекс первого рендеримого элемента. */
  start: number
  /** Индекс за последним рендеримым элементом (exclusive). */
  end: number
  /** Отступ-заглушка сверху (px) под невидимые элементы до start. */
  padTop: number
  /** Полная высота списка (px) для скролл-спейсера. */
  totalHeight: number
}

/**
 * Вычисляет окно видимых элементов для виртуального списка с фиксированной высотой строки.
 * `overscan` — сколько строк дорисовывать выше/ниже вьюпорта, чтобы скролл был плавным.
 */
export function computeWindow(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan = 4
): VirtualWindow {
  const totalHeight = count * rowHeight
  if (count === 0 || rowHeight <= 0) {
    return { start: 0, end: 0, padTop: 0, totalHeight }
  }
  const safeScroll = Math.max(0, Math.min(scrollTop, Math.max(0, totalHeight - viewportHeight)))
  const first = Math.floor(safeScroll / rowHeight)
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight)
  const start = Math.max(0, first - overscan)
  const end = Math.min(count, first + visible + overscan)
  return { start, end, padTop: start * rowHeight, totalHeight }
}
