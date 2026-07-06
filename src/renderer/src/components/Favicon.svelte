<script lang="ts">
  let { domain, class: className = '' } = $props<{ domain: string; class?: string }>()

  let loaded = $state(false)
  let error = $state(false)

  function checkCache(node: HTMLImageElement, currentDomain: string) {
    const check = () => {
      // Сбрасываем стейт при смене домена внутри экшена (до загрузки)
      if (node.getAttribute('data-domain') !== currentDomain) {
        loaded = false
        error = false
        node.setAttribute('data-domain', currentDomain)
      }
      if (node.complete && node.naturalWidth > 0) {
        loaded = true
      }
    }
    check()
    return { update: check }
  }
</script>

{#if !error && domain !== 'local' && domain !== 'other'}
  {#key domain}
    <img
      use:checkCache={domain}
      src={`https://${domain}/favicon.ico`}
      alt=""
      class="{className} {loaded ? 'inline-block' : 'hidden'}"
      onload={() => (loaded = true)}
      onerror={() => {
        if (!loaded) error = true
      }}
    />
  {/key}
{/if}
