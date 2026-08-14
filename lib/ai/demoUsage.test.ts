import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(() => ({ rpc })),
}))

import { DEMO_AI_LIMITS, reserveDemoAiUsage } from './demoUsage'

describe('demo AI usage', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('keeps private deployments unrestricted by the demo budget', async () => {
    await expect(reserveDemoAiUsage('categorize', 'private')).resolves.toBe(true)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reserves the configured action limit for demo mode', async () => {
    rpc.mockResolvedValue({ data: true, error: null })

    await expect(reserveDemoAiUsage('chat', 'demo')).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('reserve_demo_ai_usage', {
      p_action: 'chat',
      p_limit: DEMO_AI_LIMITS.chat,
    })
  })

  it('fails closed when the demo budget service is unavailable', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('unavailable') })

    await expect(reserveDemoAiUsage('categorize', 'demo')).resolves.toBe(false)
  })
})
