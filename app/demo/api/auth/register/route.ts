import { POST as handlePost } from '@/app/api/auth/register/route'
import { asDemoRequest } from '@/lib/deployment/demoRoute'

export const runtime = 'nodejs'
export const maxDuration = 30

export function POST(request: Request) {
  return handlePost(asDemoRequest(request))
}
