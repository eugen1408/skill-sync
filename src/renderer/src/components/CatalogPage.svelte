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
  import { getSourceDomain } from '@shared/domain/source'
  import { fade } from 'svelte/transition'
  import { Switch } from '@skeletonlabs/skeleton-svelte'
  import Devicon from './Devicon.svelte'
  import Icon from './Icon.svelte'
  import Favicon from './Favicon.svelte'
  import FilterMenu from './FilterMenu.svelte'

  const STATUS_VALUES: CatalogStatusFilter[] = ['installed', 'not_installed', 'update_available']

  const statusOptions = $derived(
    STATUS_VALUES.map((v) => ({
      value: v,
      label: t(`statusFilter.${v}`),
      checked: catalog.statuses.includes(v)
    }))
  )
  const sourceOptions = $derived(
    sources.items
      .filter((s) => s.enabled)
      .map((s) => ({
        value: s.id,
        label: `${getSourceDomain(s)} / ${s.name}`,
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

  const groupedCatalog = $derived.by(() => {
    const map = new Map<string, CatalogEntry[]>()
    for (const item of items) {
      let domain = 'other'
      if (item.sourceId === 'official') {
        domain = 'skills.sh'
      } else if (item.sourceId === 'installed') {
        domain = 'local'
      } else {
        const source = sources.items.find((s) => s.id === item.sourceId)
        if (source) domain = getSourceDomain(source)
      }
      if (!map.has(domain)) map.set(domain, [])
      map.get(domain)!.push(item)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  })

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

<div class="flex h-full flex-col">
  <div class="relative z-10 flex flex-wrap items-center gap-3 p-6 pb-4 shrink-0">
    <div class="relative max-w-xs min-w-64 flex-1">
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
    <div class="flex items-center gap-2 text-sm ml-2">
      <div 
        role="button"
        tabindex="0"
        class="relative inline-block cursor-pointer flex items-center hover:opacity-80" 
        onclick={() => catalog.setGroupBySource(!catalog.groupBySource)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            catalog.setGroupBySource(!catalog.groupBySource)
          }
        }}
      >
        <div class="pointer-events-none">
          <Switch
            name="groupBySource"
            checked={catalog.groupBySource}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
      </div>
      <button 
        type="button"
        class="hidden sm:inline cursor-pointer hover:opacity-80"
        onclick={() => catalog.setGroupBySource(!catalog.groupBySource)}
      >
        {t('catalog.groupBySource')}
      </button>
    </div>
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
    <div class="flex flex-col gap-2 px-6 pb-6">
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
    <div class="card preset-outlined-surface-200-800 p-8 text-center opacity-70 mx-6 mb-6">
      {t('catalog.empty')}
    </div>
  {:else}
    <div
      class="min-h-0 flex-1 overflow-y-auto px-6 pb-6"
      bind:clientHeight={viewportH}
      bind:clientWidth={viewportW}
      onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
    >
      {#if catalog.groupBySource}
        {#each groupedCatalog as [domain, groupEntries] (domain)}
          <div class="card preset-outlined-surface-200-800 p-0 overflow-hidden mb-4">
            <details class="group" open>
              <summary
                class="flex items-center justify-between p-4 cursor-pointer hover:preset-tonal-surface"
              >
                <div class="flex items-center gap-3">
                  <Favicon {domain} class="w-5 h-5 rounded-sm" />
                  <span class="font-bold text-lg">{domain}</span>
                </div>
                <Icon name="chevron" class="transition-transform group-open:rotate-180 ml-4" size={20} />
              </summary>
              <div class="border-t border-surface-200-800 flex flex-col">
                {#each groupEntries as entry (entry.id)}
                  {@render skillCard(entry)}
                {/each}
              </div>
            </details>
          </div>
        {/each}
      {:else}
        <!-- Виртуализированный список: рендерим только видимое окно (follow-up [12]). -->
        <div class="relative" style="height: {win.totalHeight}px">
          <div style="transform: translateY({win.padTop}px)">
            {#each visible as entry (entry.id)}
              <div style="height: {rowH}px" class="pb-2">
                {@render skillCard(entry)}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#snippet skillCard(entry: CatalogEntry)}
  <!-- Вся карточка кликабельна (верх и низ); интерактивные кнопки внутри
       останавливают всплытие, чтобы не открывать деталь по нажатию действия. -->
  <div
    role="button"
    tabindex="0"
    in:fade={{ duration: 250 }}
    class="flex cursor-pointer px-4 hover:preset-tonal {catalog.groupBySource ? 'border-b border-surface-200-800 last:border-0 py-4' : 'card preset-outlined-surface-200-800 h-full'} {compact
      ? 'flex-col justify-center gap-2'
      : 'items-center gap-4'}"
    style={catalog.groupBySource ? '' : `height: ${rowH}px`}
    onclick={() => ui.openDetail(entry.id)}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        ui.openDetail(entry.id)
      }
    }}
  >
    <div class="flex items-center gap-3 overflow-hidden {compact ? 'w-full' : 'flex-1'}">
      <!-- Devicon placeholder / rendering -->
      <div class="flex items-center justify-center w-8 shrink-0">
        <Devicon skillId={entry.id} description={entry.description} class="text-2xl leading-none" />
      </div>
      
      <div class="overflow-hidden flex-1">
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
        <div class="flex items-center gap-2">
          <button
            class="btn btn-sm preset-filled-primary-500"
            onclick={(e) => {
              e.stopPropagation()
              install(entry)
            }}
          >
            {t('action.install')}
          </button>
          <button
            class="btn-icon btn-sm preset-tonal"
            title={t('action.hide')}
            onclick={(e) => {
              e.stopPropagation()
              void toasts.guard(() => window.api.source.hideSkill(entry.sourceId, entry.name), t('common.error'))
            }}
          >
            <Icon name="eye-off" size={16} />
          </button>
        </div>
      {:else}
        <span class="badge {badgeClass(entry)}">{updateStatusLabel(entry.updateStatus)}</span>
      {/if}
    </div>
  </div>
{/snippet}
