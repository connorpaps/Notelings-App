import type { NoteRecord } from './types'

/**
 * Deterministic counting for "Ask the Librarian" (M4 enhancement).
 *
 * The LLM is unreliable at counting over long lists, so when the user asks a
 * count question the chat route answers it in code instead — exact, instant,
 * and free. This module detects the intent and does the matching; both are
 * pure and unit-tested.
 */

/** Filler words that commonly trail the topic in count questions (incl.
 *  articles so "count the notes about testing" resolves to "testing"). */
const TOPIC_TRAILING = /\b(?:do i have|are there|are about|mention(?:s|ed)?|with|tagged|about|contain(?:s|ing)?|that|regarding|the|a|an|all)\b/gi
const PUNCTUATION = /[?.!]+$/g

/** Strip filler words + trailing punctuation from an extracted topic. */
function cleanTopic(raw: string): string {
  return raw
    .replace(TOPIC_TRAILING, ' ')
    .replace(PUNCTUATION, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detect a count-notes question and return the topic to count, or null when
 * the message is not a count question (or has no extractable topic).
 *
 * Two shapes, after stripping the opener ("how many" / "count" / "of my" / "my"):
 *   A) "…<topic> notes…"  → topic sits right before "notes" ("how many work notes do I have?")
 *   B) "…notes <filler> <topic>" → topic after "notes" + filler ("how many notes mention testing?")
 *
 * Examples:
 *   "how many notes mention testing"       → "testing"
 *   "how many of my notes are about food"  → "food"
 *   "how many work notes do I have"        → "work"
 *   "count my notes tagged urgent"         → "urgent"
 *   "what is the capital of France"        → null
 *   "how many notes do I have"             → null (no topic)
 */
export function detectCountQuery(message: string): string | null {
  const text = message.trim()
  if (!/^(?:how many|count)\b/i.test(text)) return null

  const rest = text
    .replace(/^(?:how many|count)\b/i, '')
    .replace(/\bof my\b/gi, ' ')
    .replace(/\bmy\b/gi, ' ')
    .trim()

  // Shape A: topic immediately before "notes". If cleaning leaves nothing
  // (e.g. "the notes…" → topic "the" is a stripped filler), fall through to
  // Shape B, which then sees "notes …" directly.
  const beforeNotes = rest.match(/^(.*?)\s+notes?\b/i)?.[1]
  if (beforeNotes !== undefined) {
    const topic = cleanTopic(beforeNotes)
    if (topic) return topic
  }

  // Shape B: topic after "notes" (+ filler words). Strip any leading
  // article too, so "the notes about testing" → "about testing".
  const afterNotes = rest.replace(/^(?:(?:the|a|an|all)\s+)?notes?\b/i, '')
  const topic = cleanTopic(afterNotes)
  return topic.length > 0 ? topic : null
}

/** Lightweight stemmer mirroring the Librarian's rule ("test" ~ "testing"). */
function stemWord(word: string): string {
  let stem = word.toLowerCase()
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (stem.length > 3 && stem.endsWith(suffix)) {
      stem = stem.slice(0, -suffix.length)
      break
    }
  }
  return stem
}

function wordsMatch(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false
  const sa = stemWord(a)
  const sb = stemWord(b)
  return sa === sb || sa.startsWith(sb) || sb.startsWith(sa)
}

/**
 * A note matches a topic when the literal topic appears in its category,
 * content, or tags, OR when every topic word matches a word in those fields
 * after stemming ("test" matches "testing"/"tested"/"test note").
 */
export function noteMatchesTopic(note: NoteRecord, topic: string): boolean {
  const haystack = `${note.category} ${note.content} ${note.tags.join(' ')}`.toLowerCase()
  const needle = topic.toLowerCase()
  if (haystack.includes(needle)) return true
  const topicWords = needle.split(/\s+/).filter(Boolean)
  if (topicWords.length === 0) return false
  // NOTE: filter(Boolean) is essential — a trailing space (empty tags) would
  // otherwise produce an empty hayword, and `"x".startsWith("")` is true,
  // making every note match every topic.
  const hayWords = haystack.split(/\s+/).filter(Boolean)
  return topicWords.every((topicWord) =>
    hayWords.some((hayWord) => wordsMatch(topicWord, hayWord)),
  )
}

/** Deterministic count over non-archived notes; returns the matching notes. */
export function countNotesMatching(notes: readonly NoteRecord[], topic: string): NoteRecord[] {
  return notes.filter(
    (note) => note.status !== 'archived' && noteMatchesTopic(note, topic),
  )
}
