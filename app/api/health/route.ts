import { NextResponse } from 'next/server'
import { observeApiRoute } from '@/lib/observability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Liveness only: no private data, credentials, provider details, or DB rows. */
export async function GET(request: Request) {
  return observeApiRoute(request, 'health', async () =>
    NextResponse.json(
      { status: 'ok', service: 'notelings' },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  )
}
