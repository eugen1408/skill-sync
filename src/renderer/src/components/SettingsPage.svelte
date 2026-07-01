<script lang="ts">
  import { KNOWN_AGENTS } from '@shared/domain/agent'
  import type { UpdateSettings } from '@shared/domain/config'
  import { api } from '../lib/api'
  import { config } from '../lib/stores/config.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'

  const cfg = $derived(config.config)

  function toggleAgent(id: string): void {
    if (!cfg) return
    const prev = cfg.install.targetAgents
    const next = prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    void toasts.guard(async () => {
      await config.update({ install: { ...cfg.install, targetAgents: next } })
      // Реконсиляция симлинков установленных skills под новый набор агентов (эпик Q-01).
      await api.install.reconcileAgents({
        previousAgents: prev,
        nextAgents: next,
        scope: cfg.install.scope
      })
    }, 'Не удалось применить набор агентов')
  }

  async function setUpdate(patch: Partial<UpdateSettings>): Promise<void> {
    await api.update.setSettings(patch)
    await config.load()
  }
</script>

{#if cfg}
  <div class="mx-auto max-w-2xl space-y-6">
    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">Целевые агенты</h3>
      <p class="text-sm opacity-60">
        При изменении набора симлинки установленных skills автоматически приводятся в соответствие.
      </p>
      <div class="flex flex-wrap gap-2">
        {#each KNOWN_AGENTS as agent (agent.id)}
          <button
            class="btn btn-sm {cfg.install.targetAgents.includes(agent.id)
              ? 'preset-filled-primary-500'
              : 'preset-tonal'}"
            onclick={() => toggleAgent(agent.id)}
          >
            {agent.label}
          </button>
        {/each}
      </div>
      <label class="flex items-center gap-2">
        <span class="text-sm">Область установки</span>
        <select
          class="select max-w-40"
          value={cfg.install.scope}
          onchange={(e) =>
            config.update({
              install: { ...cfg.install, scope: e.currentTarget.value as 'global' | 'project' }
            })}
        >
          <option value="global">Глобально</option>
          <option value="project">Проект</option>
        </select>
      </label>
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">Обновления</h3>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="checkbox"
          checked={cfg.update.checkOnLaunch}
          onchange={(e) => setUpdate({ checkOnLaunch: e.currentTarget.checked })}
        />
        <span class="text-sm">Проверять при запуске</span>
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="checkbox"
          checked={cfg.update.scheduleEnabled}
          onchange={(e) => setUpdate({ scheduleEnabled: e.currentTarget.checked })}
        />
        <span class="text-sm">Проверять по расписанию</span>
      </label>
      {#if cfg.update.scheduleEnabled}
        <label class="flex items-center gap-2">
          <span class="text-sm">Интервал, минут</span>
          <input
            type="number"
            class="input max-w-28"
            value={cfg.update.scheduleIntervalMinutes ?? 60}
            onchange={(e) => setUpdate({ scheduleIntervalMinutes: Number(e.currentTarget.value) })}
          />
        </label>
      {/if}
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="checkbox"
          checked={cfg.update.watchLocalSources}
          onchange={(e) => setUpdate({ watchLocalSources: e.currentTarget.checked })}
        />
        <span class="text-sm">Следить за локальными источниками</span>
      </label>
      <button
        class="btn btn-sm preset-tonal"
        onclick={() => toasts.guard(() => api.update.checkAll(), 'Не удалось запустить проверку')}
      >
        Проверить обновления сейчас
      </button>
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">CLI и сеть</h3>
      <input
        class="input"
        placeholder="Путь к бинарю skills (необязательно)"
        value={cfg.install.cliPath ?? ''}
        onchange={(e) =>
          config.update({ install: { ...cfg.install, cliPath: e.currentTarget.value || null } })}
      />
      <input
        class="input"
        placeholder="npm registry (необязательно)"
        value={cfg.install.npmRegistry ?? ''}
        onchange={(e) =>
          config.update({
            install: { ...cfg.install, npmRegistry: e.currentTarget.value || null }
          })}
      />
      <input
        class="input"
        placeholder="Прокси (необязательно)"
        value={cfg.network.proxyUrl ?? ''}
        onchange={(e) =>
          config.update({ network: { ...cfg.network, proxyUrl: e.currentTarget.value || null } })}
      />
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">Обновление приложения</h3>
      {#if config.appUpdate}
        <p class="text-sm opacity-70">Статус: {config.appUpdate.state}</p>
      {/if}
      <button class="btn btn-sm preset-tonal" onclick={() => api.app.checkForUpdates()}>
        Проверить обновления приложения
      </button>
      {#if config.appUpdate?.state === 'downloaded'}
        <button
          class="btn btn-sm preset-filled-primary-500"
          onclick={() => api.app.quitAndInstall()}
        >
          Перезапустить и обновить
        </button>
      {/if}
    </section>
  </div>
{/if}
