import { describe, expect, it, vi } from 'vitest'
import { APP_MODE_HEADER } from '@/lib/deployment/mode'
import { asDemoRequest } from '@/lib/deployment/demoRoute'

vi.mock('server-only', () => ({}))

describe('demo route boundary', () => {
  it('marks delegated requests as demo without exposing a mode selector to the browser', async () => {
    const request = new Request('http://localhost/demo/api/auth/demo', {
      method: 'POST',
      headers: { origin: 'http://localhost', [APP_MODE_HEADER]: 'private' },
      body: JSON.stringify({ ok: true }),
    })

    const delegated = asDemoRequest(request)

    expect(delegated.headers.get(APP_MODE_HEADER)).toBe('demo')
    expect(await delegated.json()).toEqual({ ok: true })
  })
})
