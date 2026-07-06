<script lang="ts">
  import { onMount } from 'svelte'
  import { KNOWN_AGENTS } from '@shared/domain/agent'
  import type { UpdateSettings } from '@shared/domain/config'
  import { api } from '../lib/api'
  import { config } from '../lib/stores/config.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'
  import { theme, type ThemeMode } from '../lib/stores/theme.svelte'
  import { t, i18n, type LocalePref } from '../lib/i18n.svelte'

  const cfg = $derived(config.config)

  const themeModes: Array<{ value: ThemeMode; labelKey: Parameters<typeof t>[0] }> = [
    { value: 'system', labelKey: 'theme.system' },
    { value: 'light', labelKey: 'theme.light' },
    { value: 'dark', labelKey: 'theme.dark' }
  ]

  const langModes: Array<{ value: LocalePref; labelKey: Parameters<typeof t>[0] }> = [
    { value: 'system', labelKey: 'lang.system' },
    { value: 'en', labelKey: 'lang.en' },
    { value: 'ru', labelKey: 'lang.ru' }
  ]

  // Язык — часть конфига (доступен main для локализации трея); i18n.set — мгновенный отклик UI.
  function setLanguage(pref: LocalePref): void {
    i18n.set(pref)
    if (cfg) void config.update({ ui: { ...cfg.ui, language: pref } })
  }

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
    }, t('error.saveToken'))
  }

  function clearToken(): void {
    void toasts.guard(async () => {
      await api.secrets.delete(GITHUB_TOKEN_KEY)
      tokenSet = false
    }, t('error.deleteToken'))
  }

  const intervalPresets: Array<{ minutes: number; labelKey: Parameters<typeof t>[0] }> = [
    { minutes: 60, labelKey: 'interval.hourly' },
    { minutes: 360, labelKey: 'interval.6h' },
    { minutes: 1440, labelKey: 'interval.daily' }
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
        if (links) parts.push(t('reconcile.createLinks', { n: links }))
        if (unlinks) parts.push(t('reconcile.removeLinks', { n: unlinks }))
        const ok = await api.dialog.confirm({
          message: t('reconcile.confirmMessage', { count: preview.skillCount }),
          detail: t('reconcile.confirmDetail', { parts: parts.join(', ') }),
          confirmLabel: t('reconcile.apply')
        })
        if (!ok) return
      }
      await config.update({ install: { ...cfg.install, targetAgents: next } })
      await api.install.reconcileAgents({ previousAgents: prev, nextAgents: next, scope })
    }, t('error.applyAgents'))
  }

  async function setUpdate(patch: Partial<UpdateSettings>): Promise<void> {
    await api.update.setSettings(patch)
    await config.load()
  }

  async function resetApp(): Promise<void> {
    const ok = await api.dialog.confirm({
      message: t('reset.confirmMessage'),
      detail: t('reset.confirmDetail'),
      confirmLabel: t('reset.confirmButton')
    })
    if (!ok) return
    await api.app.reset()
  }
</script>

