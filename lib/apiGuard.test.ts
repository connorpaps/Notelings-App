import { beforeEach, describe, expect, it } from 'vitest'
import { isSameOrigin, isStrictSameOrigin, rateLimit, readJsonBody, RequestBodyError, resetRateLimits } from './apiGuard'

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/chat', { headers })
}

describe('isSameOrigin', () => {
  it('allows requests with no Origin header for read/non-browser callers', () => {
    expect(isSameOrigin(makeRequest())).toBe(true)
  })

  it('allows a matching same-origin request', () => {
    expect(
      isSameOrigin(makeRequest({ origin: 'http://localhost:3000', host: 'localhost:3000' })),
    ).toBe(true)
  })

  it('rejects a cross-origin request', () => {
    expect(
      isSameOrigin(makeRequest({ origin: 'https://evil.example', host: 'localhost:3000' })),
    ).toBe(false)
  })

  it('rejects a malformed Origin header', () => {
    expect(isSameOrigin(makeRequest({ origin: 'not a url', host: 'localhost:3000' }))).toBe(false)
  })

  it('rejects a scheme mismatch behind a proxy', () => {
    expect(
      isSameOrigin(
        makeRequest({ origin: 'https://localhost:3000', host: 'localhost:3000', 'x-forwarded-proto': 'http' }),
      ),
    ).toBe(false)
  })

  it('allows a matching scheme behind a proxy', () => {
    expect(
      isSameOrigin(
        makeRequest({ origin: 'https://localhost:3000', host: 'localhost:3000', 'x-forwarded-proto': 'https' }),
      ),
    ).toBe(true)
  })
})

describe('isStrictSameOrigin', () => {
  it('rejects mutation requests without Origin or Referer', () => {
    expect(isStrictSameOrigin(makeRequest())).toBe(false)
  })

  it('accepts a same-origin Referer when Origin is absent', () => {
    expect(
      isStrictSameOrigin(makeRequest({ referer: 'http://localhost:3000/workspace' , host: 'localhost:3000' })),
    ).toBe(true)
  })

  it('rejects a cross-origin Referer', () => {
    expect(
      isStrictSameOrigin(makeRequest({ referer: 'https://evil.example/form', host: 'localhost:3000' })),
    ).toBe(false)
  })
})

describe('readJsonBody', () => {
  it('parses a small JSON body', async () => {
    await expect(readJsonBody(new Request('http://localhost', { body: '{"ok":true}', method: 'POST' }))).resolves.toEqual({ ok: true })
  })

  it('rejects malformed and oversized bodies before route work', async () => {
    await expect(readJsonBody(new Request('http://localhost', { body: 'not-json', method: 'POST' }))).rejects.toMatchObject({
      status: 400,
    })
    const error = await readJsonBody(
      new Request('http://localhost', { body: 'x'.repeat(64 * 1024 + 1), method: 'POST' }),
    ).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(RequestBodyError)
    expect((error as RequestBodyError).status).toBe(413)
  })
})

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
  })

  it('allows up to the max and then rejects', () => {
    const request = makeRequest({ 'x-forwarded-for': '1.2.3.4' })
    const options = { windowMs: 60_000, max: 3, scope: 'chat' }
    expect(rateLimit(request, options)).toBe(true)
    expect(rateLimit(request, options)).toBe(true)
    expect(rateLimit(request, options)).toBe(true)
    expect(rateLimit(request, options)).toBe(false)
  })

  it('scopes buckets so different routes do not share a budget', () => {
    const request = makeRequest({ 'x-forwarded-for': '1.2.3.4' })
    const chat = { windowMs: 60_000, max: 1, scope: 'chat' }
    const categorize = { windowMs: 60_000, max: 1, scope: 'categorize' }
    expect(rateLimit(request, chat)).toBe(true)
    // The chat budget is exhausted, but categorize still has its own budget.
    expect(rateLimit(request, categorize)).toBe(true)
    expect(rateLimit(request, chat)).toBe(false)
  })

  it('keys buckets by client IP', () => {
    const a = makeRequest({ 'x-forwarded-for': '1.1.1.1' })
    const b = makeRequest({ 'x-forwarded-for': '2.2.2.2' })
    const options = { windowMs: 60_000, max: 1, scope: 'chat' }
    expect(rateLimit(a, options)).toBe(true)
    expect(rateLimit(b, options)).toBe(true)
    expect(rateLimit(a, options)).toBe(false)
  })
})
