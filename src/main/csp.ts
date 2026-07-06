/**
 * Content-Security-Policy для renderer.
 * Сетевые вызовы (skills.sh API, GitHub API, git) выполняются в main-процессе,
 * поэтому renderer connect-src ограничен 'self' (+ ws для HMR в dev).
 */
export function buildCsp(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    // Tailwind/Skeleton инжектят inline-стили.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    isDev ? "connect-src 'self' ws: http://localhost:*" : "connect-src 'self'"
  ]
  return directives.join('; ')
}
