<script lang="ts">
  import { parseGitSourceInput, type ParsedGitSource } from '@shared/domain/gitSource'
  import { api } from '../lib/api'
  import { sources } from '../lib/stores/sources.svelte'
  import { t } from '../lib/i18n.svelte'
  import InfoTip from './InfoTip.svelte'

  let type = $state<'git' | 'local'>('git')
  let gitInput = $state('')
  let localPath = $state('')
  let error = $state<string | null>(null)
  let busy = $state(false)

  const parsed = $derived<ParsedGitSource | null>(
    gitInput.trim() ? parseGitSourceInput(gitInput) : null
  )
  const localName = $derived(
    localPath
      ? (localPath
          .replace(/[/\\]+$/, '')
          .split(/[/\\]/)
          .pop() ?? '')
      : ''
  )

  async function pickFolder(): Promise<void> {
    const dir = await api.dialog.selectDirectory()
    if (dir) localPath = dir
  }

  async function submit(e: Event): Promise<void> {
    e.preventDefault()
    error = null
    busy = true
    try {
      if (type === 'git') {
        if (!parsed) throw new Error(t('addSource.parseErrorThrow'))
        await sources.add({
          type: 'git',
          name: parsed.name,
          config: {
            url: parsed.url,
            ref: parsed.ref,
            subpath: parsed.subpath,
            authMode: parsed.authMode,
            localPath: null,
            watch: false
          }
        })
        gitInput = ''
      } else {
        if (!localPath) throw new Error(t('addSource.selectFolder'))
        await sources.add({
          type: 'local',
          name: localName,
          config: {
            url: null,
            ref: null,
            subpath: null,
            authMode: null,
            localPath,
            watch: true
          }
        })
        localPath = ''
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<form class="card preset-outlined-surface-200-800 space-y-3 p-4" onsubmit={submit}>
  <p class="flex items-center gap-1.5 font-semibold">
    {t('addSource.title')}
    <InfoTip title={t('help.term.source.title')} body={t('help.term.source.body')} />
  </p>

  <div class="flex gap-2">
    <button
      type="button"
      class="btn btn-sm {type === 'git' ? 'preset-filled-primary-500' : 'preset-tonal'}"
      onclick={() => (type = 'git')}
    >
      {t('addSource.git')}
    </button>
    <button
      type="button"
      class="btn btn-sm {type === 'local' ? 'preset-filled-primary-500' : 'preset-tonal'}"
      onclick={() => (type = 'local')}
    >
      {t('addSource.local')}
    </button>
  </div>

  {#if type === 'git'}
    <input
      class="input"
      placeholder={t('addSource.gitPlaceholder')}
      bind:value={gitInput}
      required
    />
    {#if parsed}
      <dl class="space-y-1 rounded bg-surface-100-900 p-2 text-xs">
        <div class="flex justify-between gap-2">
          <dt class="opacity-60">{t('addSource.name')}</dt>
          <dd class="truncate font-medium">{parsed.name}</dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="opacity-60">{t('addSource.url')}</dt>
          <dd class="truncate">{parsed.url}</dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="opacity-60">{t('addSource.auth')}</dt>
          <dd>{parsed.authMode === 'ssh' ? 'SSH' : 'HTTPS'}</dd>
        </div>
        {#if parsed.ref}
          <div class="flex justify-between gap-2">
            <dt class="opacity-60">{t('addSource.ref')}</dt>
            <dd>{parsed.ref}</dd>
          </div>
        {/if}
        {#if parsed.subpath}
          <div class="flex justify-between gap-2">
            <dt class="opacity-60">{t('addSource.subpath')}</dt>
            <dd class="truncate">{parsed.subpath}</dd>
          </div>
        {/if}
      </dl>
    {:else if gitInput.trim()}
      <p class="text-xs text-error-500">{t('addSource.parseError')}</p>
    {/if}
  {:else}
    <div class="flex gap-2">
      <input
        class="input flex-1"
        placeholder={t('addSource.noFolder')}
        value={localPath}
        readonly
      />
      <button type="button" class="btn btn-sm preset-tonal" onclick={pickFolder}
        >{t('addSource.browse')}</button
      >
    </div>
    {#if localName}
      <p class="text-xs opacity-60">
        {t('addSource.nameLabel')} <span class="font-medium">{localName}</span>
      </p>
    {/if}
  {/if}

  {#if error}
    <p class="text-sm text-error-500">{error}</p>
  {/if}

  <button
    type="submit"
    class="btn preset-filled-primary-500"
    disabled={busy || (type === 'git' ? !parsed : !localPath)}
  >
    {busy ? t('addSource.adding') : t('addSource.add')}
  </button>
</form>
