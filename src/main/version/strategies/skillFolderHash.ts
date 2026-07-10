import { join } from 'node:path'
import type { ResolveContext, VersionStrategy, VersionPorts } from '../types'
import { parseGithubRepo } from '../parseRepo'
import { parseSemver } from '../semver'

const COMMIT_SHA_RE = /^[0-9a-f]{7,40}$/i

/**
 * Неизменяемый указатель — semver-тег или коммит-SHA: его дерево заморожено и не отражает
 * новый контент. Подвижные ref (ветка/`HEAD`/`null`) продолжают трекаться как есть.
 */
function isPinnedRef(ref: string | null | undefined): boolean {
  if (!ref) return false
  return parseSemver(ref) !== null || COMMIT_SHA_RE.test(ref)
}

/** Каталог папки skill внутри клона: `localDir` + путь skillPath без хвоста `SKILL.md`. */
function skillFolderInClone(localDir: string, skillPath: string | null): string {
  const rel = (skillPath ?? '').replace(/\/?SKILL\.md$/i, '').replace(/\/$/, '')
  return rel ? join(localDir, rel) : localDir
}

/**
 * Стратегия по `skillFolderHash` из `.skill-lock.json` (GitHub tree SHA) либо
 * `computedHash` содержимого. Latest берётся: для local — из каталога-источника,
 * для GitHub — через trees API, для прочих git — из существующего клона (content hash).
 * Обновление есть, если хэши различаются.
 */
export class SkillFolderHashStrategy implements VersionStrategy {
  readonly id = 'skillFolderHash'

  constructor(private readonly ports: VersionPorts) {}

  isApplicable(ctx: ResolveContext): boolean {
    if (ctx.lockEntry?.skillFolderHash || ctx.lockEntry?.computedHash) return true
    if (ctx.sourceType === 'local' && ctx.localPath) return true
    if (parseGithubRepo(ctx.repo.url) && ctx.repo.skillPath) return true
    // Прочий git (GitLab и т.п.): сверяем содержимое установленной копии с клоном источника.
    return Boolean(ctx.repo.localDir && ctx.installPath)
  }

  async resolveInstalled(ctx: ResolveContext): Promise<string | null> {
    // GitHub: installed-базой служит сохранённый tree SHA — он сравним с getFolderTreeSha (latest).
    if (this.isGithubTreeCase(ctx)) {
      if (ctx.lockEntry?.skillFolderHash) return ctx.lockEntry.skillFolderHash
      if (ctx.lockEntry?.computedHash) return ctx.lockEntry.computedHash
      return ctx.installPath ? this.ports.files.computeFolderHash(ctx.installPath) : null
    }
    // local / прочий git: content hash установленной копии — ТЕМ ЖЕ алгоритмом, что и latest.
    // Сохранённый в lock хэш не используем: он заморожен на момент установки и посчитан другим
    // алгоритмом (CLI), из-за чего даже при совпадающем содержимом давал вечное «есть обновление».
    if (ctx.installPath) return this.ports.files.computeFolderHash(ctx.installPath)
    return ctx.lockEntry?.skillFolderHash ?? ctx.lockEntry?.computedHash ?? null
  }

  /**
   * latest будет посчитан через GitHub trees API (tree SHA) — installed тоже должен быть
   * tree SHA (из lock). Должно совпадать с веткой github в resolveLatest: GitHub-URL выигрывает
   * ДАЖЕ при наличии клона (github-репозиторий, добавленный как git-источник, имеет и клон,
   * и распознаётся parseGithubRepo — тогда обе стороны обязаны быть tree SHA, а не content hash).
   */
  private isGithubTreeCase(ctx: ResolveContext): boolean {
    return ctx.sourceType !== 'local' && Boolean(parseGithubRepo(ctx.repo.url))
  }

  async resolveLatest(ctx: ResolveContext): Promise<string | null> {
    if (ctx.sourceType === 'local' && ctx.localPath) {
      return this.ports.files.computeFolderHash(ctx.localPath)
    }
    const repo = parseGithubRepo(ctx.repo.url)
    if (repo) {
      // Для запиненного ref (тег/коммит) дерево заморожено, поэтому «latest» контент
      // считаем по дефолтной ветке (HEAD): иначе обновление папки без смены тега невидимо.
      const latestRef = isPinnedRef(ctx.repo.ref) ? 'HEAD' : (ctx.repo.ref ?? 'HEAD')
      return this.ports.github.getFolderTreeSha(
        repo.owner,
        repo.repo,
        latestRef,
        ctx.repo.skillPath
      )
    }
    // Прочий git: latest — content hash папки skill в актуальном клоне источника.
    if (ctx.repo.localDir) {
      return this.ports.files.computeFolderHash(
        skillFolderInClone(ctx.repo.localDir, ctx.repo.skillPath)
      )
    }
    return null
  }

  compare(installed: string | null, latest: string | null): boolean {
    return installed !== null && latest !== null && installed !== latest
  }
}
