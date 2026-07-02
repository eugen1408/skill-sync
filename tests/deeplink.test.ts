import { describe, it, expect } from 'vitest'
import { parseDeeplink } from '../src/main/deeplink'

describe('parseDeeplink', () => {
  it('skill://github.com/owner/repo → HTTPS-источник', () => {
    expect(parseDeeplink('skill://github.com/vercel-labs/agent-skills')).toMatchObject({
      url: 'https://github.com/vercel-labs/agent-skills',
      authMode: 'https',
      name: 'agent-skills'
    })
  })

  it('skill://git@host:owner/repo.git → SSH-источник', () => {
    expect(parseDeeplink('skill://git@github.com:vercel-labs/agent-skills.git')).toMatchObject({
      url: 'git@github.com:vercel-labs/agent-skills.git',
      authMode: 'ssh',
      name: 'agent-skills'
    })
  })

  it('обрезает хвостовые слэши от OS-обработчиков', () => {
    expect(parseDeeplink('skill://github.com/o/repo/')).toMatchObject({
      url: 'https://github.com/o/repo',
      name: 'repo'
    })
  })

  it('shorthand owner/repo (без хоста) остаётся shorthand → GitHub HTTPS', () => {
    expect(parseDeeplink('skill://vercel-labs/agent-skills')).toMatchObject({
      url: 'https://github.com/vercel-labs/agent-skills',
      authMode: 'https'
    })
  })

  it('точка в имени репозитория не путается с хостом', () => {
    // Первый сегмент `owner` без точки → не хост; https:// не достраивается,
    // shorthand `owner/repo.js` разбирается parseGitSourceInput.
    expect(parseDeeplink('skill://owner/repo.js')).toMatchObject({
      url: 'https://github.com/owner/repo.js',
      authMode: 'https'
    })
  })

  it('явный https в payload сохраняется', () => {
    expect(parseDeeplink('skill://https://gitlab.com/g/repo')).toMatchObject({
      url: 'https://gitlab.com/g/repo',
      authMode: 'https'
    })
  })

  it('не-skill:// схема → null', () => {
    expect(parseDeeplink('https://github.com/o/repo')).toBeNull()
  })

  it('пустой payload → null', () => {
    expect(parseDeeplink('skill://')).toBeNull()
  })
})
