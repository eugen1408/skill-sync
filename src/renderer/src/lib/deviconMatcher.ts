import deviconMap from './devicon-map.json'

// Сортируем ключи по убыванию длины, чтобы находить "react-router" раньше "react"
const sortedKeys = Object.keys(deviconMap).sort((a, b) => b.length - a.length)

const regexCache = new Map<string, RegExp>()

function getWordRegex(key: string): RegExp {
  let regex = regexCache.get(key)
  if (!regex) {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    // Ищем точное совпадение слова. Разделителями могут быть пробелы, дефисы, подчеркивания и т.д.
    regex = new RegExp(`(?:^|[^a-z0-9])${escapedKey}(?:[^a-z0-9]|$)`, 'i')
    regexCache.set(key, regex)
  }
  return regex
}

export function getIconForSkill(skillId: string, description?: string | null): string | null {
  const text = `${skillId} ${description || ''}`.toLowerCase()

  for (const key of sortedKeys) {
    // Быстрая проверка
    if (text.includes(key)) {
      // Строгая проверка по границам слова
      if (getWordRegex(key).test(text)) {
        return (deviconMap as Record<string, string>)[key]
      }
    }
  }

  return null
}
