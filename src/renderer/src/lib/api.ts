import type { IpcApi } from '@shared/ipc/contract'
import { wrapApiForDemo } from './demo'

/** Типизированный доступ к IPC-мосту, экспонированному preload. */
export const api: IpcApi = (window as any).env?.isDemoMode 
  ? wrapApiForDemo(window.api) 
  : window.api
