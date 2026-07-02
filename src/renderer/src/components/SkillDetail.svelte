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
    truncateMiddle
  } from '../lib/labels'
  import { installWithAuditGuard, uninstallWithConfirm } from '../lib/install'
  import Icon from './Icon.svelte'

  let entry = $state<CatalogEntry | null>(null)
  let audit = $state<SecurityAudit | null>(null)
  let officialUrl = $state<string | null>(null)
  let readmeHtml = $state<string | null>(null)
  let auditOpen = $state(false)

  $effect(() => {
    const id = ui.detailId
    if (!id) {
      entry = null
      audit = null
      officialUrl = null
      readmeHtml = null
      return
    }
    audit = null
    officialUrl = null
    readmeHtml = null
    auditOpen = false
    // Каждый вызов обёрнут: даже если какой-то IPC-метод недоступен/бросит, эффект не
    // прервётся синхронно и переключение между карточками продолжит работать (стале-гард
    // применяет ответ, только если выбранный skill не сменился за время запроса).
    void run(() => api.catalog.get(id)).then((e) => {
      if (e !== undefined && ui.detailId === id) entry = e
    })
    void run(() => api.catalog.audit(id)).then((a) => {
      if (a !== undefined && ui.detailId === id) audit = a
    })
    void run(() => api.catalog.officialUrl(id)).then((u) => {
      if (u !== undefined && ui.detailId === id) officialUrl = u
    })
    void run(() => api.catalog.readme(id)).then((h) => {
      if (h !== undefined && ui.detailId === id) readmeHtml = h
    })
  })

  /** Безопасно вызывает IPC: синхронный бросок/отказ → undefined (не валит $effect). */
  function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    return Promise.resolve()
      .then(fn)
      .catch(() => undefined)
  }

  // Описание: собственное описание записи либо (для official) сводка Agent Trust Hub с skills.sh.
  const description = $derived(entry?.description ?? audit?.description ?? null)
  const descriptionFromOfficial = $derived(!entry?.description && !!audit?.description)

  // Основная установка (.agents/skills) — первой; путь нормализуем для разных ОС.
  function isPrimary(inst: AgentInstallation): boolean {
    return /[\\/]\.agents[\\/]skills[\\/]/.test(inst.installPath)
  }
  const installations = $derived(
    [...(entry?.installations ?? [])].sort((a, b) => Number(isPrimary(b)) - Number(isPrimary(a)))
  )

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

  function fmtDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString() : ''
  }
</script>

{#if entry}
  <aside
    class="markdown-root flex h-full flex-1 flex-col gap-4 overflow-y-auto border-l border-surface-200-800 p-4 xl:flex-[2]"
  >
    <div class="flex items-start justify-between">
      <h2 class="h4">{entry.name}</h2>
      <button class="btn btn-sm preset-tonal" title="Закрыть" onclick={() => ui.closeDetail()}>
        <Icon name="close" />
      </button>
    </div>

    {#if description}
      <div>
        <p class="text-sm opacity-80">{description}</p>
        {#if descriptionFromOfficial}
          <p class="mt-1 text-xs opacity-40">Описание: skills.sh</p>
        {/if}
      </div>
    {:else if readmeHtml}
      <!-- Нет превью skills.sh — показываем отрендеренный README.md/SKILL.md из каталога skill. -->
      <div class="markdown text-sm opacity-90">
        <!-- eslint-disable-next-line svelte/no-at-html-tags — HTML санитизирован в main -->
        {@html readmeHtml}
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
        <dd>{entry.lastCheckedAt ? new Date(entry.lastCheckedAt).toLocaleString() : '—'}</dd>
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
        <button
          class="flex w-full items-center gap-2 text-left"
          aria-expanded={auditOpen}
          onclick={() => (auditOpen = !auditOpen)}
        >
          <span class="text-sm font-semibold">Безопасность</span>
          <span class="badge {riskBadgeClass(audit.worstRisk)}">{riskLabel(audit.worstRisk)}</span>
          <span class="ml-auto text-xs opacity-50">{audit.providers.length}</span>
          <Icon
            name="chevron"
            class={auditOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </button>
        {#if auditOpen}
          <ul class="mt-2 space-y-2 text-sm">
            {#each audit.providers as p (p.provider)}
              <li class="rounded border border-surface-200-800 p-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">{auditProviderLabel(p.provider)}</span>
                  <span class="badge {riskBadgeClass(p.risk)}">{riskLabel(p.risk)}</span>
                </div>
                {#if p.summary}
                  <p class="mt-1 text-xs opacity-70">{p.summary}</p>
                {/if}
                {#if p.analyzedAt}
                  <p class="mt-1 text-xs opacity-40">Проверено: {fmtDate(p.analyzedAt)}</p>
                {/if}
              </li>
            {/each}
          </ul>
          <p class="mt-1 text-xs opacity-50">Данные аудита: skills.sh</p>
        {/if}
      </div>
    {/if}

    {#if installations.length > 0}
      <div>
        <p class="mb-1 text-sm font-semibold">Установлен для агентов</p>
        <ul class="space-y-1 text-sm">
          {#each installations as inst (inst.agent)}
            <li class="flex items-center gap-2">
              <span class="shrink-0">
                {inst.agent}{#if isPrimary(inst)}<span class="ml-1 opacity-50">· основная</span
                  >{/if}
              </span>
              <button
                class="min-w-0 flex-1 truncate text-left text-xs opacity-60 hover:underline"
                title={inst.installPath}
                onclick={() => void api.shell?.openPath(inst.installPath)}
              >
                {inst.installPath}
              </button>
              <button
                class="btn btn-icon btn-icon-sm preset-tonal shrink-0"
                title="Открыть в VS Code"
                onclick={() => void api.shell?.openInEditor(inst.installPath)}
              >
                <Icon name="editor" size={14} />
              </button>
            </li>
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
