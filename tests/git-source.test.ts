import { describe, it, expect } from 'vitest'
import { parseGitSourceInput } from '../src/shared/domain/gitSource'

describe('parseGitSourceInput', () => {
  it('HTTPS-репозиторий', () => {
    expect(parseGitSourceInput('https://github.com/vercel-labs/agent-skills')).toEqual({
      url: 'https://github.com/vercel-labs/agent-skills',
      ref: null,
      subpath: null,
      authMode: 'https',
      name: 'agent-skills'
    })
  })

  it('HTTPS с .git', () => {
    const p = parseGitSourceInput('https://github.com/o/repo.git')!
    expect(p.url).toBe('https://github.com/o/repo.git')
    expect(p.name).toBe('repo')
    expect(p.authMode).toBe('https')
  })

  it('SSH scp-подобный', () => {
    expect(parseGitSourceInput('git@github.com:vercel-labs/agent-skills.git')).toMatchObject({
      url: 'git@github.com:vercel-labs/agent-skills.git',
      authMode: 'ssh',
      name: 'agent-skills'
    })
  })

  it('GitHub tree-ссылка → ref + subpath', () => {
    expect(parseGitSourceInput('https://github.com/o/repo/tree/main/skills/react')).toEqual({
      url: 'https://github.com/o/repo',
      ref: 'main',
      subpath: 'skills/react',
      authMode: 'https',
      name: 'repo'
    })
  })

  it('GitHub blob-ссылка тоже разбирается', () => {
    const p = parseGitSourceInput('https://github.com/o/repo/blob/dev/a/b')!
    expect(p.ref).toBe('dev')
    expect(p.subpath).toBe('a/b')
  })

  it('GitLab /-/tree/ ссылка', () => {
    const p = parseGitSourceInput('https://gitlab.com/g/repo/-/tree/main/pkg')!
    expect(p.url).toBe('https://gitlab.com/g/repo')
    expect(p.ref).toBe('main')
    expect(p.subpath).toBe('pkg')
  })

  it('shorthand owner/repo → GitHub HTTPS', () => {
    expect(parseGitSourceInput('vercel-labs/agent-skills')).toMatchObject({
      url: 'https://github.com/vercel-labs/agent-skills',
      authMode: 'https',
      name: 'agent-skills'
    })
  })

  it('пустой/мусорный ввод → null', () => {
    expect(parseGitSourceInput('   ')).toBeNull()
    expect(parseGitSourceInput('')).toBeNull()
  })
})
