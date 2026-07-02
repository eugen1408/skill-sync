import { describe, it, expect, vi } from 'vitest'
import { buildLockAttribution, type RepoClassifier } from '../src/main/registry/lockAttribution'
import type { LockEntry } from '../src/main/version'

function ghEntry(source: string, skillPath = 'SKILL.md'): LockEntry {
  return {
    source,
    sourceType: 'github',
    sourceUrl: `https://github.com/${source}.git`,
    skillPath
  }
}

const yes: RepoClassifier = async () => true
const no: RepoClassifier = async () => false
const offline: RepoClassifier = async () => null

describe('buildLockAttribution', () => {
  it('github-репозиторий из skills.sh → official, без git-источника', async () => {
    const lock = { analyst: ghEntry('eugen1408/analyst') }
    const { sourcesToEnsure, attribution } = await buildLockAttribution(lock, yes)
    expect(sourcesToEnsure).toHaveLength(0)
    expect(attribution.get('analyst')).toEqual({
      sourceKind: 'official',
      sourceUrl: null,
      sourceRef: 'eugen1408/analyst@analyst'
    })
  })

  it('github-репозиторий не из skills.sh → custom git', async () => {
    const lock = { analyst: ghEntry('eugen1408/analyst', 'skills/analyst/SKILL.md') }
    const { sourcesToEnsure, attribution } = await buildLockAttribution(lock, no)
    expect(sourcesToEnsure).toEqual([
      {
        url: 'https://github.com/eugen1408/analyst.git',
        ref: null,
        authMode: 'https',
        name: 'analyst'
      }
    ])
    expect(attribution.get('analyst')).toEqual({
      sourceKind: 'git',
      sourceUrl: 'https://github.com/eugen1408/analyst.git',
      sourceRef: 'skills/analyst'
    })
  })

  it('недоступность skills.sh (null) → official (оптимистично, Q8-02)', async () => {
    const { attribution } = await buildLockAttribution({ analyst: ghEntry('o/r') }, offline)
    expect(attribution.get('analyst')?.sourceKind).toBe('official')
  })

  it('SSH-URL → custom git без обращения к skills.sh', async () => {
    const classifier = vi.fn(no)
    const lock: Record<string, LockEntry> = {
      pybotx: {
        source: 'git@gitlab.rt-dc.ru:clouds/llm-skill-pybotx.git',
        sourceType: 'git',
        sourceUrl: 'git@gitlab.rt-dc.ru:clouds/llm-skill-pybotx.git',
        skillPath: 'SKILL.md'
      }
    }
    const { sourcesToEnsure, attribution } = await buildLockAttribution(lock, classifier)
    expect(classifier).not.toHaveBeenCalled()
    expect(sourcesToEnsure[0].authMode).toBe('ssh')
    expect(attribution.get('pybotx')?.sourceKind).toBe('git')
  })

  it('не-github хост → custom git', async () => {
    const lock: Record<string, LockEntry> = {
      sdd: {
        source: 'https://gitlab.com/g/agent-skills',
        sourceType: 'github',
        sourceUrl: 'https://gitlab.com/g/agent-skills.git',
        skillPath: '.agents/skills/sdd/SKILL.md'
      }
    }
    const { attribution } = await buildLockAttribution(lock, no)
    expect(attribution.get('sdd')?.sourceKind).toBe('git')
    expect(attribution.get('sdd')?.sourceRef).toBe('.agents/skills/sdd')
  })

  it('несколько skills одного репозитория → один источник, одна классификация', async () => {
    const classifier = vi.fn(no)
    const lock = {
      'skill-creator': ghEntry('anthropics/skills', 'skills/skill-creator/SKILL.md'),
      pptx: ghEntry('anthropics/skills', 'skills/pptx/SKILL.md')
    }
    const { sourcesToEnsure, attribution } = await buildLockAttribution(lock, classifier)
    expect(sourcesToEnsure).toHaveLength(1)
    expect(classifier).toHaveBeenCalledTimes(1)
    expect(attribution.get('skill-creator')?.sourceRef).toBe('skills/skill-creator')
    expect(attribution.get('pptx')?.sourceRef).toBe('skills/pptx')
  })

  it('классификатор вызывается с (owner/repo, именем skill), не с owner/repo дважды', async () => {
    const classifier = vi.fn(yes)
    await buildLockAttribution({ 'find-skills': ghEntry('vercel-labs/skills') }, classifier)
    expect(classifier).toHaveBeenCalledWith('vercel-labs/skills', 'find-skills')
  })

  it('ssh git-источник добавляется даже рядом с github-записью из skills.sh', async () => {
    const lock: Record<string, LockEntry> = {
      'find-skills': ghEntry('vercel-labs/skills'),
      pybotx: {
        source: 'git@gitlab.rt-dc.ru:clouds/llm-skill-pybotx.git',
        sourceType: 'git',
        sourceUrl: 'git@gitlab.rt-dc.ru:clouds/llm-skill-pybotx.git',
        skillPath: 'SKILL.md'
      }
    }
    const { sourcesToEnsure, attribution } = await buildLockAttribution(lock, yes)
    expect(sourcesToEnsure.map((s) => s.name)).toEqual(['llm-skill-pybotx'])
    expect(attribution.get('find-skills')?.sourceKind).toBe('official')
    expect(attribution.get('pybotx')?.sourceKind).toBe('git')
  })

  it('запись без sourceUrl или sourceType=local → не атрибутируется (останется local)', async () => {
    const lock: Record<string, LockEntry> = {
      broken: { source: 'x/y', sourceType: 'github' },
      localOne: { source: '/path', sourceType: 'local', sourceUrl: '/path' }
    }
    const { sourcesToEnsure, attribution } = await buildLockAttribution(lock, yes)
    expect(sourcesToEnsure).toHaveLength(0)
    expect(attribution.size).toBe(0)
  })
})
