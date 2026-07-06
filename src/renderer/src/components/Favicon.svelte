<script lang="ts">
  let { domain, class: className = '' } = $props<{ domain: string; class?: string }>()

  let loaded = $state(false)
  let error = $state(false)

  // Сбрасываем состояние при смене домена
  $effect(() => {
    void domain
    loaded = false
    error = false
  })
</script>

{#if !error && domain !== 'local' && domain !== 'other'}
  <img
    src={`https://${domain}/favicon.ico`}
    alt=""
    class="{className} {loaded ? 'inline-block' : 'hidden'}"
    onload={() => (loaded = true)}
    onerror={() => (error = true)}
  />
{/if}
