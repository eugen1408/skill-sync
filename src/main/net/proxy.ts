import { setGlobalDispatcher, ProxyAgent, Agent } from 'undici'
import { logger } from '../logger'

const PROXY_ENV_KEYS = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'] as const

/**
 * Применяет настройку прокси процессно (эпик Q-04):
 * - глобальный undici-dispatcher — для `fetch` (GitHub API, skills.sh);
 * - переменные окружения — наследуются дочерними процессами (git, npx skills).
 * Идемпотентно; вызывается при старте и при изменении настроек.
 */
export function applyProxy(proxyUrl: string | null): void {
  const url = proxyUrl?.trim() || null

  if (url) {
    try {
      setGlobalDispatcher(new ProxyAgent(url))
    } catch (err) {
      logger.warn('Не удалось применить прокси к fetch', err)
    }
    for (const key of PROXY_ENV_KEYS) process.env[key] = url
    logger.info('Прокси включён')
  } else {
    setGlobalDispatcher(new Agent())
    for (const key of PROXY_ENV_KEYS) delete process.env[key]
  }
}
