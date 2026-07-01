import type { IpcApi } from '@shared/ipc/contract'

/** Типизированный доступ к IPC-мосту, экспонированному preload. */
export const api: IpcApi = window.api
