/**
 * Очищает вывод CLI: удаляет ANSI-escape, курсорные последовательности превращает
 * в перевод строки и схлопывает спам спиннеров — чтобы renderer показывал лог как
 * читаемый текст, а детекция «already installed» не спотыкалась об escape-коды.
 * Портировано из reference-installer (cleanCliOutput.ts).
 */
// eslint-disable-next-line no-control-regex
const NEWLINE_CSI = /(\x1B\[\d*[GDJ])+/g
// eslint-disable-next-line no-control-regex
const INLINE_ERASE = /\x1B\[\d*K/g
// eslint-disable-next-line no-control-regex
const CSI = /\x1B\[[0-?]*[ -/]*[@-~]/g
// eslint-disable-next-line no-control-regex
const SIMPLE_ESC = /\x1B[78@-Z\\-_]/g
const SPINNER = /^[◒◐◓◑◴◷◶◵⣾⣽⣻⢿⡿⣟⣯⣷●○\s]+/

export function cleanCliOutput(text: string): string {
  if (!text) return ''
  const stripped = text
    .replace(NEWLINE_CSI, '\n')
    .replace(INLINE_ERASE, '')
    .replace(CSI, '')
    .replace(SIMPLE_ESC, '')
    .replace(/\r\n?/g, '\n')
  return dedupConsecutive(stripped)
}

function dedupConsecutive(text: string): string {
  const out: string[] = []
  let lastNormalized: string | null = null
  for (const line of text.split('\n')) {
    const normalized = line.replace(SPINNER, '').trim()
    if (normalized && normalized === lastNormalized) continue
    if (normalized) lastNormalized = normalized
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}
