<script lang="ts">
  let { domain, class: className = '' } = $props<{ domain: string; class?: string }>()

  let loaded = $state(false)
  let error = $state(false)
  let imgEl: HTMLImageElement | undefined = $state()

  // Сбрасываем состояние при смене домена
  $effect(() => {
    void domain
    loaded = false
    error = false
  })

  // Обработка кэшированных изображений, которые загружаются мгновенно
  $effect(() => {
    if (imgEl?.complete) {
      if (imgEl.naturalWidth > 0) loaded = true
      else error = true
    }
  })
</script>

{#if !error && domain !== 'local' && domain !== 'other'}
  <img
    bind:this={imgEl}
    src={`https://${domain}/favicon.ico`}
    alt=""
    class={className}
    style="display: {loaded ? 'inline-block' : 'none'};"
    onload={() => (loaded = true)}
    onerror={() => (error = true)}
  />
{/if}
