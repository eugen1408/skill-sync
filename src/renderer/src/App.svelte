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
  import CatalogPage from './components/CatalogPage.svelte'
  import SourcesPage from './components/SourcesPage.svelte'
  import NotificationsPage from './components/NotificationsPage.svelte'
  import SettingsPage from './components/SettingsPage.svelte'
  import SkillDetail from './components/SkillDetail.svelte'
  import JobsBar from './components/JobsBar.svelte'
  import Toaster from './components/Toaster.svelte'
  import Icon, { type IconName } from './components/Icon.svelte'

  let version = $state('…')

  const nav: Array<{ view: View; label: string; icon: IconName }> = [
    { view: 'catalog', label: 'Каталог', icon: 'catalog' },
    { view: 'sources', label: 'Источники', icon: 'sources' },
    { view: 'notifications', label: 'Уведомления', icon: 'bell' },
    { view: 'settings', label: 'Настройки', icon: 'settings' }
  ]

  async function handleDeeplink(e: DeeplinkEvent): Promise<void> {
    if (!e.parsed) {
      toasts.push(`Не удалось разобрать ссылку: ${e.url}`, 'error')
      return
    }
    const { url, ref, subpath, authMode, name } = e.parsed
    const confirmed = await api.dialog.confirm({
      message: 'Добавить источник и открыть каталог?',
      detail: `Название: ${name}\nURL: ${url}\nРежим: ${authMode}`,
      confirmLabel: 'Добавить'
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
      toasts.push(`Источник ${name} добавлен`)
    } catch (err) {
      toasts.push(`Ошибка добавления: ${err instanceof Error ? err.message : String(err)}`, 'error')
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
        toasts.push(r.installedVersion ? `Установлено: ${r.installedVersion}` : 'Skill установлен')
      }
    })
    const offChecked = api.events.onUpdateChecked((r) => {
      if (r.updatesAvailable > 0) toasts.push(`Доступно обновлений: ${r.updatesAvailable}`)
    })
    const offDeeplink = api.events.onDeeplinkReceived((e) => void handleDeeplink(e))

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
    }
  })

  const appUpdateReady = $derived(config.appUpdate?.state === 'downloaded')
</script>

<div class="flex h-full flex-col">
  {#if appUpdateReady}
    <div class="flex items-center gap-3 bg-primary-500 p-2 text-sm text-white">
      <span class="flex-1">Доступно обновление приложения {config.appUpdate?.version ?? ''}</span>
      <button class="btn btn-sm preset-filled" onclick={() => api.app.quitAndInstall()}>
        Перезапустить
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
          <span class="flex-1 text-left">{item.label}</span>
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
      <main class="flex-1 overflow-auto p-6">
        {#if ui.view === 'catalog'}
          <CatalogPage />
        {:else if ui.view === 'sources'}
          <SourcesPage />
        {:else if ui.view === 'notifications'}
          <NotificationsPage />
        {:else if ui.view === 'settings'}
          <SettingsPage />
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
