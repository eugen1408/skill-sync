<script lang="ts">
  import Icon from './Icon.svelte'

  interface Option {
    value: string
    label: string
    checked: boolean
  }
  interface Props {
    label: string
    options: Option[]
    onToggle: (value: string) => void
  }
  const { label, options, onToggle }: Props = $props()

  let open = $state(false)
  let root = $state<HTMLElement | null>(null)
  const activeCount = $derived(options.filter((o) => o.checked).length)

  // Клик вне меню — закрыть (подписываемся только пока открыто).
  $effect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (root && !root.contains(e.target as Node)) open = false
    }
    window.addEventListener('mousedown', onDoc)
    return () => window.removeEventListener('mousedown', onDoc)
  })
</script>

<div class="relative" bind:this={root}>
  <button
    class="btn btn-sm gap-1 {activeCount > 0 ? 'preset-filled-primary-500' : 'preset-tonal'}"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <span>{label}</span>
    {#if activeCount > 0}
      <span
        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-50-950/30 px-1 text-xs"
      >
        {activeCount}
      </span>
    {/if}
    <Icon name="chevron" size={14} class={open ? '' : ''} />
  </button>
  {#if open}
    <div
      class="absolute mt-1 min-w-52 rounded border border-surface-200-800 bg-surface-100-900 p-1 shadow-xl"
      style="z-index: 999;"
    >
      {#if options.length === 0}
        <p class="px-2 py-1 text-sm opacity-50">—</p>
      {:else}
        {#each options as opt (opt.value)}
          <label
            class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface-200-800"
          >
            <input
              type="checkbox"
              class="checkbox"
              checked={opt.checked}
              onchange={() => onToggle(opt.value)}
            />
            <span class="truncate text-sm">{opt.label}</span>
          </label>
        {/each}
      {/if}
    </div>
  {/if}
</div>
