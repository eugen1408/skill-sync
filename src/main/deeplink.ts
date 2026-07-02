import { app } from 'electron'
import { parseGitSourceInput, type ParsedGitSource } from '@shared/domain/gitSource'
import { logger } from './logger'

export function parseDeeplink(urlStr: string): ParsedGitSource | null {
  if (!urlStr.startsWith('skill://')) return null
  let payload = urlStr.substring('skill://'.length)
  if (!payload) return null

  // Strip trailing slashes that might be added by some OS handlers
  payload = payload.replace(/\/+$/, '')

  if (
    !payload.startsWith('git@') &&
    !payload.startsWith('ssh://') &&
    !/^https?:\/\//i.test(payload)
  ) {
    // Только если первый сегмент выглядит как хост (содержит точку), достраиваем схему:
    // github.com/owner/repo -> https://github.com/owner/repo. Иначе оставляем shorthand
    // `owner/repo` (в т.ч. с точкой в имени репозитория) — его разберёт parseGitSourceInput.
    const firstSegment = payload.split('/')[0] ?? ''
    if (payload.includes('/') && firstSegment.includes('.')) {
      payload = `https://${payload}`
    }
  }

  return parseGitSourceInput(payload)
}

export class DeeplinkHandler {
  constructor(private readonly onDeeplink: (url: string, parsed: ParsedGitSource | null) => void) {}

  setup(): void {
    // macOS
    app.on('open-url', (event, url) => {
      event.preventDefault()
      this.handleUrl(url)
    })

    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('skill', process.execPath, [process.argv[1]!])
      }
    } else {
      app.setAsDefaultProtocolClient('skill')
    }
  }

  handleSecondInstance(argv: string[]): void {
    // Windows/Linux typically pass the URL as one of the arguments
    const url = argv.find((arg) => arg.startsWith('skill://'))
    if (url) {
      this.handleUrl(url)
    }
  }

  private handleUrl(url: string): void {
    logger.info('Received deeplink', { url })
    const parsed = parseDeeplink(url)
    if (parsed) {
      this.onDeeplink(url, parsed)
    } else {
      logger.warn('Failed to parse deeplink', { url })
      this.onDeeplink(url, null)
    }
  }
}
