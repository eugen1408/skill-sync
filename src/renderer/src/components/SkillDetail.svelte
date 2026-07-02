<script lang="ts">
  import type { CatalogEntry } from '@shared/domain/skill'
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
    formatInstalls
  } from '../lib/labels'
  import { installWithAuditGuard, uninstallWithConfirm } from '../lib/install'

  let entry = $state<CatalogEntry | null>(null)
  let audit = $state<SecurityAudit | null>(null)
  let officialUrl = $state<string | null>(null)

  $effect(() => {
    const id = ui.detailId
    if (!id) {
      entry = null
      audit = null
      officialUrl = null
      return
    }
    audit = null
    officialUrl = null
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
    class="flex h-full w-96 flex-col gap-4 overflow-y-auto border-l border-surface-200-800 p-4"
  >
    <div class="flex items-start justify-between">
      <h2 class="h4">{entry.name}</h2>
      <button class="btn btn-sm preset-tonal" onclick={() => ui.closeDetail()}>✕</button>
    </div>

    {#if description}
      <div>
        <p class="text-sm opacity-80">{description}</p>
        {#if descriptionFromOfficial}
          <p class="mt-1 text-xs opacity-40">Описание: skills.sh</p>
        {/if}
      </div>
    {/if}

    <dl class="space-y-2 text-sm">
      <div class="flex justify-between">
        <dt class="opacity-60">Источник</dt>
        <dd>{sourceTypeLabel(entry.sourceType)}</dd>
      </div>
      {#if entry.installs != null}
        <div class="flex justify-between">
          <dt class="opacity-60">Установок (skills.sh)</dt>
          <dd>{formatInstalls(entry.installs)}</dd>
        </div>
      {/if}
      <div class="flex justify-between">
        <dt class="opacity-60">Статус</dt>
        <dd>{updateStatusLabel(entry.updateStatus)}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="opacity-60">Установленная версия</dt>
        <dd>{entry.installations[0]?.installedVersion ?? '—'}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="opacity-60">Последняя версия</dt>
        <dd>{entry.latestVersion ?? '—'}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="opacity-60">Проверено</dt>
        <dd>{entry.lastCheckedAt ? new Date(entry.lastCheckedAt).toLocaleString() : '—'}</dd>
      </div>
    </dl>

    {#if officialUrl}
      <button
        class="btn btn-sm preset-tonal self-start"
        onclick={() => void api.shell?.openExternal(officialUrl!)}
      >
        ↗ Открыть на skills.sh
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
      </div>
    {/if}

    {#if entry.installations.length > 0}
      <div>
        <p class="mb-1 text-sm font-semibold">Установлен для агентов</p>
        <ul class="space-y-1 text-sm">
          {#each entry.installations as inst (inst.agent)}
            <li class="opacity-80">
              {inst.agent} — <span class="opacity-60">{inst.installPath}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="mt-auto flex flex-wrap gap-2 pt-2">
      <button
        class="btn btn-sm preset-tonal"
        onclick={() =>
          toasts.guard(() => api.update.checkOne(entry!.id), 'Не удалось запустить проверку')}
      >
        Проверить
      </button>
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
          class="btn btn-sm preset-tonal-error"
          onclick={() => void uninstallWithConfirm(entry!)}
        >
          Удалить
        </button>
      {/if}
    </div>
  </aside>
{/if}
