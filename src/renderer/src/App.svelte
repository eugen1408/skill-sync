<script lang="ts">
  import { onMount } from 'svelte'
  import type { DeeplinkEvent } from '@shared/ipc/contract'
  import { api } from './lib/api'
  import { ui, type View } from './lib/stores/ui.svelte'
  import { catalog } from './lib/stores/catalog.svelte'
  import { sources } from './lib/stores/sources.svelte'
  import { notifications } from './lib/stores/notifications.svelte'
  import { jobs } from './lib/stores/jobs.svelte'
  import { config } from './lib/stores/config.svelte'
  import { toasts } from './lib/stores/toasts.svelte'
  import { t, i18n } from './lib/i18n.svelte'
  import CatalogPage from './components/CatalogPage.svelte'
  import SourcesPage from './components/SourcesPage.svelte'
  import NotificationsPage from './components/NotificationsPage.svelte'
  import SettingsPage from './components/SettingsPage.svelte'
  import SkillDetail from './components/SkillDetail.svelte'
  import JobsBar from './components/JobsBar.svelte'
  import Toaster from './components/Toaster.svelte'
  import Icon, { type IconName } from './components/Icon.svelte'

  let version = $state('…')
  let githubRateLimitExceeded = $state(false)

  const nav: Array<{ view: View; labelKey: Parameters<typeof t>[0]; icon: IconName }> = [
    { view: 'catalog', labelKey: 'nav.catalog', icon: 'catalog' },
    { view: 'sources', labelKey: 'nav.sources', icon: 'git' },
    { view: 'notifications', labelKey: 'nav.notifications', icon: 'bell' },
    { view: 'settings', labelKey: 'nav.settings', icon: 'settings' }
  ]

  async function handleDeeplink(e: DeeplinkEvent): Promise<void> {
    if (!e.parsed) {
      toasts.push(t('toast.deeplinkParseFailed', { url: e.url }), 'error')
      return
    }
    const { url, ref, subpath, authMode, name } = e.parsed
    const confirmed = await api.dialog.confirm({
      message: t('deeplink.confirmMessage'),
      detail: t('deeplink.confirmDetail', { name, url, mode: authMode }),
      confirmLabel: t('deeplink.confirmAdd')
    })
    if (!confirmed) return
    try {
      const source = await api.source.add({
        type: 'git',
        name,
        config: { url, ref, subpath, authMode, localPath: null, watch: false }
      })
      ui.go('catalog')
      catalog.sourceIds = [source.id]
      catalog.load()
      toasts.push(t('toast.sourceAdded', { name }))
    } catch (err) {
      toasts.push(
        t('toast.addFailed', { error: err instanceof Error ? err.message : String(err) }),
        'error'
      )
    }
  }

  onMount(() => {
    jobs.init()
    config.init()
    catalog.init()
    sources.init()
    notifications.init()
    void api.app.getVersion().then((v) => (version = v))

    // Транзиентная обратная связь по фоновым событиям (ошибки уже идут в уведомления).
    const offInstall = api.events.onInstallResult((r) => {
      if (r.status === 'ok') {
        const key = r.wasUpdate ? 'toast.updated' : 'toast.installed'
        const genericKey = r.wasUpdate ? 'toast.updatedGeneric' : 'toast.installedGeneric'
        toasts.push(
          r.installedVersion
            ? t(key, { name: r.skillId, version: r.installedVersion })
            : t(genericKey, { name: r.skillId }),
          'success'
        )
      }
    })
    const offChecked = api.events.onUpdateChecked((r) => {
      if (r.updatesAvailable > 0)
        toasts.push(t('toast.updatesAvailable', { count: r.updatesAvailable }))
    })
    const offDeeplink = api.events.onDeeplinkReceived((e) => void handleDeeplink(e))
    const offRateLimit = api.events.onGithubRateLimit(() => {
      githubRateLimitExceeded = true
    })

    // Диплинки холодного старта копятся в main до готовности renderer'а — забираем их
    // после регистрации подписки, чтобы не потерять и не продублировать событие.
    void api.app.consumePendingDeeplinks().then((events) => {
      for (const e of events) void handleDeeplink(e)
    })

    return () => {
      jobs.destroy()
      config.destroy()
      catalog.destroy()
      sources.destroy()
      notifications.destroy()
      offInstall()
      offChecked()
      offDeeplink()
      offRateLimit()
    }
  })

  const appUpdateReady = $derived(config.appUpdate?.state === 'downloaded')
  const appUpdateManual = $derived(config.appUpdate?.state === 'manual-download')

  // Конфиг — источник истины для языка; синхронизируем i18n после его загрузки
  // (localStorage — лишь кэш для мгновенного первого рендера до готовности IPC).
  $effect(() => {
    const lang = config.config?.ui.language
    if (lang && lang !== i18n.pref) i18n.set(lang)
  })
