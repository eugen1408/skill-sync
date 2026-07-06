<script lang="ts">
  import type { CatalogEntry } from '@shared/domain/skill'
  import type { CatalogStatusFilter, CatalogSort } from '@shared/ipc/contract'
  import { api } from '../lib/api'
  import { catalog } from '../lib/stores/catalog.svelte'
  import { sources } from '../lib/stores/sources.svelte'
  import { config } from '../lib/stores/config.svelte'
  import { ui } from '../lib/stores/ui.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'
  import { jobs } from '../lib/stores/jobs.svelte'
  import { updateStatusLabel, sourceTypeLabel, formatInstalls } from '../lib/labels'
  import { t } from '../lib/i18n.svelte'
  import { installWithAuditGuard } from '../lib/install'
  import { computeWindow } from '../lib/virtual'
  import Icon from './Icon.svelte'
  import FilterMenu from './FilterMenu.svelte'

  const STATUS_VALUES: CatalogStatusFilter[] = ['installed', 'not_installed', 'update_available']

  const sorts: Array<{ value: CatalogSort; labelKey: Parameters<typeof t>[0] }> = [
    { value: 'update-first', labelKey: 'sort.updateFirst' },
    { value: 'installs-desc', labelKey: 'sort.popular' },
    { value: 'name-asc', labelKey: 'sort.nameAsc' },
    { value: 'name-desc', labelKey: 'sort.nameDesc' }
  ]

  const statusOptions = $derived(
    STATUS_VALUES.map((v) => ({
      value: v,
      label: t(`statusFilter.${v}`),
      checked: catalog.statuses.includes(v)
    }))
  )
  const sourceOptions = $derived(
    sources.items.map((s) => ({
      value: s.id,
      label: s.name,
      checked: catalog.sourceIds?.includes(s.id) ?? false
    }))
  )

  let scrollTop = $state(0)
  let viewportH = $state(0)
  let viewportW = $state(0)

  // Узкий список: имя не помещается рядом с кнопкой — переходим на компактную раскладку
  // (кнопка действия уезжает под текст), строка выше.
  const compact = $derived(viewportW > 0 && viewportW < 460)
  const rowH = $derived(compact ? 132 : 96)

  const items = $derived(catalog.result.items)
  const win = $derived(computeWindow(scrollTop, viewportH, rowH, items.length))
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
    <div class="relative max-w-xs flex-1">
      <input
        class="input pr-8"
        placeholder={t('catalog.searchPlaceholder')}
        value={catalog.text}
        oninput={(e) => catalog.setText(e.currentTarget.value)}
      />
      {#if catalog.text}
        <button
          class="absolute inset-y-0 right-2 flex items-center opacity-50 hover:opacity-100"
          title={t('common.clear')}
          onclick={() => catalog.setText('')}
        >
          <Icon name="close" size={14} />
        </button>
      {/if}
    </div>
    <select
      class="select max-w-48 ps-3 pr-8"
      value={catalog.sort}
      onchange={(e) => catalog.setSort(e.currentTarget.value as CatalogSort)}
    >
      {#each sorts as s (s.value)}
        <option value={s.value}>{t(s.labelKey)}</option>
      {/each}
    </select>
    <FilterMenu
      label={t('catalog.filterStatus')}
      options={statusOptions}
      onToggle={(v) => catalog.toggleStatus(v as CatalogStatusFilter)}
    />
    <FilterMenu
      label={t('catalog.filterSources')}
      options={sourceOptions}
      onToggle={(v) => catalog.toggleSource(v)}
    />
    <button
      class="btn btn-sm preset-tonal ml-auto gap-1"
      onclick={() => void catalog.refresh()}
      disabled={catalog.loading}
      title={t('catalog.refreshTitle')}
    >
      <Icon name="refresh" class={catalog.loading ? 'animate-spin' : ''} />
      {t('catalog.refresh')}
    </button>
    <span class="text-sm opacity-60">{t('catalog.total', { count: catalog.result.total })}</span>
  </div>

  {#if initialLoading}
    <!-- Первичная загрузка: скелетоны вместо пустоты/«Неизвестно». -->
    <div class="flex flex-col gap-2">
      {#each Array(6) as _, idx (idx)}
        <div
          class="card preset-outlined-surface-200-800 flex items-center gap-4 px-4"
          style="height: {rowH - 8}px"
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
      {t('catalog.empty')}
    </div>
  {:else}
    <!-- Виртуализированный список: рендерим только видимое окно (follow-up [12]). -->
    <div
      class="min-h-0 flex-1 overflow-y-auto"
      bind:clientHeight={viewportH}
      bind:clientWidth={viewportW}
      onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
    >
      <div class="relative" style="height: {win.totalHeight}px">
        <div style="transform: translateY({win.padTop}px)">
          {#each visible as entry (entry.id)}
            <div style="height: {rowH}px" class="pb-2">
              <!-- Вся карточка кликабельна (верх и низ); интерактивные кнопки внутри
                   останавливают всплытие, чтобы не открывать деталь по нажатию действия. -->
              <div
                role="button"
                tabindex="0"
                class="card preset-outlined-surface-200-800 flex h-full cursor-pointer px-4 hover:preset-tonal {compact
                  ? 'flex-col justify-center gap-2'
                  : 'items-center gap-4'}"
                onclick={() => ui.openDetail(entry.id)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    ui.openDetail(entry.id)
                  }
                }}
              >
                <div class="overflow-hidden {compact ? 'w-full' : 'flex-1'}">
                  <span class="block truncate font-semibold">{entry.name}</span>
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
                </div>
                <!-- Статус и действие — в одном месте: кнопка (Обновить/Установить) заменяет
                     дублирующий бейдж; для состояний без действия показываем бейдж статуса. -->
                <div class="flex shrink-0 items-center gap-2 {compact ? 'w-full justify-end' : ''}">
                  {#if pending(entry)}
                    <span class="h-5 w-20 animate-pulse rounded-full bg-surface-300-700"></span>
                  {:else if entry.hasUpdate}
                    <button
                      class="btn btn-sm preset-filled-warning-500"
                      onclick={(e) => {
                        e.stopPropagation()
                        void toasts.guard(() => api.update.runOne(entry.id), t('error.updateStart'))
                      }}
                    >
                      {t('action.update')}
                    </button>
                  {:else if !entry.installed && entry.sourceId !== 'installed'}
                    <button
                      class="btn btn-sm preset-filled-primary-500"
                      onclick={(e) => {
                        e.stopPropagation()
                        install(entry)
                      }}
                    >
                      {t('action.install')}
                    </button>
                  {:else}
                    <span class="badge {badgeClass(entry)}"
                      >{updateStatusLabel(entry.updateStatus)}</span
                    >
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
