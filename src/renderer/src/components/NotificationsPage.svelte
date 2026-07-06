<script lang="ts">
  import { notifications } from '../lib/stores/notifications.svelte'
  import { notificationTypeLabel, formatTime } from '../lib/labels'
  import { t } from '../lib/i18n.svelte'

  function badge(type: string): string {
    if (type === 'install_error' || type === 'update_error' || type === 'source_unavailable')
      return 'preset-filled-error-500'
    if (type === 'update_success') return 'preset-filled-success-500'
    return 'preset-filled-primary-500'
  }
</script>

<div class="space-y-4">
  <div class="flex items-center gap-2">
    <h2 class="h4 flex-1">{t('notifications.title')}</h2>
    <button class="btn btn-sm preset-tonal" onclick={() => notifications.markAllRead()}>
      {t('notifications.markAllRead')}
    </button>
    <button class="btn btn-sm preset-tonal" onclick={() => notifications.clear()}
      >{t('notifications.clear')}</button
    >
  </div>

  {#if notifications.items.length === 0}
    <div class="card preset-outlined-surface-200-800 p-8 text-center opacity-70">
      {t('notifications.empty')}
    </div>
  {:else}
    <div class="space-y-2">
      {#each notifications.items as n (n.id)}
        <div
          class="card preset-outlined-surface-200-800 flex items-start gap-3 p-3 {n.read
            ? 'opacity-60'
            : ''}"
        >
          <span class="badge {badge(n.type)}">{notificationTypeLabel(n.type)}</span>
          <div class="flex-1">
            <p class="font-medium">{n.title}</p>
            <p class="text-sm opacity-80">{n.message}</p>
          </div>
          <span class="text-xs opacity-50">{formatTime(n.createdAt)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
