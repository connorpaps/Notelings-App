import { GET as handleGet, POST as handlePost } from '@/app/api/notes/route'
import { asDemoRequest } from '@/lib/deployment/demoRoute'

export const runtime = 'nodejs'
export const maxDuration = 30

export function GET(request: Request) {
  return handleGet(asDemoRequest(request))
}

export function POST(request: Request) {
  return handlePost(asDemoRequest(request))
}
