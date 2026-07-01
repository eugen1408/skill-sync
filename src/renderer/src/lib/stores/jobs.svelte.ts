import type { JobKind } from '@shared/domain/job'
import { api } from '../api'

export interface TrackedJob {
  jobId: string
  kind: JobKind
  percent: number | null
  message: string | null
  status: 'running' | 'done' | 'error' | 'cancelled'
  error: string | null
  logs: string[]
}

class JobsStore {
  jobs = $state<TrackedJob[]>([])
  private unsubs: Array<() => void> = []
  private initialized = false

  get active(): TrackedJob[] {
    return this.jobs.filter((j) => j.status === 'running')
  }

  init(): void {
    if (this.initialized) return
    this.initialized = true
    this.unsubs.push(
      api.events.onJobProgress((e) => {
        const job = this.ensure(e.jobId, e.kind)
        job.percent = e.percent
        job.message = e.message
      }),
      api.events.onJobLog((e) => {
        const job = this.jobs.find((j) => j.jobId === e.jobId)
        if (job) job.logs.push(...e.lines)
      }),
      api.events.onJobDone((e) => {
        const job = this.jobs.find((j) => j.jobId === e.jobId)
        if (job) job.status = e.status
      }),
      api.events.onJobError((e) => {
        const job = this.ensure(e.jobId, e.kind)
        job.status = 'error'
        job.error = e.error.message
      })
    )
  }

  destroy(): void {
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.initialized = false
  }

  cancel(jobId: string): void {
    void api.jobs.cancel(jobId)
  }

  dismiss(jobId: string): void {
    this.jobs = this.jobs.filter((j) => j.jobId !== jobId)
  }

  private ensure(jobId: string, kind: JobKind): TrackedJob {
    let job = this.jobs.find((j) => j.jobId === jobId)
    if (!job) {
      job = { jobId, kind, percent: null, message: null, status: 'running', error: null, logs: [] }
      this.jobs = [...this.jobs, job]
    }
    return job
  }
}

export const jobs = new JobsStore()
