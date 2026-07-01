/** Ключ секрета для токена GitHub API (лимиты skillFolderHash / приватные репозитории). */
export const GITHUB_TOKEN_KEY = 'githubToken'

/** Прокидывает GitHub-токен в окружение процесса (наследуется fetch-портами и git). */
export function applyGithubTokenEnv(token: string | null): void {
  if (token) {
    process.env.GITHUB_TOKEN = token
    process.env.GH_TOKEN = token
  } else {
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
  }
}
