import { APP_MODE_HEADER } from './mode'

/**
 * Demo API adapters call the existing route handlers without relying on a
 * proxy rewrite to carry a custom request header. The adapter is only reachable
 * under the filesystem /demo/api/* boundary.
 */
export function asDemoRequest(request: Request): Request {
  const headers = new Headers(request.headers)
  headers.set(APP_MODE_HEADER, 'demo')
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'follow',
  }
  if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }
  return new Request(request.url, init)
}