</script>

<div class="flex h-full flex-col">
  {#if githubRateLimitExceeded}
    <div class="flex items-center gap-3 bg-warning-500 p-2 pl-4 pr-2 text-sm text-black">
      <span class="flex-1 font-medium">{t('app.githubRateLimitBanner')}</span>
      <button
        class="btn btn-sm bg-black/10 hover:bg-black/20 text-black border-none"
        onclick={() => {
          githubRateLimitExceeded = false
          ui.go('settings')
        }}
      >
        {t('app.configureToken')}
      </button>
      <button
        class="btn-icon btn-icon-sm hover:bg-black/10 text-black"
        title={t('common.close')}
        onclick={() => (githubRateLimitExceeded = false)}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  {/if}

  {#if appUpdateReady}
    <div class="flex items-center gap-3 bg-primary-500 p-2 text-sm text-white">
      <span class="flex-1"
        >{t('app.updateBanner', { version: config.appUpdate?.version ?? '' })}</span
      >
      <button class="btn btn-sm preset-filled" onclick={() => api.app.quitAndInstall()}>
        {t('app.restart')}
      </button>
    </div>
  {/if}

  {#if appUpdateManual}
    <div class="flex items-center gap-3 bg-tertiary-500 p-2 text-sm text-white">
      <span class="flex-1"
        >{t('app.updateManualBanner', { version: config.appUpdate?.version ?? '' })}</span
      >
      <button class="btn btn-sm preset-filled" onclick={() => api.shell.openExternal('https://github.com/eugen1408/skill-sync/releases/latest')}>
        {t('app.download')}
      </button>
    </div>
  {/if}

  <div class="flex flex-1 overflow-hidden">
    <nav class="flex w-48 flex-col gap-1 border-r border-surface-200-800 p-2">
      <div class="p-2">
        <span class="h5">Skill Sync</span>
        <span class="block text-xs opacity-50">v{version}</span>
      </div>
      {#each nav as item (item.view)}
        <button
          class="btn relative justify-start {ui.view === item.view
            ? 'preset-filled-primary-500'
            : 'preset-tonal'}"
          onclick={() => ui.go(item.view)}
        >
          <Icon name={item.icon} size={18} />
          <span class="flex-1 text-left">{t(item.labelKey)}</span>
          {#if item.view === 'notifications' && notifications.unread > 0}
            <span
              class="absolute right-0 top-0 inline-flex h-5 min-w-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full bg-error-500 px-1.5 text-xs font-semibold text-white"
            >
              {notifications.unread}
            </span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="flex flex-1 overflow-hidden">
      <main class="flex-1 overflow-auto bg-surface-base">
        {#if ui.view === 'catalog'}
          <CatalogPage />
        {:else if ui.view === 'sources'}
          <div class="p-6"><SourcesPage /></div>
        {:else if ui.view === 'notifications'}
          <div class="p-6"><NotificationsPage /></div>
        {:else if ui.view === 'settings'}
          <div class="p-6"><SettingsPage /></div>
        {/if}
      </main>

      {#if ui.view === 'catalog' && ui.detailId}
        <SkillDetail />
      {/if}
    </div>
  </div>

  <JobsBar />
</div>

<Toaster />
