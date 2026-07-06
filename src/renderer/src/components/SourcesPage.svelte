<script lang="ts">
  import { OFFICIAL_SOURCE_ID } from '@shared/domain/source'
  import { gitRepoWebUrl } from '@shared/domain/gitSource'
  import { api } from '../lib/api'
  import { sources } from '../lib/stores/sources.svelte'
  import { toasts } from '../lib/stores/toasts.svelte'
  import { sourceTypeLabel, sourceStatusLabel } from '../lib/labels'
  import { t } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'
  import AddSourceForm from './AddSourceForm.svelte'

  function statusBadge(status: string): string {
    if (status === 'ok') return 'preset-filled-success-500'
    if (status === 'error') return 'preset-filled-error-500'
    if (status === 'indexing') return 'preset-filled-primary-500'
    return 'preset-tonal'
  }

  function getDomain(source: typeof sources.items[0]): string {
    if (source.type === 'official') return 'skills.sh'
    if (source.type === 'local') return 'local'
    if (!source.config.url) return 'other'

    let domain = 'other'
    const url = source.config.url

    if (url.startsWith('git@')) {
      const match = url.match(/git@([^:]+):/)
      if (match) domain = match[1]
    } else {
      try {
        domain = new URL(url).hostname
      } catch {
        // ignore
      }
    }

    if (domain.startsWith('git.')) {
      domain = domain.substring(4)
    }

    return domain
  }

  const groupedSources = $derived.by(() => {
    const map = new Map<string, typeof sources.items>()
    for (const s of sources.items) {
      const domain = getDomain(s)
      if (!map.has(domain)) map.set(domain, [])
      map.get(domain)!.push(s)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  })
</script>

<div class="grid grid-cols-[1fr_20rem] gap-6">
  <div class="space-y-2">
    {#if sources.items.length === 0}
      <div class="card preset-outlined-surface-200-800 p-8 text-center opacity-70">
        {t('sources.empty')}
      </div>
    {:else}
      {#each groupedSources as [domain, group] (domain)}
        <div class="card preset-outlined-surface-200-800 p-0 overflow-hidden">
          <details class="group" open>
            <summary class="flex items-center justify-between p-4 cursor-pointer hover:preset-tonal-surface">
              <span class="font-bold text-lg">{domain}</span>
              <Icon name="chevron" class="transition-transform group-open:rotate-180" size={20} />
            </summary>
            <div class="border-t border-surface-200-800">
              {#each group as source (source.id)}
                {@const repoUrl = source.config.url ? gitRepoWebUrl(source.config.url) : null}
                <div class="flex items-center gap-3 p-4 border-b border-surface-200-800 last:border-0">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold">{source.name}</span>
                      <span class="badge preset-tonal">{sourceTypeLabel(source.type)}</span>
                      <span class="badge {statusBadge(source.status)}">
                        {sourceStatusLabel(source.status)}
                      </span>
                    </div>
                    {#if source.config.url}
                      <p class="text-xs opacity-60">{source.config.url}</p>
                    {/if}
                    {#if source.config.localPath}
                      <p class="text-xs opacity-60">{source.config.localPath}</p>
                    {/if}
                    {#if source.lastError}
                      <p class="text-xs text-error-500">{source.lastError}</p>
                    {/if}
                  </div>
                  <div class="flex gap-2">
                    {#if repoUrl}
                      <button
                        class="btn btn-sm preset-tonal gap-1"
                        title={repoUrl}
                        onclick={() => void api.shell?.openExternal(repoUrl)}
                      >
                        <Icon name="external" size={14} />
                        {t('sources.openRepo')}
                      </button>
                    {/if}
                    <button
                      class="btn btn-sm preset-tonal"
                      onclick={() =>
                        toasts.guard(() => sources.refresh(source.id), t('error.sourceRefresh'))}
                    >
                      {t('sources.refresh')}
                    </button>
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
                        class="btn btn-sm preset-tonal"
                        onclick={() =>
                          toasts.guard(() => sources.remove(source.id), t('error.sourceRemove'))}
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

  <AddSourceForm />
</div>
