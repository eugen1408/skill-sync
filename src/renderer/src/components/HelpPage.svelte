<script lang="ts">
  import { onMount } from 'svelte'
  import { t, i18n } from '../lib/i18n.svelte'
  import { api } from '../lib/api'

  // Раздел «Помощь»: онбординг-шаги, глоссарий и текстовая схема модели файлов.
  const steps: Array<{ title: Parameters<typeof t>[0]; body: Parameters<typeof t>[0] }> = [
    { title: 'onboarding.step.source.title', body: 'onboarding.step.source.body' },
    { title: 'onboarding.step.catalog.title', body: 'onboarding.step.catalog.body' },
    { title: 'onboarding.step.install.title', body: 'onboarding.step.install.body' },
    { title: 'onboarding.step.agents.title', body: 'onboarding.step.agents.body' }
  ]

  const terms: Array<{ title: Parameters<typeof t>[0]; body: Parameters<typeof t>[0] }> = [
    { title: 'help.term.source.title', body: 'help.term.source.body' },
    { title: 'help.term.installed.title', body: 'help.term.installed.body' },
    { title: 'help.term.canonical.title', body: 'help.term.canonical.body' },
    { title: 'help.term.symlink.title', body: 'help.term.symlink.body' },
    { title: 'help.term.agent.title', body: 'help.term.agent.body' }
  ]

  let appVersion = $state<string>('0.0.0')

  onMount(() => {
    api.app.getVersion().then((v) => (appVersion = v))
  })
</script>

<div class="mx-auto max-w-2xl space-y-6">
  <h2 class="h4">{t('help.title')}</h2>

  <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
    <h3 class="h5">{t('help.gettingStartedTitle')}</h3>
    <ol class="space-y-2">
      {#each steps as step (step.title)}
        <li>
          <p class="text-sm font-medium">{t(step.title)}</p>
          <p class="text-sm opacity-70">{t(step.body)}</p>
        </li>
      {/each}
    </ol>
  </section>

  <section class="card preset-outlined-surface-200-800 space-y-2 p-4">
    <h3 class="h5">{t('help.fileModelTitle')}</h3>
    <pre
      class="overflow-x-auto rounded bg-surface-100-900 p-3 text-xs leading-relaxed">{t(
        'onboarding.fileModel.body'
      )}</pre>
  </section>

  <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
    <h3 class="h5">{t('help.glossaryTitle')}</h3>
    <dl class="space-y-2">
      {#each terms as term (term.title)}
        <div>
          <dt class="text-sm font-medium">{t(term.title)}</dt>
          <dd class="text-sm opacity-70">{t(term.body)}</dd>
        </div>
      {/each}
    </dl>
  </section>

  <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
    <h3 class="h5">{t('help.changelogTitle' as any)}</h3>
    <p class="text-sm">
      <a
        href={`https://github.com/eugen1408/skill-sync/blob/v${appVersion}/CHANGELOG${i18n.locale === 'ru' ? '.ru' : ''}.md`}
        target="_blank"
        rel="noreferrer"
        class="text-primary-500 hover:underline"
      >
        v{appVersion}
      </a>
    </p>
  </section>

  <section class="card preset-outlined-surface-200-800 space-y-3 p-4">
    <h3 class="h5">{t('help.supportTitle' as any)}</h3>
    <ul class="space-y-2 text-sm">
      <li>
        <a
          href="https://github.com/eugen1408/skill-sync/issues"
          target="_blank"
          rel="noreferrer"
          class="text-primary-500 hover:underline"
        >
          {t('help.supportBug' as any)}
        </a>
      </li>
      <li>
        <a
          href="https://github.com/eugen1408/skill-sync/discussions/categories/ideas"
          target="_blank"
          rel="noreferrer"
          class="text-primary-500 hover:underline"
        >
          {t('help.supportIdea' as any)}
        </a>
      </li>
    </ul>
  </section>
</div>
