<script lang="ts">
  import type { CatalogEntry } from '@shared/domain/skill'
  import type { CatalogStatusFilter, CatalogSort } from '@shared/ipc/contract'
  import { api } from '../lib/api'
  import { catalog } from '../lib/stores/catalog.svelte'
  import { config } from '../lib/stores/config.svelte'
  import { ui } from '../lib/stores/ui.svelte'
  import { updateStatusLabel, sourceTypeLabel } from '../lib/labels'

  const statusFilters: Array<{ value: CatalogStatusFilter | null; label: string }> = [
    { value: null, label: 'Все' },
    { value: 'installed', label: 'Установлены' },
    { value: 'not_installed', label: 'Не установлены' },
    { value: 'update_available', label: 'Есть обновление' }
  ]

  const sorts: Array<{ value: CatalogSort; label: string }> = [
    { value: 'update-first', label: 'Сначала обновления' },
    { value: 'name-asc', label: 'Имя А–Я' },
    { value: 'name-desc', label: 'Имя Я–А' }
  ]

  function badgeClass(entry: CatalogEntry): string {
    if (entry.hasUpdate) return 'preset-filled-warning-500'
    if (entry.installed) return 'preset-filled-success-500'
    return 'preset-tonal'
  }

  async function install(entry: CatalogEntry): Promise<void> {
    const cfg = config.config
    if (!cfg) return
    await api.install.run({
      skillId: entry.id,
      sourceId: entry.sourceId,
      sourceRef: entry.sourceRef,
      targetAgents: cfg.install.targetAgents,
      scope: cfg.install.scope,
      force: false
    })
  }

  const totalPages = $derived(Math.ceil(catalog.result.total / catalog.pageSize) || 1)
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center gap-3">
    <input
      class="input max-w-xs"
      placeholder="Поиск skills…"
      value={catalog.text}
      oninput={(e) => catalog.setText(e.currentTarget.value)}
    />
    <select
      class="select max-w-48"
      value={catalog.sort}
      onchange={(e) => catalog.setSort(e.currentTarget.value as CatalogSort)}
    >
      {#each sorts as s (s.value)}
        <option value={s.value}>{s.label}</option>
      {/each}
    </select>
    <div class="flex gap-1">
      {#each statusFilters as f (f.label)}
        <button
          class="btn btn-sm {catalog.status === f.value
            ? 'preset-filled-primary-500'
            : 'preset-tonal'}"
          onclick={() => catalog.setStatus(f.value)}
        >
          {f.label}
        </button>
      {/each}
    </div>
    <span class="ml-auto text-sm opacity-60">Всего: {catalog.result.total}</span>
  </div>

  {#if catalog.loading}
    <p class="opacity-60">Загрузка…</p>
  {:else if catalog.result.items.length === 0}
    <div class="card preset-outlined-surface-200-800 p-8 text-center opacity-70">
      Ничего не найдено. Добавьте источник во вкладке «Источники».
    </div>
  {:else}
    <div class="space-y-2">
      {#each catalog.result.items as entry (entry.id)}
        <div class="card preset-outlined-surface-200-800 flex items-center gap-4 p-4">
          <button class="flex-1 text-left" onclick={() => ui.openDetail(entry.id)}>
            <div class="flex items-center gap-2">
              <span class="font-semibold">{entry.name}</span>
              <span class="badge {badgeClass(entry)}">{updateStatusLabel(entry.updateStatus)}</span>
            </div>
            {#if entry.description}
              <p class="line-clamp-1 text-sm opacity-70">{entry.description}</p>
            {/if}
            <p class="text-xs opacity-50">{sourceTypeLabel(entry.sourceType)}</p>
          </button>
          <div class="flex gap-2">
            {#if entry.hasUpdate}
              <button
                class="btn btn-sm preset-filled-warning-500"
                onclick={() => api.update.runOne(entry.id)}
              >
                Обновить
              </button>
            {:else if !entry.installed && entry.sourceId !== 'installed'}
              <button class="btn btn-sm preset-filled-primary-500" onclick={() => install(entry)}>
                Установить
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-3">
        <button
          class="btn btn-sm preset-tonal"
          disabled={catalog.page === 0}
          onclick={() => catalog.setPage(catalog.page - 1)}
        >
          Назад
        </button>
        <span class="text-sm">{catalog.page + 1} / {totalPages}</span>
        <button
          class="btn btn-sm preset-tonal"
          disabled={catalog.page + 1 >= totalPages}
          onclick={() => catalog.setPage(catalog.page + 1)}
        >
          Вперёд
        </button>
      </div>
    {/if}
  {/if}
</div>
