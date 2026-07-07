import type { Source } from './source'
import { DEFAULT_AGENT_ID } from './agent'
import type { LocalePref } from '../i18n/messages'

export type InstallScope = 'global' | 'project'

/** Режимы и параметры автообновления skills (Часть 6). */
export interface UpdateSettings {
  checkOnLaunch: boolean
  scheduleEnabled: boolean
  scheduleIntervalMinutes: number | null
  watchLocalSources: boolean
  /** Домены источников, для которых включено авто-применение обновлений. */
  autoUpdateDomains: string[]
}

/** Параметры установки (Часть 5/7). */
export interface InstallSettings {
  /** Директория установки (переопределяет базовый каталог, где применимо). null → по умолчанию. */
  installDir: string | null
  /** Целевые агенты (мультивыбор). */
  targetAgents: string[]
  scope: InstallScope
  /** Явный путь к бинарю `skills` (офлайн/предустановленный CLI). null → npx. */
  cliPath: string | null
  /** Корпоративное npm-registry для npx. null → по умолчанию. */
  npmRegistry: string | null
}

/** Сетевые настройки (Часть 7). Секреты здесь НЕ хранятся (эпик Q-04). */
export interface NetworkSettings {
  /** Режим доступа к git по умолчанию. */
  gitAuthMode: 'ssh' | 'https'
  /** Адрес прокси или null. */
  proxyUrl: string | null
}

/** Автообновление самого приложения через electron-updater / GitHub (эпик Q-06). */
export interface AppUpdateSettings {
  checkOnLaunch: boolean
  autoDownload: boolean
}

/** Настройки интерфейса (доступны и main-процессу — напр. для локализации трея). */
export interface UiSettings {
  /** Язык интерфейса: `system` — по локали ОС. */
  language: LocalePref
}

export interface AppConfig {
  schemaVersion: number
  sources: Source[]
  update: UpdateSettings
  install: InstallSettings
  network: NetworkSettings
  appUpdate: AppUpdateSettings
  ui: UiSettings
}

export const CONFIG_SCHEMA_VERSION = 1

export function defaultConfig(): AppConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    sources: [],
    update: {
      checkOnLaunch: true,
      scheduleEnabled: false,
      scheduleIntervalMinutes: null,
      watchLocalSources: true,
      autoUpdateDomains: []
    },
    install: {
      installDir: null,
      targetAgents: [DEFAULT_AGENT_ID],
      scope: 'global',
      cliPath: null,
      npmRegistry: null
    },
    network: {
      gitAuthMode: 'https',
      proxyUrl: null
    },
    appUpdate: {
      checkOnLaunch: true,
      autoDownload: true
    },
    ui: {
      language: 'system'
    }
  }
}
