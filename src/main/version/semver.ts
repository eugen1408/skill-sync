/** Минимальный разбор и сравнение semver-подобных версий (с опциональным префиксом v). */
export interface SemVer {
  major: number
  minor: number
  patch: number
  /** Идентификаторы pre-release (после `-`), напр. ['rc', '1']. Пусто — стабильный релиз. */
  prerelease: string[]
}

// major.minor[.patch][-prerelease][+build]. build-метаданные не влияют на очерёдность.
const SEMVER_RE = /^\s*v?(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?/i

export function parseSemver(input: string | null | undefined): SemVer | null {
  if (!input) return null
  const m = SEMVER_RE.exec(input)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: m[3] ? Number(m[3]) : 0,
    prerelease: m[4] ? m[4].split('.') : []
  }
}

const NUMERIC = /^\d+$/

/** Сравнение pre-release по правилам semver §11: набор без pre-release старше набора с ним. */
function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1 // стабильный релиз > pre-release
  if (b.length === 0) return -1
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai === bi) continue
    const an = NUMERIC.test(ai)
    const bn = NUMERIC.test(bi)
    if (an && bn) return Number(ai) < Number(bi) ? -1 : 1
    if (an) return -1 // числовой идентификатор младше алфавитно-цифрового
    if (bn) return 1
    return ai < bi ? -1 : 1
  }
  // Все совпавшие поля равны — у кого больше идентификаторов, тот старше.
  if (a.length === b.length) return 0
  return a.length < b.length ? -1 : 1
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
  return comparePrerelease(pa.prerelease, pb.prerelease)
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
