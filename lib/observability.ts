const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/
const SAFE_ERROR_NAMES = new Set(['AbortError', 'Error', 'RangeError', 'SyntaxError', 'TimeoutError', 'TypeError', 'ZodError'])

type ApiLogLevel = 'info' | 'warn' | 'error'

type ApiLogEvent = {
  level?: ApiLogLevel
  route: string
  requestId: string
  status?: number
  durationMs?: number
  event?: string
  error?: unknown
}

/** Accept a proxy-provided correlation ID only when it is short and opaque. */
export function getRequestId(request: Request): string {
  const supplied = request.headers.get('x-request-id')?.trim()
  if (supplied && REQUEST_ID_PATTERN.test(supplied)) return supplied
  return crypto.randomUUID()
}

/** Convert an exception into a non-sensitive category; never log its message/stack. */
export function errorCategory(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'timeout'
  if (error instanceof Error && SAFE_ERROR_NAMES.has(error.name)) return error.name
  return 'unknown_error'
}

/**
 * Structured, redacted server log. Deliberately omits request bodies, prompts,
 * note content, provider messages, tokens, cookies, and embeddings.
 */
export function logApiEvent({ level = 'info', route, requestId, status, durationMs, event, error }: ApiLogEvent): void {
  const payload = {
    type: 'api_request',
    route,
    request_id: requestId,
    ...(status === undefined ? {} : { status }),
    ...(durationMs === undefined ? {} : { duration_ms: Math.round(durationMs) }),
    ...(event ? { event } : {}),
    ...(error === undefined ? {} : { error: errorCategory(error) }),
  }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

/**
 * Observe a Route Handler without changing its response body or streaming
 * behavior. The correlation header is safe to expose and lets a user report a
 * failing request without exposing private note data.
 */
export async function observeApiRoute(
  request: Request,
  route: string,
  handler: (context: { requestId: string }) => Promise<Response>,
): Promise<Response> {
  const requestId = getRequestId(request)
  const startedAt = performance.now()
  try {
    const response = await handler({ requestId })
    response.headers.set('x-request-id', requestId)
    logApiEvent({ route, requestId, status: response.status, durationMs: performance.now() - startedAt })
    return response
  } catch (error) {
    logApiEvent({ level: 'error', route, requestId, status: 500, durationMs: performance.now() - startedAt, error })
    throw error
  }
}

/** Record a safe provider/database failure while preserving the caller's ID. */
export function logApiFailure(route: string, request: Request, error: unknown, requestId = getRequestId(request)): void {
  logApiEvent({ level: 'error', route, requestId, error })
}
