<script lang="ts">
  import { jobs } from '../lib/stores/jobs.svelte'
  import Icon from './Icon.svelte'

  const kindLabels: Record<string, string> = {
    'source.index': 'Индексация',
    'source.refresh': 'Обновление источника',
    install: 'Установка',
    'install.uninstall': 'Удаление',
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

  const MIN_H = 80
  const MAX_H = 500
  let barHeight = $state(180)
  let expanded = $state<Set<string>>(new Set())

  const hasFinished = $derived(jobs.visible.some((j) => j.status !== 'running'))

  function toggle(jobId: string): void {
    const next = new Set(expanded)
    if (next.has(jobId)) next.delete(jobId)
    else next.add(jobId)
    expanded = next
  }

  // Перетаскивание верхней кромки меняет высоту бара (вверх — выше).
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
  <div class="flex flex-col border-t border-surface-200-800" style="height: {barHeight}px">
    <!-- Ручка изменения высоты. -->
    <div
      class="h-1.5 shrink-0 cursor-ns-resize bg-surface-200-800/40 hover:bg-primary-500/50"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Изменить высоту панели событий"
      onpointerdown={startResize}
    ></div>

    <div class="flex items-center gap-2 px-3 py-1 text-xs">
      <span class="font-semibold opacity-70">События</span>
      <span class="opacity-40">{jobs.visible.length}</span>
      {#if hasFinished}
        <button
          class="btn btn-sm preset-tonal ml-auto gap-1"
          title="Очистить завершённые"
          onclick={() => jobs.clearFinished()}
        >
          <Icon name="trash" size={14} />
          Очистить все
        </button>
      {/if}
    </div>

    <div class="min-h-0 flex-1 overflow-auto p-2">
      {#each jobs.visible as job (job.jobId)}
        <div class="px-2 py-1 text-sm">
          <div class="flex items-center gap-3">
            {#if job.logs.length > 0}
              <button
                class="opacity-60 hover:opacity-100"
                title="Логи"
                onclick={() => toggle(job.jobId)}
              >
                <Icon
                  name="chevron"
                  size={14}
                  class={expanded.has(job.jobId) ? '' : '-rotate-90'}
                />
              </button>
            {:else}
              <span class="w-3.5"></span>
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
              <button
                class="btn-icon btn-icon-sm preset-tonal"
                title="Убрать"
                onclick={() => jobs.dismiss(job.jobId)}
              >
                <Icon name="trash" size={14} />
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
  </div>
{/if}
