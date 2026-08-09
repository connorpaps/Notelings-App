import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('ai', () => ({ generateObject: vi.fn() }))
vi.mock('@ai-sdk/google', () => ({ google: vi.fn(() => ({ modelId: 'gemini-2.5-flash' })) }))

import { generateObject } from 'ai'
import { categorizeNote, LLM_TIMEOUT_MS } from './categorizeNote'

const mockedGenerateObject = vi.mocked(generateObject)

afterEach(() => vi.clearAllMocks())

describe('categorizeNote', () => {
  it('returns the schema-validated category and tags with a 10s abort timeout', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    mockedGenerateObject.mockResolvedValueOnce({
      object: { category: 'Work', tags: ['idea', 'plan'] },
    } as never)
    await expect(categorizeNote('ship the planner')).resolves.toEqual({ category: 'Work', tags: ['idea', 'plan'] })
    expect(mockedGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.anything(), schema: expect.anything(), maxRetries: 0 }),
    )
    expect(timeoutSpy).toHaveBeenCalledWith(LLM_TIMEOUT_MS)
    timeoutSpy.mockRestore()
  })

  it('rethrows provider failures so the route can degrade', async () => {
    mockedGenerateObject.mockRejectedValueOnce(new Error('timeout'))
    await expect(categorizeNote('x')).rejects.toThrow('timeout')
  })
})
