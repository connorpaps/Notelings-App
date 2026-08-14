import { GET as handleGet } from '@/app/api/tags/route'
import { asDemoRequest } from '@/lib/deployment/demoRoute'

export const runtime = 'nodejs'
export const maxDuration = 30

export function GET(request: Request) {
  return handleGet(asDemoRequest(request))
}
