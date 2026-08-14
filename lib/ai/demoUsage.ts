import 'server-only'

import { createServerSupabase } from '@/lib/supabase/server'
import type { AppMode } from '@/lib/deployment/mode'

export const DEMO_AI_LIMITS = {
  categorize: 12,
  chat: 6,
} as const

export type DemoAiAction = keyof typeof DEMO_AI_LIMITS

/**
 * Reserve one provider call for the public demo. The demo account is shared,
 * so these are deployment-wide daily caps rather than per-browser promises.
 * Private deployments skip this path because they do not configure the demo
 * email variable. Failure is deliberately closed for demo AI and callers use
 * their existing deterministic/degraded fallback.
 */
export async function reserveDemoAiUsage(action: DemoAiAction, mode: AppMode = 'private'): Promise<boolean> {
  if (mode !== 'demo') return true

  try {
    const { data, error } = await createServerSupabase('demo').rpc('reserve_demo_ai_usage', {
      p_action: action,
      p_limit: DEMO_AI_LIMITS[action],
    })
    return !error && data === true
  } catch {
    return false
  }
}
