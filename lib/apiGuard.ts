/**
 * Lightweight request hardening for the authenticated API routes.
 *
 * Authentication and RLS are the real boundary. These origin checks remain
 * defense in depth, with a strict variant for cookie-authenticated mutations
 * to reduce CSRF risk.
 *
 *  - `isSameOrigin` rejects a supplied cross-origin `Origin`; missing Origin is
 *    allowed for read routes and non-browser tooling.
 *  - `isStrictSameOrigin` requires a valid same-origin Origin, or a present,
 *    allow-listed Referer. Requests with neither are rejected for unsafe
 *    cookie-authenticated mutations.
 *
 *  - `rateLimit` is an in-memory sliding-window limiter keyed by client IP +
 *    scope. It is intended to protect LLM spend (Gemini) on /api/chat and
 *    /api/categorize. In-memory state resets on restart and is per-instance,
 *    which is fine for the single-instance local/dev deployment this app runs
 *    in; it is NOT a substitute for a shared store at scale.
 *
 * IMPORTANT (both guards): they are deliberately simple and permissive — they
 * raise the bar for casual abuse, not for a determined attacker. The client IP
 * is taken from `x-forwarded-for`, which is ONLY trustworthy when a proxy
 * (Vercel, etc.) overwrites it; on a raw Node server an attacker can spoof the
 * header to rotate buckets. The `Origin` guard is similarly client-controlled.
 */

export const MAX_JSON_BODY_BYTES = 64 * 1024

export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message)
    this.name = 'RequestBodyError'
  }
}

/** Read JSON with a byte cap before schema validation or provider work. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new RequestBodyError('Request body is too large', 413)
  }

  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    throw new RequestBodyError('Request body is too large', 413)
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new RequestBodyError('Invalid JSON body', 400)
  }
}

export type RateLimitOptions = {
  /** Sliding window length in milliseconds. */
  windowMs?: number
  /** Maximum allowed requests within the window. */
  max?: number
  /** Namespace so different routes don't share one bucket per IP. */
  scope?: string
}

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX = 30
/** Hard cap on tracked buckets so a flood of unique IPs cannot grow the map unbounded. */
const MAX_BUCKETS = 10_000

/** Route-specific limits (per 60s window). */
export const CATEGORIZE_RATE_LIMIT: Required<Omit<RateLimitOptions, 'scope'>> = {
  windowMs: 60_000,
  max: 30,
}
export const CHAT_RATE_LIMIT: Required<Omit<RateLimitOptions, 'scope'>> = {
  windowMs: 60_000,
  max: 20,
}

/** Brute-force throttles for the password auth endpoints (per 60s window). */
export const AUTH_LOGIN_RATE_LIMIT: Required<Omit<RateLimitOptions, 'scope'>> = {
  windowMs: 60_000,
  max: 10,
}
export const AUTH_REGISTER_RATE_LIMIT: Required<Omit<RateLimitOptions, 'scope'>> = {
  windowMs: 60_000,
  max: 5,
}
export const AUTH_DEMO_RATE_LIMIT: Required<Omit<RateLimitOptions, 'scope'>> = {
  windowMs: 60_000,
  max: 10,
}

/** In-memory buckets: `scope:ip` → sorted timestamps. */
const buckets = new Map<string, number[]>()

/**
 * Best-effort client IP. Next.js/Vercel set x-forwarded-for; dev falls back to
 * a single local bucket. Trusting this header assumes a proxy that overwrites
 * it — a raw server would let clients rotate it to bypass the limiter.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'local'
}

/**
 * Reject cross-site browser requests: when an `Origin` header is present it
 * must belong to the same host (and, behind a proxy, scheme) the request was
 * sent to. Missing/invalid origins are treated as non-browser callers and
 * allowed.
 */
function matchesRequestOrigin(request: Request, value: string): boolean {
  const host = request.headers.get('host')
  if (!host) return false
  try {
    const parsed = new URL(value)
    // Match host AND scheme. Behind a proxy the request scheme arrives via
    // x-forwarded-proto; without it, fall back to the supplied URL scheme in
    // local development.
    const proto = request.headers.get('x-forwarded-proto') ?? parsed.protocol.replace(':', '')
    return parsed.host === host && parsed.protocol === `${proto}:`
  } catch {
    return false
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  return matchesRequestOrigin(request, origin)
}

/** Strict CSRF guard for cookie-authenticated POST/PATCH/DELETE requests. */
export function isStrictSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (origin) return matchesRequestOrigin(request, origin)
  const referer = request.headers.get('referer')
  return Boolean(referer && matchesRequestOrigin(request, referer))
}

/** Drops stale/oldest buckets when the tracked set exceeds the cap. */
function pruneBuckets(): void {
  if (buckets.size <= MAX_BUCKETS) return
  const now = Date.now()
  for (const [key, timestamps] of buckets) {
    if (timestamps.every((timestamp) => now - timestamp >= DEFAULT_WINDOW_MS)) buckets.delete(key)
  }
  if (buckets.size > MAX_BUCKETS) {
    for (const key of [...buckets.keys()].slice(0, buckets.size - MAX_BUCKETS)) buckets.delete(key)
  }
}

/** Returns false (rate-limited) when the caller exceeded the window budget. */
export function rateLimit(request: Request, options: RateLimitOptions = {}): boolean {
  const { windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX, scope = 'default' } = options
  const key = `${scope}:${clientIp(request)}`
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs)
  if (recent.length >= max) {
    buckets.set(key, recent)
    return false
  }
  recent.push(now)
  buckets.set(key, recent)
  pruneBuckets()
  return true
}

/** Clears all buckets. Exposed for tests only. */
export function resetRateLimits(): void {
  buckets.clear()
}
