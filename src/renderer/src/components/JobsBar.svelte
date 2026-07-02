<script lang="ts">
  import { jobs } from '../lib/stores/jobs.svelte'

  const kindLabels: Record<string, string> = {
    'source.index': 'Индексация',
    'source.refresh': 'Обновление источника',
    install: 'Установка',
    'install.reconcileAgents': 'Реконсиляция агентов',
    'update.check': 'Проверка обновлений',
    'update.run': 'Обновление'
  }

  const statusLabels: Record<string, string> = {
    running: '',
    done: 'Готово',
    error: 'Ошибка',
    cancelled: 'Отменено'
  }

  let expanded = $state<Set<string>>(new Set())

  function toggle(jobId: string): void {
    const next = new Set(expanded)
    if (next.has(jobId)) next.delete(jobId)
    else next.add(jobId)
    expanded = next
  }
</script>

{#if jobs.visible.length > 0}
  <div class="max-h-64 overflow-auto border-t border-surface-200-800 p-2">
    {#each jobs.visible as job (job.jobId)}
      <div class="px-2 py-1 text-sm">
        <div class="flex items-center gap-3">
          {#if job.logs.length > 0}
            <button class="opacity-60 hover:opacity-100" onclick={() => toggle(job.jobId)}>
              {expanded.has(job.jobId) ? '▾' : '▸'}
            </button>
          {:else}
            <span class="w-3"></span>
          {/if}
          <span class="font-medium">{kindLabels[job.kind] ?? job.kind}</span>
          <span class="flex-1 truncate opacity-70">
            {job.status === 'error' ? (job.error ?? 'Ошибка') : (job.message ?? '')}
          </span>
          {#if job.status === 'running'}
            {#if job.percent !== null}
              <span class="opacity-60">{job.percent}%</span>
            {/if}
            <button class="btn btn-sm preset-tonal" onclick={() => jobs.cancel(job.jobId)}>
              Отмена
            </button>
          {:else}
            <span
              class="badge {job.status === 'error' ? 'preset-filled-error-500' : 'preset-tonal'}"
            >
              {statusLabels[job.status]}
            </span>
            <button class="btn btn-sm preset-tonal" onclick={() => jobs.dismiss(job.jobId)}>
              ✕
            </button>
          {/if}
        </div>
        {#if expanded.has(job.jobId) && job.logs.length > 0}
          <pre
            class="mt-1 ml-6 max-h-40 overflow-auto rounded bg-surface-100-900 p-2 text-xs opacity-80">{job.logs.join(
              '\n'
            )}</pre>
        {/if}
      </div>
    {/each}
  </div>
{/if}
