import { POST as handlePost } from '@/app/api/chat/route'
import { asDemoRequest } from '@/lib/deployment/demoRoute'

export const runtime = 'nodejs'
export const maxDuration = 60

export function POST(request: Request) {
  return handlePost(asDemoRequest(request))
}
