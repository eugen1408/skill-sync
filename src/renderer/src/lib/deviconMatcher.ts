import baseDeviconMap from './devicon-map.json'

const customAliases: Record<string, string> = {
  // Популярные сокращения и библиотеки
  'vue': 'vuejs',
  'reactjs': 'react',
  'js': 'javascript',
  'ts': 'typescript',
  'cpp': 'cplusplus',
  'cxx': 'cplusplus',
  'cs': 'csharp',
  'golang': 'go',
  'kmp': 'kotlin',
  'py': 'python',
  'pybotx': 'python',
  'swiftui': 'swift',
  'next': 'nextjs',
  'nuxt': 'nuxtjs',
  
  // ОС / Платформы
  'mac': 'apple',
  'macos': 'apple',
  'ios': 'apple',
  'iphone': 'apple',
  'ipad': 'apple',
  'win': 'windows8',
  'windows': 'windows8',
  
  // ИИ / ML / Данные
  'ai': 'tensorflow',
  'ml': 'tensorflow',
  'llm': 'tensorflow',
  'neural': 'tensorflow',
  'data': 'pandas',
  'bot': 'android',
  'robot': 'ros',
  
  // Общая терминология
  'log': 'logstash',
  'logging': 'logstash',
  'db': 'sqldeveloper',
  'sql': 'sqldeveloper',
  'database': 'sqldeveloper',
  'backend': 'nodejs',
  'frontend': 'html5',
  'ui': 'figma',
  'ux': 'figma',
  'design': 'figma',
  'api': 'bash',
  'terminal': 'bash',
  'console': 'bash',
  'script': 'bash',
  
  // DevOps / Testing
  'ci': 'jenkins',
  'cd': 'jenkins',
  'pipeline': 'jenkins',
  'devops': 'docker',
  'test': 'jest',
  'testing': 'jest',
  'qa': 'jest',
  'k8s': 'kubernetes',
  'gcp': 'googlecloud',
  'cloud': 'googlecloud',
}

// Объединяем базовый маппинг и наши алиасы
const deviconMap = { ...baseDeviconMap, ...customAliases }

// Сортируем ключи по убыванию длины, чтобы находить более длинные специфичные слова раньше
const sortedKeys = Object.keys(deviconMap).sort((a, b) => b.length - a.length)

const regexCache = new Map<string, RegExp>()

function getWordRegex(key: string): RegExp {
  let regex = regexCache.get(key)
  if (!regex) {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    // Ищем точное совпадение слова, НО допускаем любые цифры или суффикс "js" в конце слова 
    // (напр. svelte -> svelte5, vue -> vuejs).
    regex = new RegExp(`(?:^|[^a-z0-9])${escapedKey}(?:[0-9]*|js)?(?:[^a-z0-9]|$)`, 'i')
    regexCache.set(key, regex)
  }
  return regex
}

export function getIconForSkill(skillId: string, description?: string | null): string | null {
  const text = `${skillId} ${description || ''}`.toLowerCase()

  for (const key of sortedKeys) {
    if (text.includes(key)) {
      if (getWordRegex(key).test(text)) {
        return (deviconMap as Record<string, string>)[key]
      }
    }
  }

  return null
}
