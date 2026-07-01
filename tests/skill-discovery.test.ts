import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverSkills, parseFrontmatter } from '../src/main/sources/skillDiscovery'

describe('parseFrontmatter', () => {
  it('извлекает name и description', () => {
    const md = [
      '---',
      'name: My Skill',
      'description: "Делает штуки"',
      'other: x',
      '---',
      '# Тело'
    ].join('\n')
    expect(parseFrontmatter(md)).toEqual({ name: 'My Skill', description: 'Делает штуки' })
  })

  it('возвращает null-поля без frontmatter', () => {
    expect(parseFrontmatter('# Просто заголовок')).toEqual({ name: null, description: null })
  })
})

describe('discoverSkills', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'skillsync-disc-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('находит SKILL.md во вложенных папках и берёт имя из frontmatter/имени папки', async () => {
    mkdirSync(join(dir, 'skills', 'alpha'), { recursive: true })
    writeFileSync(
      join(dir, 'skills', 'alpha', 'SKILL.md'),
      '---\nname: Alpha\ndescription: A\n---\n'
    )
    mkdirSync(join(dir, 'skills', 'beta'), { recursive: true })
    writeFileSync(join(dir, 'skills', 'beta', 'SKILL.md'), '# no frontmatter')
    mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'pkg', 'SKILL.md'), '---\nname: Ignored\n---\n')

    const skills = await discoverSkills(dir)
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]))
    expect(skills).toHaveLength(2) // node_modules пропущен
    expect(byName['Alpha'].sourceRef).toBe('skills/alpha')
    expect(byName['Alpha'].description).toBe('A')
    expect(byName['beta'].description).toBeNull() // имя из папки
  })
})
