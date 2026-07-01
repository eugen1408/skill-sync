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
</script>

{#if jobs.active.length > 0}
  <div class="border-t border-surface-200-800 p-2">
    {#each jobs.active as job (job.jobId)}
      <div class="flex items-center gap-3 px-2 py-1 text-sm">
        <span class="font-medium">{kindLabels[job.kind] ?? job.kind}</span>
        <span class="flex-1 truncate opacity-70">{job.message ?? ''}</span>
        {#if job.percent !== null}
          <span class="opacity-60">{job.percent}%</span>
        {/if}
        <button class="btn btn-sm preset-tonal" onclick={() => jobs.cancel(job.jobId)}>
          Отмена
        </button>
      </div>
    {/each}
  </div>
{/if}
