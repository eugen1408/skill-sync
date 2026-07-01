<script lang="ts">
  import type { SourceType, GitAuthMode } from '@shared/domain/source'
  import { sources } from '../lib/stores/sources.svelte'

  let type = $state<SourceType>('git')
  let name = $state('')
  let url = $state('')
  let ref = $state('')
  let subpath = $state('')
  let authMode = $state<GitAuthMode>('https')
  let localPath = $state('')
  let error = $state<string | null>(null)
  let busy = $state(false)

  async function submit(e: Event): Promise<void> {
    e.preventDefault()
    error = null
    busy = true
    try {
      await sources.add({
        type,
        name,
        config: {
          url: type === 'local' ? null : url || null,
          ref: ref || null,
          subpath: subpath || null,
          authMode: type === 'git' ? authMode : null,
          localPath: type === 'local' ? localPath || null : null,
          watch: type === 'local'
        }
      })
      name = url = ref = subpath = localPath = ''
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<form class="card preset-outlined-surface-200-800 space-y-3 p-4" onsubmit={submit}>
  <p class="font-semibold">Добавить источник</p>

  <div class="flex gap-2">
    {#each ['official', 'git', 'local'] as const as t (t)}
      <button
        type="button"
        class="btn btn-sm {type === t ? 'preset-filled-primary-500' : 'preset-tonal'}"
        onclick={() => (type = t)}
      >
        {t === 'official' ? 'skills.sh' : t === 'git' ? 'Git' : 'Локальный'}
      </button>
    {/each}
  </div>

  <input class="input" placeholder="Название (необязательно)" bind:value={name} />

  {#if type === 'git'}
    <input class="input" placeholder="URL репозитория" bind:value={url} required />
    <div class="flex gap-2">
      <input class="input" placeholder="ref (branch/tag)" bind:value={ref} />
      <input class="input" placeholder="subpath" bind:value={subpath} />
    </div>
    <select class="select" bind:value={authMode}>
      <option value="https">HTTPS</option>
      <option value="ssh">SSH</option>
      <option value="none">Без авторизации</option>
    </select>
  {:else if type === 'local'}
    <input class="input" placeholder="Путь к каталогу" bind:value={localPath} required />
  {:else}
    <input
      class="input"
      placeholder="Базовый URL (по умолчанию https://skills.sh)"
      bind:value={url}
    />
  {/if}

  {#if error}
    <p class="text-sm text-error-500">{error}</p>
  {/if}

  <button type="submit" class="btn preset-filled-primary-500" disabled={busy}>
    {busy ? 'Добавление…' : 'Добавить'}
  </button>
</form>
