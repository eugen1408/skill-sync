<script lang="ts">
  import { t } from '../lib/i18n.svelte'

  // Оверлей первого запуска. Родитель показывает его при !ui.onboardingDismissed.
  interface Props {
    onDismiss: () => void
    onOpenGuide: () => void
  }
  const { onDismiss, onOpenGuide }: Props = $props()

  const steps: Array<{ title: Parameters<typeof t>[0]; body: Parameters<typeof t>[0] }> = [
    { title: 'onboarding.step.source.title', body: 'onboarding.step.source.body' },
    { title: 'onboarding.step.catalog.title', body: 'onboarding.step.catalog.body' },
    { title: 'onboarding.step.install.title', body: 'onboarding.step.install.body' },
    { title: 'onboarding.step.agents.title', body: 'onboarding.step.agents.body' }
  ]
</script>

<div class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
  <div
    class="card preset-filled-surface-100-900 max-h-full w-full max-w-lg space-y-4 overflow-auto p-6 shadow-xl"
  >
    <div>
      <h2 class="h4">{t('onboarding.title')}</h2>
      <p class="text-sm opacity-70">{t('onboarding.intro')}</p>
    </div>

    <ol class="space-y-2">
      {#each steps as step (step.title)}
        <li>
          <p class="text-sm font-medium">{t(step.title)}</p>
          <p class="text-sm opacity-70">{t(step.body)}</p>
        </li>
      {/each}
    </ol>

    <div class="space-y-1">
      <p class="text-sm font-medium">{t('onboarding.fileModel.title')}</p>
      <pre
        class="overflow-x-auto rounded bg-surface-200-800 p-3 text-xs leading-relaxed">{t(
          'onboarding.fileModel.body'
        )}</pre>
    </div>

    <div class="flex justify-end gap-2">
      <button class="btn btn-sm preset-tonal" onclick={onOpenGuide}>
        {t('onboarding.openGuide')}
      </button>
      <button class="btn btn-sm preset-filled-primary-500" onclick={onDismiss}>
        {t('onboarding.dismiss')}
      </button>
    </div>
  </div>
</div>
