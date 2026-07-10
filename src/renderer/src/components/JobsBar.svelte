<script lang="ts">
  import { jobs } from '../lib/stores/jobs.svelte'
  import { t } from '../lib/i18n.svelte'
  import type { MessageKey } from '@shared/i18n/messages'
  import Icon from './Icon.svelte'

  const kindLabel = (kind: string): string => t(`jobs.kind.${kind}` as MessageKey)
  const statusLabel = (status: string): string => t(`jobs.status.${status}` as MessageKey)

  const MIN_H = 80
  const MAX_H = 500
  let barHeight = $state(180)
  // Аккордеон панели: свёрнута/развёрнута (снизу вверх). По умолчанию свёрнута.
  let open = $state(false)
  // Раскрытые логи по отдельным задачам (независимо от состояния панели).
  let expandedLogs = $state<Set<string>>(new Set())

  // Новые события сверху, старые снизу.
  const ordered = $derived([...jobs.visible].reverse())
  const latest = $derived(ordered[0] ?? null)
  const hasError = $derived(jobs.visible.some((j) => j.status === 'error'))
  const hasFinished = $derived(jobs.visible.some((j) => j.status !== 'running'))

  function summary(job: (typeof ordered)[number]): string {
    if (job.status === 'error') return job.error ?? t('common.error')
    return job.message ?? statusLabel(job.status)
  }

  function toggleLogs(jobId: string): void {
    const next = new Set(expandedLogs)
    if (next.has(jobId)) next.delete(jobId)
    else next.add(jobId)
    expandedLogs = next
  }

  // Перетаскивание верхней кромки меняет высоту панели (доступно только в развёрнутом виде).
  function startResize(e: PointerEvent): void {
    e.preventDefault()
    const startY = e.clientY
    const startH = barHeight
    const onMove = (ev: PointerEvent): void => {
      barHeight = Math.min(MAX_H, Math.max(MIN_H, startH - (ev.clientY - startY)))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
</script>

{#if jobs.visible.length > 0}
  <div
    class="flex flex-col border-t border-surface-200-800"
    style={open ? `height: ${barHeight}px` : ''}
  >
    {#if open}
      <!-- Ручка изменения высоты (только в развёрнутом состоянии). -->
      <div
        class="h-1.5 shrink-0 cursor-ns-resize bg-surface-200-800/40 hover:bg-primary-500/50"
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('jobs.resizeLabel')}
        onpointerdown={startResize}
      ></div>

      <!-- Список событий: новые сверху. -->
      <div class="min-h-0 flex-1 overflow-auto p-2">
        {#each ordered as job (job.jobId)}
          <div class="px-2 py-1 text-sm">
            <div class="flex items-center gap-3">
              {#if job.logs.length > 0 || job.errorDetails}
                <button
                  class="opacity-60 hover:opacity-100"
                  title={t('jobs.logs')}
                  onclick={() => toggleLogs(job.jobId)}
                >
                  <Icon
                    name="chevron"
                    size={14}
                    class={expandedLogs.has(job.jobId) ? '' : '-rotate-90'}
                  />
                </button>
              {:else}
                <span class="w-3.5"></span>
              {/if}
              <span class="font-medium">{kindLabel(job.kind)}</span>
              <span class="flex-1 truncate opacity-70">
                {job.status === 'error' ? (job.error ?? t('common.error')) : (job.message ?? '')}
              </span>
              {#if job.status === 'running'}
                {#if job.percent !== null}
                  <span class="opacity-60">{job.percent}%</span>
                {/if}
                <button class="btn btn-sm preset-tonal" onclick={() => jobs.cancel(job.jobId)}>
                  {t('jobs.cancel')}
                </button>
              {:else}
                <span
                  class="badge {job.status === 'error' ? 'preset-filled-error-500' : 'preset-tonal'}"
                >
                  {statusLabel(job.status)}
                </span>
                <button
                  class="btn-icon btn-icon-sm preset-tonal"
                  title={t('jobs.dismiss')}
                  onclick={() => jobs.dismiss(job.jobId)}
                >
                  <Icon name="trash" size={14} />
                </button>
              {/if}
            </div>
            {#if expandedLogs.has(job.jobId)}
              {#if job.errorDetails}
                {@const d = job.errorDetails}
                <dl
                  class="mt-1 ml-6 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded bg-surface-100-900 p-2 text-xs"
                >
                  {#if d.skillName}
                    <dt class="opacity-60">{t('jobs.diag.skill')}</dt>
                    <dd class="font-mono break-all">{d.skillName}</dd>
                  {/if}
                  {#if d.sourceId}
                    <dt class="opacity-60">{t('jobs.diag.source')}</dt>
                    <dd class="font-mono break-all">
                      {d.sourceId}{d.sourceRef ? ` · ${d.sourceRef}` : ''}
                    </dd>
                  {/if}
                  {#if d.command}
                    <dt class="opacity-60">{t('jobs.diag.command')}</dt>
                    <dd class="font-mono break-all">{d.command} {(d.args ?? []).join(' ')}</dd>
                  {/if}
                  {#if d.exitCode !== undefined && d.exitCode !== null}
                    <dt class="opacity-60">{t('jobs.diag.exitCode')}</dt>
                    <dd class="font-mono">{d.exitCode}</dd>
                  {/if}
                  {#if d.expectedPath}
                    <dt class="opacity-60">{t('jobs.diag.expectedPath')}</dt>
                    <dd class="font-mono break-all">{d.expectedPath}</dd>
                  {/if}
                  {#if d.stderr}
                    <dt class="col-span-2 opacity-60">{t('jobs.diag.stderr')}</dt>
                    <dd class="col-span-2">
                      <pre
                        class="max-h-32 overflow-auto rounded bg-surface-200-800/50 p-1.5 whitespace-pre-wrap">{d.stderr}</pre>
                    </dd>
                  {/if}
                  {#if d.suggestion}
                    <dt class="opacity-60">{t('jobs.diag.suggestion')}</dt>
                    <dd>{d.suggestion}</dd>
                  {/if}
                </dl>
              {/if}
              {#if job.logs.length > 0}
                <pre
                  class="mt-1 ml-6 max-h-40 overflow-auto rounded bg-surface-100-900 p-2 text-xs opacity-80">{job.logs.join(
                    '\n'
                  )}</pre>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Тулбар-аккордеон (всегда виден, закреплён снизу): клик сворачивает/разворачивает. -->
    <div class="flex items-center gap-2 border-t border-surface-200-800/60 px-3 py-1 text-xs">
      <button
        class="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-100"
        title={open ? t('jobs.collapse') : t('jobs.expand')}
        aria-expanded={open}
        onclick={() => (open = !open)}
      >
        <Icon name="chevron" size={14} class={open ? '' : 'rotate-180'} />
        <span class="font-semibold opacity-70">{t('jobs.events')}</span>
        <span class="opacity-40">{jobs.visible.length}</span>
        {#if !open && latest}
          <span class="ml-1 truncate opacity-60">
            {kindLabel(latest.kind)} · {summary(latest)}
          </span>
        {/if}
      </button>

      {#if !open && hasError}
        <span
          class="inline-flex items-center gap-1 text-error-500"
          title={t('jobs.hasErrors')}
          aria-label={t('jobs.hasErrors')}
        >
          <span class="h-2 w-2 rounded-full bg-error-500"></span>
        </span>
      {/if}

      {#if open && hasFinished}
        <button
          class="btn btn-sm preset-tonal gap-1"
          title={t('jobs.clearFinished')}
          onclick={(e) => {
            e.stopPropagation()
            jobs.clearFinished()
          }}
        >
          <Icon name="trash" size={14} />
          {t('jobs.clearAll')}
        </button>
      {/if}
    </div>
  </div>
{/if}
