export type AppMode = 'private' | 'demo'

export const APP_MODE_HEADER = 'x-notelings-app-mode'
export const DEMO_PATH_PREFIX = '/demo'

export function modeFromPathname(pathname: string): AppMode {
  return pathname === DEMO_PATH_PREFIX || pathname.startsWith(`${DEMO_PATH_PREFIX}/`) ? 'demo' : 'private'
}

export function apiPath(mode: AppMode, endpoint: string): string {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return mode === 'demo' ? `${DEMO_PATH_PREFIX}/api${normalized}` : `/api${normalized}`
}

export function browserMode(): AppMode {
  return typeof window === 'undefined' ? 'private' : modeFromPathname(window.location.pathname)
}

export function browserApiPath(endpoint: string): string {
  return apiPath(browserMode(), endpoint)
}

export function authCookieNameForMode(mode: AppMode): string {
  return mode === 'demo' ? 'notelings-demo-auth' : 'notelings-private-auth'
}
