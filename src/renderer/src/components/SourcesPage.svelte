<script lang="ts">
import { OFFICIAL_SOURCE_ID, getSourceDomain } from '@shared/domain/source'
  import { gitRepoWebUrl } from '@shared/domain/gitSource'
  import { Switch } from '@skeletonlabs/skeleton-svelte'
  import { api } from '../lib/api'
  import { sources } from '../lib/stores/sources.svelte'
  import { config } from '../lib/stores/config.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'
  import { ui } from '../lib/stores/ui.svelte'
  import { sourceTypeLabel, sourceStatusLabel } from '../lib/labels'
  import { t } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'
  import Favicon from './Favicon.svelte'
  import AddSourceForm from './AddSourceForm.svelte'

  function statusBadge(status: string): string {
    if (status === 'ok') return 'preset-filled-success-500'
    if (status === 'error') return 'preset-filled-error-500'
    if (status === 'indexing') return 'preset-filled-primary-500'
    return 'preset-tonal'
  }



  const groupedSources = $derived.by(() => {
    const map = new Map<string, typeof sources.items>()
    for (const s of sources.items) {
      const domain = getSourceDomain(s)
      if (!map.has(domain)) map.set(domain, [])
      map.get(domain)!.push(s)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  })

  function toggleAutoUpdate(domain: string, checked: boolean): void {
    const current = config.config?.update.autoUpdateDomains ?? []
    const next = checked ? [...current, domain] : current.filter((d) => d !== domain)
    void config.update({ update: { ...$state.snapshot(config.config!.update), autoUpdateDomains: next } })
  }

  async function confirmRemoveSource(sourceId: string, name: string) {
    const ok = await api.dialog.confirm({
      message: t('sources.confirmRemove', { name }),
      detail: t('sources.confirmRemoveDetail'),
      confirmLabel: t('sources.remove')
    })
    if (ok) {
      await toasts.guard(() => sources.remove(sourceId), t('error.sourceRemove'))
    }
  }
</script>

<div class="flex flex-col-reverse xl:flex-row gap-6">
  <div class="flex-[2] min-w-0 space-y-2">
    {#if sources.items.length === 0}
      <div class="card preset-outlined-surface-200-800 space-y-2 p-8 text-center">
        <p class="opacity-70">{t('sources.empty')}</p>
        <p class="text-sm opacity-50">{t('sources.emptyHint')}</p>
      </div>
    {:else}
      {#each groupedSources as [domain, group] (domain)}
        <div class="card preset-outlined-surface-200-800 p-0 overflow-hidden">
          <details class="group" 
                   open={ui.sourcesGroupsOpen[domain] !== false}
                   ontoggle={(e) => ui.sourcesGroupsOpen[domain] = e.currentTarget.open}>
            <summary
              class="flex items-center justify-between p-4 cursor-pointer hover:preset-tonal-surface"
            >
              <div class="flex flex-1 items-center gap-3 min-w-0">
                <Favicon {domain} class="w-5 h-5 rounded-sm" />
                <span class="font-bold text-lg">{domain}</span>
              </div>
              <div 
                class="flex items-center gap-4 shrink-0" 
                role="button"
                tabindex="0"
                onclick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const isChecked = (config.config?.update.autoUpdateDomains ?? []).includes(domain)
                  toggleAutoUpdate(domain, !isChecked)
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    const isChecked = (config.config?.update.autoUpdateDomains ?? []).includes(domain)
                    toggleAutoUpdate(domain, !isChecked)
                  }
                }}
              >
                <div class="pointer-events-none flex items-center gap-2 text-sm font-normal opacity-80 hover:opacity-100 cursor-pointer">
                  <span class="hidden sm:inline">{t('settings.update.autoUpdate')}</span>
                  <Switch
                    checked={(config.config?.update.autoUpdateDomains ?? []).includes(domain)}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
              </div>
              <Icon name="chevron" class="transition-transform group-open:rotate-180 ml-4" size={20} />
            </summary>
            <div class="border-t border-surface-200-800">
              {#each group as source (source.id)}
                {@const repoUrl = source.config.url ? gitRepoWebUrl(source.config.url) : null}
                <div
                  class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-surface-200-800 last:border-0"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold">{source.name}</span>
                      <span class="badge preset-tonal">{sourceTypeLabel(source.type)}</span>
                      <span class="badge {statusBadge(source.status)}">
                        {sourceStatusLabel(source.status)}
                      </span>
                    </div>
                    {#if source.config.url}
                      {#if repoUrl}
                        <button
                          class="text-xs opacity-60 hover:underline hover:opacity-100 flex items-center gap-1 cursor-pointer"
                          title={repoUrl}
                          onclick={() => void api.shell?.openExternal(repoUrl)}
                        >
                          {source.config.url}
                          <Icon name="external" size={10} />
                        </button>
                      {:else}
                        <p class="text-xs opacity-60">{source.config.url}</p>
                      {/if}
                    {/if}
                    {#if source.config.localPath}
                      <p class="text-xs opacity-60">{source.config.localPath}</p>
                    {/if}
                    {#if source.lastError}
                      <p class="text-xs text-error-500">{source.lastError}</p>
                    {/if}
                  </div>
                  <div class="flex flex-wrap gap-2 sm:shrink-0 mt-2 sm:mt-0">
                    <button
                      class="btn btn-sm preset-tonal"
                      onclick={() =>
                        toasts.guard(() => sources.refresh(source.id), t('error.sourceRefresh'))}
                    >
                      {t('sources.refresh')}
                    </button>
                    {#if source.config.hiddenSkills && source.config.hiddenSkills.length > 0}
                      <button
                        class="btn btn-sm preset-tonal"
                        onclick={() =>
                          toasts.guard(() => window.api.source.restoreHiddenSkills(source.id), t('common.error'))}
                      >
                        {t('action.restoreHidden')} ({source.config.hiddenSkills.length})
                      </button>
                    {/if}
                    <button
                      class="btn btn-sm preset-tonal"
                      onclick={() =>
                        toasts.guard(
                          () => sources.setEnabled(source.id, !source.enabled),
                          t('error.sourceToggle')
                        )}
                    >
                      {source.enabled ? t('sources.disable') : t('sources.enable')}
                    </button>
                    {#if source.id !== OFFICIAL_SOURCE_ID}
                      <button
                        class="btn btn-sm preset-tonal-error"
                        onclick={() => confirmRemoveSource(source.id, source.name)}
                      >
                        {t('sources.remove')}
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </details>
        </div>
      {/each}
    {/if}
  </div>

  <div class="flex-1 w-full xl:max-w-md shrink-0">
    <AddSourceForm />
  </div>
</div>
