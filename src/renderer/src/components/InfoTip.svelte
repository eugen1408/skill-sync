<script lang="ts">
  import Icon from './Icon.svelte'

  // Лёгкий поповер-подсказка (follow-up: контекстные пояснения для новичков).
  // Основан на <details>/<summary>: нативное открытие/закрытие, доступность без своего JS.
  interface Props {
    /** Заголовок подсказки (опционально). */
    title?: string
    /** Текст подсказки; поддерживает переносы строк (glossary). */
    body: string
    /** Размер иконки. */
    size?: number
    /** Выравнивание выпадающего окна. */
    align?: 'left' | 'right'
  }
  const { title, body, size = 14, align = 'left' }: Props = $props()
</script>

<details class="relative inline-block align-middle">
  <summary
    class="inline-flex cursor-pointer list-none opacity-50 hover:opacity-100 [&::-webkit-details-marker]:hidden"
    aria-label={title ?? body}
  >
    <Icon name="info" {size} />
  </summary>
  <div
    class="absolute {align === 'right' ? 'right-0' : 'left-0'} z-50 mt-1 w-72 rounded border border-surface-200-800 bg-surface-50-950 p-3 text-left text-xs shadow-lg"
  >
    {#if title}
      <div class="mb-1 font-semibold">{title}</div>
    {/if}
    <div class="whitespace-pre-line opacity-80">{body}</div>
  </div>
</details>
