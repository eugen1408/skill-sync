export interface UpdateCheckEntry {
  skillId: string
  installedVersion: string | null
  latestVersion: string | null
  hasUpdate: boolean
  resolvedBy: string | null
}

export interface UpdateCheckResult {
  checkedAt: string
  updatesAvailable: number
  entries: UpdateCheckEntry[]
}

export interface UpdateRunSummary {
  ok: number
  failed: number
  skipped: number
}
