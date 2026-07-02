import { normalizeSkillKey } from '@shared/domain/skill'
import type { GitAuthMode } from '@shared/domain/source'
import type { LockEntry } from '../version'

/** Git-источник, который нужно гарантировать (добавить, если отсутствует) при инициализации. */
export interface EnsureGitSource {
  url: string
  ref: string | null
  authMode: GitAuthMode
  name: string
}

/** Атрибуция одного установленного skill к источнику по данным `.skill-lock.json`. */
export interface SkillAttribution {
  sourceKind: 'git' | 'official'
  /** git: URL для сопоставления с подключённым источником; official: null. */
  sourceUrl: string | null
  /** git: путь папки skill в репозитории (как sourceRef адаптера); official: `owner/repo@slug`. */
  sourceRef: string
}

export interface LockAttributionResult {
  /** Git-источники к добавлению (дедуп по url). */
  sourcesToEnsure: EnsureGitSource[]
  /** Ключ — нормализованное имя skill (`normalizeSkillKey`). */
  attribution: Map<string, SkillAttribution>
}

/**
 * Проверка принадлежности репозитория каталогу skills.sh.
 * true — найден; false — точно не найден; null — определить не удалось (сеть/лимит).
 */
export type RepoClassifier = (ownerRepo: string, skillName: string) => Promise<boolean | null>

function isSshUrl(url: string): boolean {
  return /^git@/i.test(url) || /^ssh:\/\//i.test(url)
}

function hostOf(url: string): string | null {
  const m = /^https?:\/\/([^/]+)/i.exec(url)
  return m ? m[1].toLowerCase() : null
}

/** basename репозитория без `.git` (для имени источника). */
function repoName(url: string): string {
  const part =
    url
      .replace(/\.git$/i, '')
      .split(/[/:]/)
      .filter(Boolean)
      .pop() ?? url
  return part
}

/** Путь папки skill внутри репозитория из `skillPath` (`a/b/SKILL.md` → `a/b`, корень → `.`). */
function skillFolderRef(skillPath: string | undefined): string {
  if (!skillPath) return '.'
  const dir = skillPath.replace(/\\/g, '/').replace(/\/?SKILL\.md$/i, '')
  return dir === '' ? '.' : dir
}

/** Однозначно custom git (без обращения к skills.sh): SSH / не-github / `sourceType: git`. */
function isDefiniteGit(entry: LockEntry): boolean {
  const url = entry.sourceUrl ?? ''
  return entry.sourceType.toLowerCase() === 'git' || isSshUrl(url) || hostOf(url) !== 'github.com'
}

/** Является ли запись кандидатом на атрибуцию (иначе — локальный skill). */
function isAttributable(entry: LockEntry): boolean {
  if (!entry.sourceUrl) return false
  if (entry.sourceType.toLowerCase() === 'local') return false
  return true
}

/**
 * Строит из глобального lock перечень git-источников к добавлению и карту атрибуции
 * установленных skills к источникам. Классифицирует каждый уникальный репозиторий один раз;
 * проверки skills.sh для github-репозиториев выполняются параллельно, чтобы медленный/
 * недоступный каталог не задерживал добавление однозначных git-источников.
 */
export async function buildLockAttribution(
  lock: Record<string, LockEntry>,
  classifier: RepoClassifier
): Promise<LockAttributionResult> {
  const entries = Object.entries(lock).filter(([, e]) => isAttributable(e))

  // Уникальные репозитории (представитель — первая запись репо: имя skill + запись).
  const byUrl = new Map<string, { name: string; entry: LockEntry }>()
  for (const [name, entry] of entries) {
    if (!byUrl.has(entry.sourceUrl!)) byUrl.set(entry.sourceUrl!, { name, entry })
  }

  // git-репозитории — синхронно; github — параллельная проверка в skills.sh.
  const kindByUrl = new Map<string, 'git' | 'official'>()
  const githubUrls: string[] = []
  for (const [url, { entry }] of byUrl) {
    if (isDefiniteGit(entry)) kindByUrl.set(url, 'git')
    else githubUrls.push(url)
  }
  await Promise.all(
    githubUrls.map(async (url) => {
      const { name, entry } = byUrl.get(url)!
      const published = await classifier(entry.source, name)
      // Q8-02: точно не найдено → git; найдено или не удалось определить (null) → official.
      kindByUrl.set(url, published === false ? 'git' : 'official')
    })
  )

  const sourcesByUrl = new Map<string, EnsureGitSource>()
  const attribution = new Map<string, SkillAttribution>()
  for (const [name, entry] of entries) {
    const url = entry.sourceUrl!
    const slug = normalizeSkillKey(name)
    if (!slug) continue

    if (kindByUrl.get(url) === 'git') {
      if (!sourcesByUrl.has(url)) {
        sourcesByUrl.set(url, {
          url,
          ref: entry.ref ?? null,
          authMode: isSshUrl(url) ? 'ssh' : 'https',
          name: repoName(url)
        })
      }
      attribution.set(slug, {
        sourceKind: 'git',
        sourceUrl: url,
        sourceRef: skillFolderRef(entry.skillPath)
      })
    } else {
      attribution.set(slug, {
        sourceKind: 'official',
        sourceUrl: null,
        sourceRef: `${entry.source}@${slug}`
      })
    }
  }

  return { sourcesToEnsure: [...sourcesByUrl.values()], attribution }
}
