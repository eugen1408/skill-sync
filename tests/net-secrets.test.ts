import { describe, it, expect, afterEach } from 'vitest'
import { applyProxy } from '../src/main/net/proxy'
import { applyGithubTokenEnv, GITHUB_TOKEN_KEY } from '../src/main/secrets/env'

const PROXY_KEYS = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy']

afterEach(() => {
  applyProxy(null)
  applyGithubTokenEnv(null)
})

describe('applyProxy', () => {
  it('выставляет и снимает переменные окружения прокси', () => {
    applyProxy('http://proxy.local:8080')
    for (const key of PROXY_KEYS) expect(process.env[key]).toBe('http://proxy.local:8080')

    applyProxy(null)
    for (const key of PROXY_KEYS) expect(process.env[key]).toBeUndefined()
  })

  it('пустую строку трактует как отсутствие прокси', () => {
    applyProxy('   ')
    expect(process.env.HTTPS_PROXY).toBeUndefined()
  })
})

describe('applyGithubTokenEnv', () => {
  it('устанавливает и очищает GITHUB_TOKEN/GH_TOKEN', () => {
    applyGithubTokenEnv('ghp_test')
    expect(process.env.GITHUB_TOKEN).toBe('ghp_test')
    expect(process.env.GH_TOKEN).toBe('ghp_test')

    applyGithubTokenEnv(null)
    expect(process.env.GITHUB_TOKEN).toBeUndefined()
    expect(process.env.GH_TOKEN).toBeUndefined()
  })

  it('экспортирует стабильный ключ', () => {
    expect(GITHUB_TOKEN_KEY).toBe('githubToken')
  })
})
