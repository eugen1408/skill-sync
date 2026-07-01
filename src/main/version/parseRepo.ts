export interface RepoRef {
  owner: string
  repo: string
}

/**
 * Извлекает owner/repo из GitHub-URL или shorthand.
 * Поддержка: https://github.com/o/r(.git), git@github.com:o/r.git, o/r.
 */
export function parseGithubRepo(url: string | null): RepoRef | null {
  if (!url) return null
  const trimmed = url.trim()

  const ssh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i.exec(trimmed)
  if (ssh) return { owner: ssh[1], repo: ssh[2] }

  const https = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/i.exec(trimmed)
  if (https) return { owner: https[1], repo: https[2] }

  const shorthand = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(trimmed)
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] }

  return null
}
