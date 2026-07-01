import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { VersionPorts } from './types'
import { logger } from '../logger'

const exec = promisify(execFile)

const SKIP_DIRS = new Set(['.git', 'node_modules'])

function githubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined
}

/** Реальные реализации внешних зависимостей стратегий версий. */
export function createVersionPorts(): VersionPorts {
  return {
    github: {
      async getFolderTreeSha(owner, repo, ref, skillPath) {
        const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
          ref
        )}?recursive=1`
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'skill-sync'
        }
        const token = githubToken()
        if (token) headers.Authorization = `Bearer ${token}`

        try {
          const res = await fetch(url, { headers })
          if (!res.ok) {
            // 403 + исчерпанный лимит → «неизвестно» (не бросаем).
            logger.warn(`GitHub trees API ${owner}/${repo}@${ref}: HTTP ${res.status}`)
            return null
          }
          const body = (await res.json()) as {
            sha: string
            tree: Array<{ path: string; type: string; sha: string }>
          }
          const folderPath = normalizeFolderPath(skillPath)
          if (!folderPath) return body.sha
          const entry = body.tree.find((t) => t.type === 'tree' && t.path === folderPath)
          return entry?.sha ?? null
        } catch (err) {
          logger.warn('GitHub trees API недоступен', err)
          return null
        }
      }
    },
    git: {
      async listRemoteTags(url) {
        try {
          const { stdout } = await exec('git', ['ls-remote', '--tags', '--refs', url], {
            timeout: 30_000
          })
          return stdout
            .split('\n')
            .map((line) => line.split('\t')[1])
            .filter((ref): ref is string => Boolean(ref))
            .map((ref) => ref.replace('refs/tags/', ''))
        } catch (err) {
          logger.warn(`git ls-remote --tags ${url}`, err)
          return []
        }
      },
      async getRemoteRefSha(url, ref) {
        try {
          const { stdout } = await exec('git', ['ls-remote', url, ref], { timeout: 30_000 })
          const sha = stdout.split('\t')[0]?.trim()
          return sha || null
        } catch (err) {
          logger.warn(`git ls-remote ${url} ${ref}`, err)
          return null
        }
      },
      async lastCommitShaForPath(localDir, subpath) {
        try {
          const args = ['-C', localDir, 'log', '-1', '--format=%H', '--', subpath ?? '.']
          const { stdout } = await exec('git', args, { timeout: 30_000 })
          return stdout.trim() || null
        } catch (err) {
          logger.warn(`git log в ${localDir}`, err)
          return null
        }
      }
    },
    files: {
      computeFolderHash,
      readChangelogTopVersion
    }
  }
}

function normalizeFolderPath(skillPath: string | null): string | null {
  if (!skillPath) return null
  return skillPath.replace(/\/?SKILL\.md$/i, '').replace(/\/$/, '') || null
}

/** SHA-256 по отсортированным файлам папки (аналог computedHash CLI). */
export async function computeFolderHash(dir: string): Promise<string> {
  const files: string[] = []
  await walk(dir, files)
  files.sort()
  const hash = createHash('sha256')
  for (const file of files) {
    const rel = relative(dir, file).split(sep).join('/')
    hash.update(rel)
    hash.update(await readFile(file))
  }
  return hash.digest('hex')
}

async function walk(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      await walk(join(dir, entry.name), out)
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name))
    }
  }
}

const CHANGELOG_VERSION_RE = /^#{1,3}\s*\[?v?(\d+\.\d+(?:\.\d+)?)/m

/** Верхняя (первая) версия из CHANGELOG.md, либо null. */
export async function readChangelogTopVersion(dir: string): Promise<string | null> {
  try {
    const content = await readFile(join(dir, 'CHANGELOG.md'), 'utf8')
    const m = CHANGELOG_VERSION_RE.exec(content)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function pathExistsInternal(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

export { pathExistsInternal as pathExists }
