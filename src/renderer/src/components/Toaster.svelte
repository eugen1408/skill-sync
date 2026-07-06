<script lang="ts">
  import { toasts } from '../lib/stores/toasts.svelte'
</script>

{#if toasts.items.length > 0}
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    {#each toasts.items as toast (toast.id)}
      <button
        class="card p-3 text-sm shadow-lg text-left {toast.kind === 'error'
          ? 'preset-filled-error-500'
          : toast.kind === 'success'
            ? 'preset-filled-success-500'
            : 'preset-filled-surface-500'}"
        title={toast.kind === 'error' ? 'Click to copy error' : undefined}
        onclick={() => {
          if (toast.kind === 'error') {
            void navigator.clipboard.writeText(toast.message)
          }
          toasts.dismiss(toast.id)
        }}
      >
        {toast.message}
      </button>
    {/each}
  </div>
{/if}
