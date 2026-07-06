<script lang="ts">
  import { getIconForSkill } from '../lib/deviconMatcher'

  let { skillId, description, class: className = '' } = $props<{
    skillId: string
    description?: string | null
    class?: string
  }>()

  // Реактивно вычисляем имя иконки. Если нет — возвращаем null.
  let iconName = $derived(getIconForSkill(skillId, description))
</script>

{#if iconName}
  <i class="devicon-{iconName}-plain colored {className}"></i>
{/if}
