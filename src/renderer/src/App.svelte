<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from './lib/api'
  import { ui, type View } from './lib/stores/ui.svelte'
  import { catalog } from './lib/stores/catalog.svelte'
  import { sources } from './lib/stores/sources.svelte'
  import { notifications } from './lib/stores/notifications.svelte'
  import { jobs } from './lib/stores/jobs.svelte'
  import { config } from './lib/stores/config.svelte'
  import CatalogPage from './components/CatalogPage.svelte'
  import SourcesPage from './components/SourcesPage.svelte'
  import NotificationsPage from './components/NotificationsPage.svelte'
  import SettingsPage from './components/SettingsPage.svelte'
  import SkillDetail from './components/SkillDetail.svelte'
  import JobsBar from './components/JobsBar.svelte'
  import Toaster from './components/Toaster.svelte'

  let version = $state('…')

  const nav: Array<{ view: View; label: string; icon: string }> = [
    { view: 'catalog', label: 'Каталог', icon: '📚' },
    { view: 'sources', label: 'Источники', icon: '🔌' },
    { view: 'notifications', label: 'Уведомления', icon: '🔔' },
    { view: 'settings', label: 'Настройки', icon: '⚙️' }
  ]

  onMount(() => {
    jobs.init()
    config.init()
    catalog.init()
    sources.init()
    notifications.init()
    void api.app.getVersion().then((v) => (version = v))
    return () => {
      jobs.destroy()
      config.destroy()
      catalog.destroy()
      sources.destroy()
      notifications.destroy()
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
          class="btn justify-start {ui.view === item.view
            ? 'preset-filled-primary-500'
            : 'preset-tonal'}"
          onclick={() => ui.go(item.view)}
        >
          <span>{item.icon}</span>
          <span class="flex-1 text-left">{item.label}</span>
          {#if item.view === 'notifications' && notifications.unread > 0}
            <span class="badge preset-filled-error-500">{notifications.unread}</span>
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