{#if cfg}
  <div class="mx-auto max-w-2xl space-y-6">
    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">{t('settings.appearance')}</h3>
      <div class="flex gap-2">
        {#each themeModes as m (m.value)}
          <button
            class="btn btn-sm {theme.mode === m.value
              ? 'preset-filled-primary-500'
              : 'preset-tonal'}"
            onclick={() => theme.set(m.value)}
          >
            {t(m.labelKey)}
          </button>
        {/each}
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm">{t('settings.language')}</span>
        <div class="flex gap-2">
          {#each langModes as m (m.value)}
            <button
              class="btn btn-sm {i18n.pref === m.value
                ? 'preset-filled-primary-500'
                : 'preset-tonal'}"
              onclick={() => setLanguage(m.value)}
            >
              {t(m.labelKey)}
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">{t('settings.targetAgents')}</h3>
      <p class="text-sm opacity-60">{t('settings.targetAgentsHint')}</p>
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
        <span class="text-sm">{t('settings.installScope')}</span>
        <select
          class="select max-w-40 ps-3 pr-8"
          value={cfg.install.scope}
          onchange={(e) =>
            config.update({
              install: { ...cfg.install, scope: e.currentTarget.value as 'global' | 'project' }
            })}
        >
          <option value="global">{t('scope.global')}</option>
          <option value="project">{t('scope.project')}</option>
        </select>
      </label>
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">{t('settings.updates')}</h3>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="checkbox"
          checked={cfg.update.checkOnLaunch}
          onchange={(e) => setUpdate({ checkOnLaunch: e.currentTarget.checked })}
        />
        <span class="text-sm">{t('settings.checkOnLaunch')}</span>
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="checkbox"
          checked={cfg.update.scheduleEnabled}
          onchange={(e) => setUpdate({ scheduleEnabled: e.currentTarget.checked })}
        />
        <span class="text-sm">{t('settings.checkSchedule')}</span>
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
              {t(p.labelKey)}
            </button>
          {/each}
        </div>
        <label class="flex items-center gap-2">
          <span class="text-sm">{t('settings.customInterval')}</span>
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
        <span class="text-sm">{t('settings.watchLocal')}</span>
      </label>
      <button
        class="btn btn-sm preset-tonal"
        onclick={() => toasts.guard(() => api.update.checkAll(), t('error.checkStart'))}
      >
        {t('settings.checkNow')}
      </button>
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">{t('settings.cliNetwork')}</h3>
      <input
        class="input"
        placeholder={t('settings.cliPathPlaceholder')}
        value={cfg.install.cliPath ?? ''}
        onchange={(e) =>
          config.update({ install: { ...cfg.install, cliPath: e.currentTarget.value || null } })}
      />
      <input
        class="input"
        placeholder={t('settings.npmRegistryPlaceholder')}
        value={cfg.install.npmRegistry ?? ''}
        onchange={(e) =>
          config.update({
            install: { ...cfg.install, npmRegistry: e.currentTarget.value || null }
          })}
      />
      <input
        class="input"
        placeholder={t('settings.proxyPlaceholder')}
        value={cfg.network.proxyUrl ?? ''}
        onchange={(e) =>
          config.update({ network: { ...cfg.network, proxyUrl: e.currentTarget.value || null } })}
      />
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">{t('settings.githubToken')}</h3>
      <p class="text-sm opacity-60">
        {t('settings.githubTokenHint')}
        <br />
        <button
          class="anchor bg-transparent border-0 p-0 cursor-pointer text-left text-sm"
          onclick={() =>
            api.shell.openExternal('https://github.com/settings/personal-access-tokens/new')}
        >
          {t('settings.createGithubToken')}
        </button>
      </p>
      {#if !secretsAvailable}
        <p class="text-sm text-error-500">{t('settings.secretsUnavailable')}</p>
      {/if}
      <div class="flex items-center gap-2">
        <span class="badge {tokenSet ? 'preset-filled-success-500' : 'preset-tonal'}">
          {tokenSet ? t('settings.tokenSet') : t('settings.tokenNotSet')}
        </span>
      </div>
      <div class="flex gap-2">
        <input
          class="input flex-1"
          type="password"
          placeholder={t('settings.newToken')}
          bind:value={tokenInput}
        />
        <button
          class="btn btn-sm preset-filled-primary-500"
          disabled={!tokenInput}
          onclick={saveToken}
        >
          {t('common.save')}
        </button>
        {#if tokenSet}
          <button class="btn btn-sm preset-tonal" onclick={clearToken}>{t('common.remove')}</button>
        {/if}
      </div>
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5">{t('settings.appUpdate')}</h3>
      {#if config.appUpdate}
        <p class="text-sm opacity-70">
          {t('settings.appUpdateStatus', { state: config.appUpdate.state })}
        </p>
      {/if}
      <button class="btn btn-sm preset-tonal" onclick={() => api.app.checkForUpdates()}>
        {t('settings.checkAppUpdate')}
      </button>
      {#if config.appUpdate?.state === 'downloaded'}
        <button
          class="btn btn-sm preset-filled-primary-500"
          onclick={() => api.app.quitAndInstall()}
        >
          {t('settings.restartUpdate')}
        </button>
      {/if}
    </section>

    <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
      <h3 class="h5 text-error-500">{t('settings.reset')}</h3>
      <p class="text-sm opacity-60">{t('settings.resetHint')}</p>
      <button class="btn btn-sm preset-filled-error-500" onclick={resetApp}>
        {t('settings.resetButton')}
      </button>
    </section>
  </div>
{/if}
