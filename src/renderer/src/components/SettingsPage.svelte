<script lang="ts">
  import { onMount } from 'svelte'
  import { KNOWN_AGENTS } from '@shared/domain/agent'
  import type { UpdateSettings } from '@shared/domain/config'
  import { api } from '../lib/api'
  import { config } from '../lib/stores/config.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'
  import { theme, type ThemeMode } from '../lib/stores/theme.svelte'

  const cfg = $derived(config.config)

  const themeModes: Array<{ value: ThemeMode; label: string }> = [
    { value: 'system', label: 'Как в системе' },
    { value: 'light', label: 'Светлая' },
    { value: 'dark', label: 'Тёмная' }
  ]

  // Ключ должен совпадать с GITHUB_TOKEN_KEY в main/secrets/SecretStore.
  const GITHUB_TOKEN_KEY = 'githubToken'
  let secretsAvailable = $state(true)
  let tokenSet = $state(false)
  let tokenInput = $state('')

  onMount(async () => {
    secretsAvailable = await api.secrets.available()
    tokenSet = await api.secrets.has(GITHUB_TOKEN_KEY)
  })

  function saveToken(): void {
    void toasts.guard(async () => {
      await api.secrets.set(GITHUB_TOKEN_KEY, tokenInput)
      tokenInput = ''
      tokenSet = await api.secrets.has(GITHUB_TOKEN_KEY)
    }, 'Не удалось сохранить токен')
  }

  function clearToken(): void {
    void toasts.guard(async () => {
      await api.secrets.delete(GITHUB_TOKEN_KEY)
      tokenSet = false
    }, 'Не удалось удалить токен')
  }

  const intervalPresets: Array<{ minutes: number; label: string }> = [
    { minutes: 60, label: 'Каждый час' },
    { minutes: 360, label: 'Каждые 6 часов' },
    { minutes: 1440, label: 'Раз в день' }
  ]

  function toggleAgent(id: string): void {
    if (!cfg) return
    const prev = cfg.install.targetAgents
    const next = prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    const scope = cfg.install.scope
    void toasts.guard(async () => {
      // Предпросмотр операций реконсиляции и подтверждение до применения (follow-up [13]).
      const preview = await api.install.previewReconcile({
        previousAgents: prev,
        nextAgents: next,
        scope
      })
      if (preview.ops.length > 0) {
        const links = preview.ops.filter((o) => o.action === 'link').length
        const unlinks = preview.ops.filter((o) => o.action === 'unlink').length
        const parts: string[] = []
        if (links) parts.push(`создать ${links} симлинк(ов)`)
        if (unlinks) parts.push(`удалить ${unlinks} симлинк(ов)`)
        const ok = await api.dialog.confirm({
          message: `Изменение набора агентов затронет ${preview.skillCount} установленных skills.`,
          detail: `Будет: ${parts.join(', ')}.`,
          confirmLabel: 'Применить'
        })
        if (!ok) return
      }
      await config.update({ install: { ...cfg.install, targetAgents: next } })
      await api.install.reconcileAgents({ previousAgents: prev, nextAgents: next, scope })
    }, 'Не удалось применить набор агентов')
  }

  async function setUpdate(patch: Partial<UpdateSettings>): Promise<void> {
    await api.update.setSettings(patch)
    await config.load()
  }

  async function resetApp(): Promise<void> {
    const ok = await api.dialog.confirm({
      message: 'Сбросить все настройки и кэш приложения?',
      detail:
        'Будет удалена вся персистентная информация (источники, конфигурация, токены). Текущие установленные skills затронуты не будут. Приложение перезапустится.',
      confirmLabel: 'Сбросить'
    })
    if (!ok) return
    await api.app.reset()
  }
</script>

{#if cfg}
  <div class="mx-auto max-w-2xl space-y-6">
    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">Оформление</h3>
      <div class="flex gap-2">
        {#each themeModes as m (m.value)}
          <button
            class="btn btn-sm {theme.mode === m.value
              ? 'preset-filled-primary-500'
              : 'preset-tonal'}"
            onclick={() => theme.set(m.value)}
          >
            {m.label}
          </button>
        {/each}
      </div>
    </section>

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
        <div class="flex flex-wrap gap-2">
          {#each intervalPresets as p (p.minutes)}
            <button
              class="btn btn-sm {cfg.update.scheduleIntervalMinutes === p.minutes
                ? 'preset-filled-primary-500'
                : 'preset-tonal'}"
              onclick={() => setUpdate({ scheduleIntervalMinutes: p.minutes })}
            >
              {p.label}
            </button>
          {/each}
        </div>
        <label class="flex items-center gap-2">
          <span class="text-sm">Свой интервал, минут</span>
          <input
            type="number"
            min="1"
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
      <h3 class="h5">GitHub-токен</h3>
      <p class="text-sm opacity-60">
        Для лимитов GitHub API (проверка версий) и приватных репозиториев. Хранится в системном
        хранилище (safeStorage), не в конфигурации.
      </p>
      {#if !secretsAvailable}
        <p class="text-sm text-error-500">
          Защищённое хранилище недоступно — токен не будет сохранён между запусками.
        </p>
      {/if}
      <div class="flex items-center gap-2">
        <span class="badge {tokenSet ? 'preset-filled-success-500' : 'preset-tonal'}">
          {tokenSet ? 'Задан' : 'Не задан'}
        </span>
      </div>
      <div class="flex gap-2">
        <input
          class="input flex-1"
          type="password"
          placeholder="Новый токен"
          bind:value={tokenInput}
        />
        <button
          class="btn btn-sm preset-filled-primary-500"
          disabled={!tokenInput}
          onclick={saveToken}
        >
          Сохранить
        </button>
        {#if tokenSet}
          <button class="btn btn-sm preset-tonal" onclick={clearToken}>Удалить</button>
        {/if}
      </div>
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

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5 text-error-500">Сброс приложения</h3>
      <p class="text-sm opacity-60">
        Удаляет всю персистентную информацию приложения (конфигурацию, секреты, кэш источников).
        Текущие установленные skills не будут затронуты.
      </p>
      <button class="btn btn-sm preset-filled-error-500" onclick={resetApp}>
        Сбросить настройки и кэш приложения
      </button>
    </section>
  </div>
{/if}
