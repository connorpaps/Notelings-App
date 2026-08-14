import { DELETE as handleDelete, PATCH as handlePatch } from '@/app/api/notes/[id]/route'
import { asDemoRequest } from '@/lib/deployment/demoRoute'

type RouteContext = { params: Promise<{ id: string }> }

export const runtime = 'nodejs'
export const maxDuration = 30

export function PATCH(request: Request, context: RouteContext) {
  return handlePatch(asDemoRequest(request), context)
}

export function DELETE(request: Request, context: RouteContext) {
  return handleDelete(asDemoRequest(request), context)
}
