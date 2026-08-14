import { GET as handleGet } from '@/app/auth/callback/route'
import { asDemoRequest } from '@/lib/deployment/demoRoute'

export function GET(request: Request) {
  return handleGet(asDemoRequest(request))
}
