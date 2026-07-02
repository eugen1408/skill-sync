<script lang="ts">
  import type { CatalogEntry } from '@shared/domain/skill'
  import type { CatalogStatusFilter, CatalogSort } from '@shared/ipc/contract'
  import { api } from '../lib/api'
  import { catalog } from '../lib/stores/catalog.svelte'
  import { config } from '../lib/stores/config.svelte'
  import { ui } from '../lib/stores/ui.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'
  import { jobs } from '../lib/stores/jobs.svelte'
  import { updateStatusLabel, sourceTypeLabel, formatInstalls } from '../lib/labels'
  import { installWithAuditGuard } from '../lib/install'
  import { computeWindow } from '../lib/virtual'
  import Icon from './Icon.svelte'

  const statusFilters: Array<{ value: CatalogStatusFilter | null; label: string }> = [
    { value: null, label: 'Все' },
    { value: 'installed', label: 'Установлены' },
    { value: 'not_installed', label: 'Не установлены' },
    { value: 'update_available', label: 'Есть обновление' }
  ]

  const sorts: Array<{ value: CatalogSort; label: string }> = [
    { value: 'update-first', label: 'Сначала обновления' },
    { value: 'installs-desc', label: 'Популярные (skills.sh)' },
    { value: 'name-asc', label: 'Имя А–Я' },
    { value: 'name-desc', label: 'Имя Я–А' }
  ]

  // Фиксированная высота строки (px) для виртуализации; должна вмещать карточку + отступ.
  const ROW_H = 96

  let scrollTop = $state(0)
  let viewportH = $state(0)

  const items = $derived(catalog.result.items)
  const win = $derived(computeWindow(scrollTop, viewportH, ROW_H, items.length))
  const visible = $derived(items.slice(win.start, win.end))

  // Идёт проверка/обновление версий — статусы «Неизвестно» показываем скелетоном, не текстом.
  const checking = $derived(
    jobs.active.some((j) => j.kind === 'update.check' || j.kind === 'update.run')
  )
  const pending = (entry: CatalogEntry): boolean => checking && entry.updateStatus === 'unknown'
  // Первичная загрузка (список ещё пуст) — скелетоны; при перезагрузке список не гасим (без мерцания).
  const initialLoading = $derived(catalog.loading && items.length === 0)

  function badgeClass(entry: CatalogEntry): string {
    if (entry.hasUpdate) return 'preset-filled-warning-500'
    if (entry.installed) return 'preset-filled-success-500'
    return 'preset-tonal'
  }

  function install(entry: CatalogEntry): void {
    const cfg = config.config
    if (!cfg) return
    void installWithAuditGuard(entry, cfg)
  }
</script>

<div class="flex h-full flex-col gap-4">
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
    <button
      class="btn btn-sm preset-tonal ml-auto gap-1"
      onclick={() => void catalog.refresh()}
      disabled={catalog.loading}
      title="Переинициализировать список (как при запуске)"
    >
      <Icon name="refresh" class={catalog.loading ? 'animate-spin' : ''} />
      Обновить
    </button>
    <span class="text-sm opacity-60">Всего: {catalog.result.total}</span>
  </div>

  {#if initialLoading}
    <!-- Первичная загрузка: скелетоны вместо пустоты/«Неизвестно». -->
    <div class="flex flex-col gap-2">
      {#each Array(6) as _, idx (idx)}
        <div
          class="card preset-outlined-surface-200-800 flex items-center gap-4 px-4"
          style="height: {ROW_H - 8}px"
        >
          <div class="flex-1 space-y-2">
            <div class="h-4 w-40 animate-pulse rounded bg-surface-300-700"></div>
            <div class="h-3 w-64 animate-pulse rounded bg-surface-300-700"></div>
          </div>
          <div class="h-5 w-20 animate-pulse rounded-full bg-surface-300-700"></div>
        </div>
      {/each}
    </div>
  {:else if items.length === 0}
    <div class="card preset-outlined-surface-200-800 p-8 text-center opacity-70">
      Ничего не найдено. Добавьте источник во вкладке «Источники» или воспользуйтесь поиском.
    </div>
  {:else}
    <!-- Виртуализированный список: рендерим только видимое окно (follow-up [12]). -->
    <div
      class="min-h-0 flex-1 overflow-y-auto"
      bind:clientHeight={viewportH}
      onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
    >
      <div class="relative" style="height: {win.totalHeight}px">
        <div style="transform: translateY({win.padTop}px)">
          {#each visible as entry (entry.id)}
            <div style="height: {ROW_H}px" class="pb-2">
              <div class="card preset-outlined-surface-200-800 flex h-full items-center gap-4 px-4">
                <button
                  class="flex-1 overflow-hidden text-left"
                  onclick={() => ui.openDetail(entry.id)}
                >
                  <div class="flex items-center gap-2">
                    <span class="truncate font-semibold">{entry.name}</span>
                    {#if pending(entry)}
                      <span class="h-5 w-16 animate-pulse rounded-full bg-surface-300-700"></span>
                    {:else}
                      <span class="badge {badgeClass(entry)}"
                        >{updateStatusLabel(entry.updateStatus)}</span
                      >
                    {/if}
                  </div>
                  {#if entry.description}
                    <p class="line-clamp-1 text-sm opacity-70">{entry.description}</p>
                  {/if}
                  <p class="flex items-center gap-1 text-xs opacity-50">
                    {sourceTypeLabel(entry.sourceType)}
                    {#if entry.installs != null}
                      <span aria-hidden="true">·</span>
                      <Icon name="download" size={12} />
                      {formatInstalls(entry.installs)}
                    {/if}
                  </p>
                </button>
                <div class="flex gap-2">
                  {#if entry.hasUpdate}
                    <button
                      class="btn btn-sm preset-filled-warning-500"
                      onclick={() =>
                        toasts.guard(
                          () => api.update.runOne(entry.id),
                          'Не удалось запустить обновление'
                        )}
                    >
                      Обновить
                    </button>
                  {:else if !entry.installed && entry.sourceId !== 'installed'}
                    <button
                      class="btn btn-sm preset-filled-primary-500"
                      onclick={() => install(entry)}
                    >
                      Установить
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
