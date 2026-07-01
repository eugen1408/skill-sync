<script lang="ts">
  import { sources } from '../lib/stores/sources.svelte'
  import { sourceTypeLabel, sourceStatusLabel } from '../lib/labels'
  import AddSourceForm from './AddSourceForm.svelte'

  function statusBadge(status: string): string {
    if (status === 'ok') return 'preset-filled-success-500'
    if (status === 'error') return 'preset-filled-error-500'
    if (status === 'indexing') return 'preset-filled-primary-500'
    return 'preset-tonal'
  }
</script>

<div class="grid grid-cols-[1fr_20rem] gap-6">
  <div class="space-y-2">
    {#if sources.items.length === 0}
      <div class="card preset-outlined-surface-200-800 p-8 text-center opacity-70">
        Источники не подключены. Добавьте первый источник справа.
      </div>
    {:else}
      {#each sources.items as source (source.id)}
        <div class="card preset-outlined-surface-200-800 flex items-center gap-3 p-4">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-semibold">{source.name}</span>
              <span class="badge preset-tonal">{sourceTypeLabel(source.type)}</span>
              <span class="badge {statusBadge(source.status)}">
                {sourceStatusLabel(source.status)}
              </span>
            </div>
            {#if source.config.url}
              <p class="text-xs opacity-60">{source.config.url}</p>
            {/if}
            {#if source.config.localPath}
              <p class="text-xs opacity-60">{source.config.localPath}</p>
            {/if}
            {#if source.lastError}
              <p class="text-xs text-error-500">{source.lastError}</p>
            {/if}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm preset-tonal" onclick={() => sources.refresh(source.id)}>
              Обновить
            </button>
            <button
              class="btn btn-sm preset-tonal"
              onclick={() => sources.setEnabled(source.id, !source.enabled)}
            >
              {source.enabled ? 'Отключить' : 'Включить'}
            </button>
            <button class="btn btn-sm preset-tonal" onclick={() => sources.remove(source.id)}>
              Удалить
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <AddSourceForm />
</div>
