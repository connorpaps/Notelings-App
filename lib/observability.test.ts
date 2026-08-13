import { describe, expect, it, vi } from 'vitest'
import { errorCategory, getRequestId, observeApiRoute } from './observability'

describe('observability', () => {
  it('keeps a short opaque request ID supplied by the proxy', () => {
    const request = new Request('http://localhost/api/health', { headers: { 'x-request-id': 'edge-123' } })
    expect(getRequestId(request)).toBe('edge-123')
  })

  it('replaces malformed or oversized request IDs', () => {
    const request = new Request('http://localhost/api/health', {
      headers: { 'x-request-id': '<script>alert(1)</script>' },
    })
    const id = getRequestId(request)
    expect(id).not.toContain('<')
    expect(id.length).toBeGreaterThan(10)
  })

  it('adds correlation without changing the response body', async () => {
    const response = await observeApiRoute(
      new Request('http://localhost/api/health'),
      'health',
      async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    )
    expect(response.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9-]{20,}$/)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('categorizes errors without exposing their messages', () => {
    expect(errorCategory(new Error('private note content'))).toBe('Error')
    const custom = new Error('private note content')
    custom.name = 'private_prompt_contents'
    expect(errorCategory(custom)).toBe('unknown_error')
    expect(errorCategory({ secret: 'do not log' })).toBe('unknown_error')
  })

  it('preserves a streaming response body while adding the correlation header', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: chunk\\n\\n'))
        controller.close()
      },
    })
    const response = await observeApiRoute(
      new Request('http://localhost/api/chat'),
      'chat',
      async () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }),
    )
    expect(response.headers.get('x-request-id')).toBeTruthy()
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    await expect(response.text()).resolves.toBe('data: chunk\\n\\n')
  })

  it('logs only redacted structured fields on handler failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      observeApiRoute(new Request('http://localhost/api/health'), 'health', async () => {
        throw new Error('private note content')
      }),
    ).rejects.toThrow('private note content')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"error":"Error"'))
    expect(errorSpy.mock.calls[0]?.[0]).not.toContain('private note content')
    errorSpy.mockRestore()
  })
})
