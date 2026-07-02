<script lang="ts">
  import type { SourceType, GitAuthMode } from '@shared/domain/source'
  import { SOURCE_TYPES, sourceTypeDef } from '../lib/sourceForms'
  import { api } from '../lib/api'
  import { sources } from '../lib/stores/sources.svelte'

  let type = $state<SourceType>('git')
  let name = $state('')
  let values = $state<Record<string, string>>({})
  let error = $state<string | null>(null)
  let busy = $state(false)

  const def = $derived(sourceTypeDef(type))

  async function pickDirectory(key: string): Promise<void> {
    const dir = await api.dialog.selectDirectory()
    if (dir) values[key] = dir
  }

  async function submit(e: Event): Promise<void> {
    e.preventDefault()
    error = null
    busy = true
    try {
      await sources.add({
        type,
        name,
        config: {
          url: type === 'local' ? null : values.url || null,
          ref: values.ref || null,
          subpath: values.subpath || null,
          authMode: type === 'git' ? (values.authMode as GitAuthMode) || 'https' : null,
          localPath: type === 'local' ? values.localPath || null : null,
          watch: def.watch ?? false
        }
      })
      name = ''
      values = {}
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
    {#each SOURCE_TYPES as t (t.type)}
      <button
        type="button"
        class="btn btn-sm {type === t.type ? 'preset-filled-primary-500' : 'preset-tonal'}"
        onclick={() => (type = t.type)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <input class="input" placeholder="Название (необязательно)" bind:value={name} />

  {#each def.fields as field (field.key)}
    {#if field.control === 'select'}
      <select
        class="select"
        value={values[field.key] ?? field.default ?? ''}
        onchange={(e) => (values[field.key] = e.currentTarget.value)}
      >
        {#each field.options ?? [] as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    {:else if field.picker === 'directory'}
      <div class="flex gap-2">
        <input
          class="input flex-1"
          placeholder={field.placeholder}
          required={field.required}
          value={values[field.key] ?? ''}
          oninput={(e) => (values[field.key] = e.currentTarget.value)}
        />
        <button
          type="button"
          class="btn btn-sm preset-tonal"
          onclick={() => pickDirectory(field.key)}
        >
          Обзор…
        </button>
      </div>
    {:else}
      <input
        class="input"
        placeholder={field.placeholder}
        required={field.required}
        value={values[field.key] ?? ''}
        oninput={(e) => (values[field.key] = e.currentTarget.value)}
      />
    {/if}
  {/each}

  {#if error}
    <p class="text-sm text-error-500">{error}</p>
  {/if}

  <button type="submit" class="btn preset-filled-primary-500" disabled={busy}>
    {busy ? 'Добавление…' : 'Добавить'}
  </button>
</form>
