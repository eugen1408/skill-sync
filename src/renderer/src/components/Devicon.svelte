<script lang="ts">
  import { getIconForSkill } from '../lib/deviconMatcher'

  let { skillId, description, class: className = '' } = $props<{
    skillId: string
    description?: string | null
    class?: string
  }>()

  // Реактивно вычисляем имя иконки. Если нет — возвращаем null.
  let iconName = $derived(getIconForSkill(skillId, description))

  let suffix = $derived.by(() => {
    if (!iconName) return ''
    const lineOnly = ['detaspace', 'dot', 'tomcat']
    if (lineOnly.includes(iconName)) return 'line'

    const originalOnly = [
      'algolia', 'blender', 'codeac', 'contao', 'electron', 'emacs',
      'express', 'feathersjs', 'fortran', 'ghost', 'ionic', 'mongoose',
      'nuget', 'purescript', 'reactnative', 'ros', 'shopware', 'stylus',
      'tensorflow', 'threejs', 'unix', 'webflow'
    ]
    if (originalOnly.includes(iconName)) return 'original'

    return 'plain'
  })
</script>

{#if iconName}
  <i class="devicon-{iconName}-{suffix} colored {className}"></i>
{/if}
