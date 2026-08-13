import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(() => ({ rpc })),
}))

import { DEMO_AI_LIMITS, reserveDemoAiUsage } from './demoUsage'

describe('demo AI usage', () => {
  const originalDemoEmail = process.env.NOTELINGS_DEMO_EMAIL

  beforeEach(() => {
    rpc.mockReset()
    if (originalDemoEmail === undefined) delete process.env.NOTELINGS_DEMO_EMAIL
    else process.env.NOTELINGS_DEMO_EMAIL = originalDemoEmail
  })

  it('keeps private deployments unrestricted by the demo budget', async () => {
    delete process.env.NOTELINGS_DEMO_EMAIL

    await expect(reserveDemoAiUsage('categorize')).resolves.toBe(true)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reserves the configured action limit for the demo', async () => {
    process.env.NOTELINGS_DEMO_EMAIL = 'demo@notelings.local'
    rpc.mockResolvedValue({ data: true, error: null })

    await expect(reserveDemoAiUsage('chat')).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('reserve_demo_ai_usage', {
      p_action: 'chat',
      p_limit: DEMO_AI_LIMITS.chat,
    })
  })

  it('fails closed when the demo budget service is unavailable', async () => {
    process.env.NOTELINGS_DEMO_EMAIL = 'demo@notelings.local'
    rpc.mockResolvedValue({ data: null, error: new Error('unavailable') })

    await expect(reserveDemoAiUsage('categorize')).resolves.toBe(false)
  })
})
