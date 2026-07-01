/**
 * Единый источник истины для имён IPC-каналов.
 * Доменные части (source:*, catalog:*, install:*, update:*, notifications:*)
 * добавляют свои каналы здесь по мере реализации Частей 2–6.
 */

/** invoke-каналы (renderer → main → ответ). */
export const IpcInvoke = {
  app: {
    getVersion: 'app:getVersion',
    checkForUpdates: 'app:checkForUpdates',
    quitAndInstall: 'app:quitAndInstall'
  },
  config: {
    get: 'config:get',
    update: 'config:update'
  },
  jobs: {
    cancel: 'jobs:cancel'
  },
  source: {
    list: 'source:list',
    add: 'source:add',
    remove: 'source:remove',
    setEnabled: 'source:setEnabled',
    refresh: 'source:refresh',
    listSkills: 'source:listSkills'
  },
  catalog: {
    query: 'catalog:query',
    get: 'catalog:get',
    refreshIndex: 'catalog:refreshIndex'
  },
  install: {
    run: 'install:run',
    reconcileAgents: 'install:reconcileAgents'
  },
  update: {
    checkAll: 'update:checkAll',
    checkOne: 'update:checkOne',
    runOne: 'update:runOne',
    runAll: 'update:runAll',
    getSettings: 'update:getSettings',
    setSettings: 'update:setSettings'
  },
  notifications: {
    list: 'notifications:list',
    markRead: 'notifications:markRead',
    markAllRead: 'notifications:markAllRead',
    clear: 'notifications:clear'
  },
  secrets: {
    available: 'secrets:available',
    has: 'secrets:has',
    set: 'secrets:set',
    delete: 'secrets:delete'
  }
} as const

/** Событийные каналы (main → renderer, стрим). */
export const IpcEvent = {
  jobProgress: 'job:progress',
  jobLog: 'job:log',
  jobDone: 'job:done',
  jobError: 'job:error',
  appUpdateStatus: 'app:updateStatus',
  sourceIndexed: 'source:indexed',
  catalogUpdated: 'catalog:updated',
  installResult: 'install:result',
  updateChecked: 'update:checked',
  notification: 'notification:new'
} as const
