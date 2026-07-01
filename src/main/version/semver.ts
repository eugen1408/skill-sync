/** Минимальный разбор и сравнение semver-подобных версий (с опциональным префиксом v). */
export interface SemVer {
  major: number
  minor: number
  patch: number
}

const SEMVER_RE = /^\s*v?(\d+)\.(\d+)(?:\.(\d+))?/i

export function parseSemver(input: string | null | undefined): SemVer | null {
  if (!input) return null
  const m = SEMVER_RE.exec(input)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: m[3] ? Number(m[3]) : 0
  }
}

/** -1 | 0 | 1 (a<b | a==b | a>b). null-версии считаются меньше любой валидной. */
export function compareSemver(a: string | null, b: string | null): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1
  return 0
}

/** Возвращает максимальную по semver строку из списка (исходную форму), либо null. */
export function maxSemver(versions: string[]): string | null {
  let best: string | null = null
  for (const v of versions) {
    if (!parseSemver(v)) continue
    if (best === null || compareSemver(v, best) > 0) best = v
  }
  return best
}
