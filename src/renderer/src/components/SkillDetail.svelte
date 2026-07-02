<script lang="ts">
  import type { CatalogEntry, AgentInstallation } from '@shared/domain/skill'
  import type { SecurityAudit } from '@shared/domain/audit'
  import { hasAuditData } from '@shared/domain/audit'
  import { api } from '../lib/api'
  import { config } from '../lib/stores/config.svelte'
  import { ui } from '../lib/stores/ui.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'
  import {
    updateStatusLabel,
    sourceTypeLabel,
    riskLabel,
    riskBadgeClass,
    auditProviderLabel,
    formatInstalls,
    truncateMiddle,
    formatDateTime,
    formatDate
  } from '../lib/labels'
  import { installWithAuditGuard, uninstallWithConfirm } from '../lib/install'
  import Icon from './Icon.svelte'

  let entry = $state<CatalogEntry | null>(null)
  let audit = $state<SecurityAudit | null>(null)
  let officialUrl = $state<string | null>(null)
  let readmeHtml = $state<string | null>(null)
  // Загрузка описания с skills.sh (аудит) завершена (успех или ошибка) — до этого
  // README-превью не показываем, чтобы не мигать им перед описанием со skills.sh.
  let auditLoaded = $state(false)
  let readmeOpen = $state(false)
  // Описание по умолчанию обрезано (приоритет метаданным/кнопкам); разворачивается кнопкой.
  let descExpanded = $state(false)
  let descEl = $state<HTMLParagraphElement | null>(null)
  let descOverflow = $state(false)
  // Раскрытые карточки провайдеров аудита (детали доступны при наличии summary).
  let openProviders = $state<Set<string>>(new Set())

  // Подстраница провайдера на skills.sh с полными результатами: {skillUrl}/security/{slug}.
  function providerUrl(slug: string): string | null {
    return officialUrl && slug ? `${officialUrl}/security/${encodeURIComponent(slug)}` : null
  }

  function toggleProvider(name: string): void {
    const next = new Set(openProviders)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    openProviders = next
  }

  $effect(() => {
    const id = ui.detailId
    if (!id) {
      entry = null
      audit = null
      officialUrl = null
      readmeHtml = null
      return
    }
    openProviders = new Set()
    audit = null
    officialUrl = null
    readmeHtml = null
    auditLoaded = false
    readmeOpen = false
    descExpanded = false
    descOverflow = false
    // Каждый вызов обёрнут: даже если какой-то IPC-метод недоступен/бросит, эффект не
    // прервётся синхронно и переключение между карточками продолжит работать (стале-гард
    // применяет ответ, только если выбранный skill не сменился за время запроса).
    refetchEntry(id)
    void run(() => api.catalog.audit(id)).then((a) => {
      if (ui.detailId !== id) return
      if (a !== undefined) audit = a
      auditLoaded = true
    })
    void run(() => api.catalog.officialUrl(id)).then((u) => {
      if (u !== undefined && ui.detailId === id) officialUrl = u
    })
    void run(() => api.catalog.readme(id)).then((h) => {
      if (h !== undefined && ui.detailId === id) readmeHtml = h
    })
  })

  // Освежаем запись при обновлении каталога (после установки/обновления/удаления skill),
  // не трогая аудит/README и состояние сворачивания — чтобы статус/версия в карточке не залипали.
  $effect(() => {
    const off = api.events?.onCatalogUpdated?.(() => {
      const id = ui.detailId
      if (id) refetchEntry(id)
    })
    return off ?? undefined
  })

  function refetchEntry(id: string): void {
    void run(() => api.catalog.get(id)).then((e) => {
      if (e !== undefined && ui.detailId === id) entry = e
    })
  }

  /** Безопасно вызывает IPC: синхронный бросок/отказ → undefined (не валит $effect). */
  function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    return Promise.resolve()
      .then(fn)
      .catch(() => undefined)
  }

  // Описание: собственное описание записи либо (для official) сводка Agent Trust Hub с skills.sh.
  const description = $derived(entry?.description ?? audit?.description ?? null)
  const descriptionFromOfficial = $derived(!entry?.description && !!audit?.description)

  // Определяем, обрезается ли описание (для показа кнопки «Показать полностью»).
  $effect(() => {
    void description // переизмеряем при смене текста
    if (descEl && !descExpanded) descOverflow = descEl.scrollHeight > descEl.clientHeight + 1
  })

  // Основная установка (.agents/skills) — первой; путь нормализуем для разных ОС.
  function isPrimary(inst: AgentInstallation): boolean {
    return /[\\/]\.agents[\\/]skills[\\/]/.test(inst.installPath)
  }
  const installations = $derived(
    [...(entry?.installations ?? [])].sort((a, b) => Number(isPrimary(b)) - Number(isPrimary(a)))
  )
  // Основная (каноническая) установка ~/.agents/skills — отдельной первой строкой;
  // остальные — по агентам.
  const primaryInstall = $derived(installations.find(isPrimary) ?? null)
  const otherInstalls = $derived(installations.filter((i) => !isPrimary(i)))

  function install(): void {
    const cfg = config.config
    if (!cfg || !entry) return
    void installWithAuditGuard(entry, cfg)
  }

  function reinstall(): void {
    const cfg = config.config
    if (!cfg || !entry) return
    void installWithAuditGuard(entry, cfg, true)
  }
