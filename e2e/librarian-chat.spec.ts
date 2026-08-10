import { test, expect } from '@playwright/test'

// The v7 UI-message stream is SSE: each JSON chunk as `data: <json>\n\n`,
// terminated by `data: [DONE]\n\n` (JsonToSseTransformStream wire format).
// The mocked answer is the strict-grounding refusal sentence.
const sse = (chunk: string) => `data: ${chunk}\n\n`
const UI_MESSAGE_STREAM = [
  sse('{"type":"start","messageId":"mock-1"}'),
  sse('{"type":"text-start","id":"mock-1"}'),
  sse('{"type":"text-delta","id":"mock-1","delta":"I couldn\'t find any notes related to that."}'),
  sse('{"type":"finish","finishReason":"stop"}'),
  sse('[DONE]'),
].join('')

test('Milestone 4 librarian chat: Ask AI toggle streams a strictly-grounded answer', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  let chatRequests = 0
  await page.route('**/api/chat', (route) => {
    chatRequests += 1
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
      body: UI_MESSAGE_STREAM,
    })
  })
  await page.route('**/api/notes', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()

  // Switch the dock to Ask AI: the panel slides up with its empty state.
  await page.getByRole('button', { name: 'Ask AI' }).click()
  await expect(page.getByText(/Ask about anything in your notes/)).toBeVisible({ timeout: 10_000 })
  const input = page.getByRole('textbox', { name: 'Ask the Librarian' })
  await expect(input).toBeVisible()
  await input.fill('what did I plan for Q3?')
  await page.getByRole('button', { name: 'Ask the Librarian' }).click()

  // The mock stream lands in the chat log…
  await expect(page.locator('[data-chat-log]')).toContainText(
    "I couldn't find any notes related to that.",
    { timeout: 15_000 },
  )
  // …the question was sent to /api/chat, and the terminal logged it.
  await expect.poll(() => chatRequests).toBe(1)
  await expect(page.locator('[data-terminal-log]')).toContainText(/Asking the Librarian: "what did I plan for Q3\?"/)

  expect(errors).toEqual([])
})
