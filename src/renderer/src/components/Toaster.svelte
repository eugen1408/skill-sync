<script lang="ts">
  import { toasts } from '../lib/stores/toasts.svelte'
</script>

{#if toasts.items.length > 0}
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    {#each toasts.items as toast (toast.id)}
      <button
        class="card p-3 text-sm shadow-lg {toast.kind === 'error'
          ? 'preset-filled-error-500'
          : 'preset-filled-surface-500'}"
        onclick={() => toasts.dismiss(toast.id)}
      >
        {toast.message}
      </button>
    {/each}
  </div>
{/if}