</script>

{#if entry}
  <aside
    class="markdown-root flex h-full flex-1 flex-col gap-4 overflow-y-auto border-l border-surface-200-800 p-4 xl:flex-[2]"
  >
    <div class="flex items-start justify-between gap-2">
      <h2 class="h4 min-w-0">
        {#if officialUrl}
          <button
            class="inline-flex min-w-0 items-center gap-1 text-left hover:underline"
            title="Открыть страницу на skills.sh"
            onclick={() => void api.shell?.openExternal(officialUrl!)}
          >
            <span class="truncate">{entry.name}</span>
            <Icon name="external" size={16} class="opacity-60" />
          </button>
        {:else}
          {entry.name}
        {/if}
      </h2>
      <button
        class="btn btn-sm preset-tonal shrink-0"
        title="Закрыть"
        onclick={() => ui.closeDetail()}
      >
        <Icon name="close" />
      </button>
    </div>

    {#if description}
      <div>
        <p bind:this={descEl} class="text-sm opacity-80" class:line-clamp-3={!descExpanded}>
          {description}
        </p>
        <div class="mt-1 flex items-center gap-2">
          {#if descriptionFromOfficial}
            <span class="text-xs opacity-40">Описание: skills.sh</span>
          {/if}
          {#if descOverflow || descExpanded}
            <button
              class="ml-auto text-xs text-primary-500 hover:underline"
              onclick={() => (descExpanded = !descExpanded)}
            >
              {descExpanded ? 'Свернуть' : 'Показать полностью'}
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- README-превью показываем только после загрузки описания со skills.sh (успех/ошибка),
         как раскрываемую секцию — чтобы markdown не мигал перед описанием. -->
    {#if auditLoaded && readmeHtml}
      <div>
        <button
          class="flex w-full items-center gap-2 text-left text-sm font-semibold"
          aria-expanded={readmeOpen}
          onclick={() => (readmeOpen = !readmeOpen)}
        >
          <span>README.md / SKILL.md</span>
          <Icon
            name="chevron"
            size={14}
            class={readmeOpen ? 'opacity-60' : '-rotate-90 opacity-60'}
          />
        </button>
        {#if readmeOpen}
          <div class="markdown mt-2 text-sm opacity-90">
            <!-- eslint-disable-next-line svelte/no-at-html-tags — HTML санитизирован в main -->
            {@html readmeHtml}
          </div>
        {/if}
      </div>
    {/if}

    <dl class="space-y-2 text-sm">
      <div class="flex justify-between gap-4">
        <dt class="shrink-0 opacity-60">Источник</dt>
        <dd>{sourceTypeLabel(entry.sourceType)}</dd>
      </div>
      {#if entry.installs != null}
        <div class="flex justify-between gap-4">
          <dt class="shrink-0 opacity-60">Установок (skills.sh)</dt>
          <dd>{formatInstalls(entry.installs)}</dd>
        </div>
      {/if}
      <div class="flex justify-between gap-4">
        <dt class="shrink-0 opacity-60">Статус</dt>
        <dd>{updateStatusLabel(entry.updateStatus)}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="shrink-0 opacity-60">Установленная версия</dt>
        <dd
          class="min-w-0 truncate text-right font-mono text-xs"
          title={entry.installations[0]?.installedVersion ?? ''}
        >
          {entry.installations[0]?.installedVersion
            ? truncateMiddle(entry.installations[0].installedVersion)
            : '—'}
        </dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="shrink-0 opacity-60">Последняя версия</dt>
        <dd class="min-w-0 truncate text-right font-mono text-xs" title={entry.latestVersion ?? ''}>
          {entry.latestVersion ? truncateMiddle(entry.latestVersion) : '—'}
        </dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="shrink-0 opacity-60">Проверено</dt>
        <dd>{entry.lastCheckedAt ? formatDateTime(entry.lastCheckedAt) : '—'}</dd>
      </div>
    </dl>

    {#if officialUrl}
      <button
        class="btn btn-sm preset-tonal gap-1 self-start"
        onclick={() => void api.shell?.openExternal(officialUrl!)}
      >
        <Icon name="external" />
        Открыть на skills.sh
      </button>
    {/if}

    {#if hasAuditData(audit) && audit}
      <div>
        <div class="mb-2 flex items-center gap-2">
          <p class="text-sm font-semibold">Безопасность</p>
          <span class="badge {riskBadgeClass(audit.worstRisk)}">{riskLabel(audit.worstRisk)}</span>
        </div>
        <ul class="space-y-2 text-sm">
          {#each audit.providers as p (p.provider)}
            {@const secUrl = providerUrl(p.slug)}
            {@const hasDetails = !!p.summary || !!p.analyzedAt || !!secUrl}
            {@const open = openProviders.has(p.provider)}
            <li class="rounded border border-surface-200-800">
              <!-- Раскрывается при наличии деталей: краткая сводка API + ссылка на подстраницу
                   skills.sh (/security/{slug}), где лежат полные результаты проверки. -->
              <button
                class="flex w-full items-center gap-2 p-2 text-left"
                class:cursor-default={!hasDetails}
                aria-expanded={open}
                disabled={!hasDetails}
                onclick={() => toggleProvider(p.provider)}
              >
                <span class="font-medium">{auditProviderLabel(p.provider)}</span>
                <span class="badge {riskBadgeClass(p.risk)} ml-auto">{riskLabel(p.risk)}</span>
                {#if hasDetails}
                  <Icon
                    name="chevron"
                    size={14}
                    class={open ? 'opacity-60' : '-rotate-90 opacity-60'}
                  />
                {/if}
              </button>
              {#if open && hasDetails}
                <div class="space-y-1 border-t border-surface-200-800 p-2">
                  {#if p.summary}
                    <p class="text-xs opacity-70">{p.summary}</p>
                  {/if}
                  {#if p.analyzedAt}
                    <p class="text-xs opacity-40">Проверено: {formatDate(p.analyzedAt)}</p>
                  {/if}
                  {#if secUrl}
                    <button
                      class="inline-flex items-center gap-1 text-xs text-primary-500 hover:underline"
                      onclick={() => void api.shell?.openExternal(secUrl)}
                    >
                      Полные результаты на skills.sh
                      <Icon name="external" size={12} />
                    </button>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
        <p class="mt-1 text-xs opacity-50">Данные аудита: skills.sh</p>
      </div>
    {/if}

    {#snippet installRow(label: string, path: string)}
      <li class="flex items-center gap-2">
        <span class="shrink-0">{label}</span>
        <button
          class="min-w-0 flex-1 truncate text-left text-xs opacity-60 hover:underline"
          title={path}
          onclick={() => void api.shell?.openPath(path)}
        >
          {path}
        </button>
        <button
          class="shrink-0 text-[#0098ff] opacity-80 hover:opacity-100"
          title="Открыть в VS Code"
          onclick={() => void api.shell?.openInEditor(path)}
        >
          <Icon name="vscode" size={15} />
        </button>
      </li>
    {/snippet}

    {#if installations.length > 0}
      <div>
        <p class="mb-1 text-sm font-semibold">Установлен для агентов</p>
        <ul class="space-y-1 text-sm">
          {#if primaryInstall}
            {@render installRow('Основные', primaryInstall.installPath)}
          {/if}
          {#each otherInstalls as inst (inst.agent)}
            {@render installRow(inst.agent, inst.installPath)}
          {/each}
        </ul>
      </div>
    {/if}

    <div class="mt-auto flex flex-wrap gap-2 pt-2">
      {#if entry.hasUpdate}
        <button
          class="btn btn-sm preset-filled-warning-500"
          onclick={() =>
            toasts.guard(() => api.update.runOne(entry!.id), 'Не удалось запустить обновление')}
        >
          Обновить
        </button>
      {:else if !entry.installed && entry.sourceId !== 'installed'}
        <button class="btn btn-sm preset-filled-primary-500" onclick={install}>Установить</button>
      {/if}
      {#if entry.installed}
        <button class="btn btn-sm preset-tonal-primary" onclick={reinstall}>Переустановить</button>
        <button
          class="btn btn-sm preset-tonal-error gap-1"
          onclick={() => void uninstallWithConfirm(entry!)}
        >
          <Icon name="trash" size={14} />
          Удалить
        </button>
      {/if}
    </div>
  </aside>
{/if}

<style>
  /* Стили для {@html} рендера markdown (санитизирован в main). */
  .markdown :global(h1),
  .markdown :global(h2),
  .markdown :global(h3) {
    font-weight: 600;
    margin: 0.6em 0 0.3em;
    line-height: 1.3;
  }
  .markdown :global(h1) {
    font-size: 1.15rem;
  }
  .markdown :global(h2) {
    font-size: 1.05rem;
  }
  .markdown :global(h3) {
    font-size: 1rem;
  }
  .markdown :global(p) {
    margin: 0.4em 0;
  }
  .markdown :global(ul),
  .markdown :global(ol) {
    margin: 0.4em 0;
    padding-left: 1.2em;
    list-style: revert;
  }
  .markdown :global(a) {
    color: var(--color-primary-500);
    text-decoration: underline;
  }
  .markdown :global(code) {
    font-family: ui-monospace, monospace;
    font-size: 0.85em;
    background: color-mix(in oklab, currentColor 12%, transparent);
    padding: 0.05em 0.3em;
    border-radius: 0.25rem;
  }
  .markdown :global(pre) {
    background: color-mix(in oklab, currentColor 10%, transparent);
    padding: 0.6em 0.8em;
    border-radius: 0.4rem;
    overflow-x: auto;
    margin: 0.5em 0;
  }
  .markdown :global(pre code) {
    background: none;
    padding: 0;
  }
  .markdown :global(table) {
    border-collapse: collapse;
    margin: 0.6em 0;
    display: block;
    overflow-x: auto;
    font-size: 0.9em;
  }
  .markdown :global(th),
  .markdown :global(td) {
    border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
    padding: 0.3em 0.6em;
    text-align: left;
  }
  .markdown :global(th) {
    background: color-mix(in oklab, currentColor 8%, transparent);
    font-weight: 600;
  }
  .markdown :global(blockquote) {
    border-left: 3px solid color-mix(in oklab, currentColor 25%, transparent);
    padding-left: 0.8em;
    opacity: 0.8;
    margin: 0.5em 0;
  }
  .markdown :global(hr) {
    border: none;
    border-top: 1px solid color-mix(in oklab, currentColor 20%, transparent);
    margin: 0.8em 0;
  }
</style>
