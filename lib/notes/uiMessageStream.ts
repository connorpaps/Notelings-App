/**
 * Builds a v7 UI-message stream response for a plain-text answer without an
 * LLM call (used by the deterministic count path). Wire format matches
 * `JsonToSseTransformStream`: `data: <json>\n\n` frames, terminated by
 * `data: [DONE]\n\n`, with the UI-message-stream headers the client checks.
 */

export function createUiMessageStreamResponse(text: string): Response {
  const frames = [
    { type: 'start' },
    { type: 'text-start', id: '0' },
    { type: 'text-delta', id: '0', delta: text },
    { type: 'text-end', id: '0' },
    { type: 'finish', finishReason: 'stop' },
  ]
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
  })
}
