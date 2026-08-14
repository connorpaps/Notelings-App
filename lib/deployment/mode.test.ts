import { describe, expect, it } from 'vitest'
import { apiPath, modeFromPathname } from './mode'

describe('deployment mode', () => {
  it.each([
    ['/', 'private'],
    ['/auth', 'private'],
    ['/api/notes', 'private'],
    ['/demo', 'demo'],
    ['/demo/', 'demo'],
    ['/demo/api/notes', 'demo'],
    ['/demo/anything', 'demo'],
  ] as const)('resolves %s as %s', (pathname, mode) => {
    expect(modeFromPathname(pathname)).toBe(mode)
  })

  it('does not treat a query parameter as a mode boundary', () => {
    expect(modeFromPathname('/?demo=true')).toBe('private')
    expect(modeFromPathname('/notes?demo=true')).toBe('private')
  })

  it('builds mode-specific API paths', () => {
    expect(apiPath('private', '/notes')).toBe('/api/notes')
    expect(apiPath('demo', '/notes')).toBe('/demo/api/notes')
    expect(apiPath('demo', 'auth/demo')).toBe('/demo/api/auth/demo')
  })
})
