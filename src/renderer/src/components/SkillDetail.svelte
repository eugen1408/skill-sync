<script lang="ts">
  import type { CatalogEntry } from '@shared/domain/skill'
  import { api } from '../lib/api'
  import { config } from '../lib/stores/config.svelte'
  import { ui } from '../lib/stores/ui.svelte'
  import { updateStatusLabel, sourceTypeLabel } from '../lib/labels'

  let entry = $state<CatalogEntry | null>(null)

  $effect(() => {
    const id = ui.detailId
    if (!id) {
      entry = null
      return
    }
    void api.catalog.get(id).then((e) => (entry = e))
  })

  async function install(): Promise<void> {
    const cfg = config.config
    if (!cfg || !entry) return
    await api.install.run({
      skillId: entry.id,
      sourceId: entry.sourceId,
      sourceRef: entry.sourceRef,
      targetAgents: cfg.install.targetAgents,
      scope: cfg.install.scope,
      force: false
    })
  }
</script>

{#if entry}
  <aside class="flex h-full w-96 flex-col gap-4 border-l border-surface-200-800 p-4">
    <div class="flex items-start justify-between">
      <h2 class="h4">{entry.name}</h2>
      <button class="btn btn-sm preset-tonal" onclick={() => ui.closeDetail()}>✕</button>
    </div>

    {#if entry.description}
      <p class="text-sm opacity-80">{entry.description}</p>
    {/if}

    <dl class="space-y-2 text-sm">
      <div class="flex justify-between">
        <dt class="opacity-60">Источник</dt>
        <dd>{sourceTypeLabel(entry.sourceType)}</dd>
      </div>
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

    <div class="mt-auto flex flex-wrap gap-2">
      <button class="btn btn-sm preset-tonal" onclick={() => api.update.checkOne(entry!.id)}>
        Проверить
      </button>
      {#if entry.hasUpdate}
        <button
          class="btn btn-sm preset-filled-warning-500"
          onclick={() => api.update.runOne(entry!.id)}
        >
          Обновить
        </button>
      {:else if !entry.installed && entry.sourceId !== 'installed'}
        <button class="btn btn-sm preset-filled-primary-500" onclick={install}>Установить</button>
      {/if}
    </div>
  </aside>
{/if}
