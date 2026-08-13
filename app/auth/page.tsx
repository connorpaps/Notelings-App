import { redirect } from 'next/navigation'

/**
 * Auth is intentionally an additive header surface over the office. This
 * route remains a safe fallback for bookmarked auth links and future landing
 * page work without creating a second visual world.
 */
export default function AuthPage() {
  redirect('/')
}
