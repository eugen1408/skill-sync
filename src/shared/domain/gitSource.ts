import type { GitAuthMode } from './source'

export interface ParsedGitSource {
  /** URL для клонирования (без /tree|/blob-хвоста). */
  url: string
  /** Ветка/тег, если удалось выделить (иначе null). */
  ref: string | null
  /** Путь внутри репозитория, если удалось выделить (иначе null). */
  subpath: string | null
  /** Режим авторизации: ssh для git@/ssh://, иначе https. */
  authMode: GitAuthMode
  /** Отображаемое имя (basename репозитория без .git). */
  name: string
}

// GitHub/GitLab «tree/blob»-ссылки: .../tree/<ref>/<subpath> (GitLab — .../-/tree/...).
const TREE_RE = /^(https?:\/\/[^\s]+?)\/(?:-\/)?(?:tree|blob)\/([^/]+)(?:\/(.+?))?\/?$/i
const SCP_RE = /^(?:git@|ssh:\/\/)/i
const SHORTHAND_RE = /^[\w.-]+\/[\w.-]+$/

export function formatRepoName(url: string): string {
  let s = url.trim().replace(/\.git$/i, '').replace(/\/+$/, '')
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).pathname.replace(/^\/+/, '')
    } catch {}
  }
  const mSsh = /^(?:[^@/]+@)([^:/]+)[:/](.+)$/i.exec(s)
  if (mSsh) return mSsh[2]
  const mSshProto = /^ssh:\/\/(?:[^@/]+@)?([^:/]+)[:/](.+)$/i.exec(s)
  if (mSshProto) return mSshProto[2]
  return s
}

/**
 * Веб-URL git-репозитория для открытия в браузере: SSH (`git@host:owner/repo.git`,
 * `ssh://git@host/owner/repo.git`) → `https://host/owner/repo`. HTTPS — как есть (без .git).
 * Возвращает null, если распознать не удалось.
 */
export function gitRepoWebUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s.replace(/\.git$/i, '').replace(/\/+$/, '')
  const m = /^(?:ssh:\/\/)?(?:[^@/]+@)?([^:/]+)[:/](.+?)(?:\.git)?\/?$/.exec(s)
  return m ? `https://${m[1]}/${m[2]}` : null
}

/**
 * Разбирает вставленную пользователем git-ссылку в параметры источника
 * (url/ref/subpath/authMode/name). Поддерживает HTTPS, SSH (scp-подобный и ssh://),
 * GitHub/GitLab tree/blob-ссылки и shorthand `owner/repo` (→ GitHub HTTPS).
 * Возвращает null, если ввод не похож на git-репозиторий.
 */
export function parseGitSourceInput(raw: string): ParsedGitSource | null {
  const s = raw.trim()
  if (!s) return null

  // shorthand owner/repo → GitHub HTTPS
  if (SHORTHAND_RE.test(s) && !s.includes('://')) {
    return {
      url: `https://github.com/${s.replace(/\.git$/i, '')}`,
      ref: null,
      subpath: null,
      authMode: 'https',
      name: formatRepoName(s)
    }
  }

  const authMode: GitAuthMode = SCP_RE.test(s) ? 'ssh' : 'https'
  let url = s
  let ref: string | null = null
  let subpath: string | null = null

  if (authMode === 'https') {
    const m = TREE_RE.exec(s)
    if (m) {
      url = m[1]
      ref = decodeURIComponent(m[2])
      subpath = m[3] ? decodeURIComponent(m[3]) : null
    }
  }

  url = url.replace(/\/+$/, '')
  const name = formatRepoName(url)
  if (!name) return null
  return { url, ref, subpath, authMode, name }
}
