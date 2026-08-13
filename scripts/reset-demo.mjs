#!/usr/bin/env node
/**
 * Reset the isolated portfolio demo workspace to fictional seed data.
 *
 * Required safety gates:
 *   NOTELINGS_DEMO_PROJECT_REF must match the Supabase URL project ref.
 *   NOTELINGS_DEMO_RESET_CONFIRM must equal RESET_DEMO.
 *
 * Never run this script with the private workspace environment.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envFile = process.env.NOTELINGS_ENV_FILE || '.env.local'

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    return match && !line.trimStart().startsWith('#') ? [[match[1], match[2]]] : []
  }))
}

const env = {
  ...parseEnv(readFileSync(envFile, 'utf8')),
  ...(process.env.NOTELINGS_DEMO_RESET_CONFIRM ? { NOTELINGS_DEMO_RESET_CONFIRM: process.env.NOTELINGS_DEMO_RESET_CONFIRM } : {}),
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const expectedProjectRef = env.NOTELINGS_DEMO_PROJECT_REF
const actualProjectRef = url ? new URL(url).hostname.split('.')[0] : ''

if (!url || !serviceKey || !expectedProjectRef) {
  throw new Error('Demo reset requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NOTELINGS_DEMO_PROJECT_REF.')
}
if (actualProjectRef !== expectedProjectRef) {
  throw new Error(`Refusing reset: URL project ref ${actualProjectRef} does not match NOTELINGS_DEMO_PROJECT_REF.`)
}
if (env.NOTELINGS_DEMO_RESET_CONFIRM !== 'RESET_DEMO') {
  throw new Error('Refusing reset: set NOTELINGS_DEMO_RESET_CONFIRM=RESET_DEMO for this demo project only.')
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const demoEmail = (env.NOTELINGS_DEMO_EMAIL ?? 'demo@notelings.local').toLowerCase()
const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (usersError) throw usersError
const demo = users.users.find((user) => user.email?.toLowerCase() === demoEmail)
if (!demo) throw new Error(`Demo account ${demoEmail} was not found in the target project.`)

const seedNotes = [
  {
    client_submission_id: 'demo-seed-roadmap',
    content: 'Sketch the Q3 product roadmap around a smaller, calmer capture flow.',
    category: 'Work',
    tags: ['roadmap', 'product', 'focus'],
    status: 'filed',
  },
  {
    client_submission_id: 'demo-seed-invoices',
    content: 'Review the studio software invoices before the next planning session.',
    category: 'Admin',
    tags: ['finance', 'review'],
    status: 'filed',
  },
  {
    client_submission_id: 'demo-seed-garden',
    content: 'Try the balcony herb garden layout when the weather warms up.',
    category: 'Manual',
    tags: ['home', 'experiment'],
    status: 'filed',
  },
  {
    client_submission_id: 'demo-seed-reading',
    content: 'Read the chapter on spatial memory and capture three useful ideas.',
    category: 'Work',
    tags: ['reading', 'research', 'memory'],
    status: 'filed',
  },
  {
    client_submission_id: 'demo-seed-weekend',
    content: 'Plan a quiet weekend reset with a walk, groceries, and no meetings.',
    category: 'Uncategorized',
    tags: ['weekend', 'reset'],
    status: 'filed',
  },
  {
    client_submission_id: 'demo-seed-graph',
    content: 'Connect the ideas about attention, space, and visual recall.',
    category: 'Manual',
    tags: ['research', 'memory', 'graph'],
    status: 'filed',
  },
  {
    client_submission_id: 'demo-seed-archive',
    content: 'An old launch idea to archive after the new direction is clear.',
    category: 'Work',
    tags: ['archive', 'launch'],
    status: 'archived',
  },
  {
    client_submission_id: 'demo-seed-capture',
    content: 'A fresh note waiting for the Librarian to sort.',
    category: 'Manual',
    tags: ['demo', 'capture'],
    status: 'pending',
  },
].map((note) => ({ ...note, user_id: demo.id }))

const { error: usageDeleteError } = await admin.from('demo_ai_usage_daily').delete().not('usage_date', 'is', null)
if (usageDeleteError) throw usageDeleteError
const { error: deleteError } = await admin.from('notes').delete().not('id', 'is', null)
if (deleteError) throw deleteError
const { error: insertError } = await admin.from('notes').insert(seedNotes)
if (insertError) throw insertError

console.log(JSON.stringify({
  reset: true,
  projectRef: actualProjectRef,
  seededRows: seedNotes.length,
  archivedRows: seedNotes.filter((note) => note.status === 'archived').length,
  categories: [...new Set(seedNotes.map((note) => note.category))].sort(),
}, null, 2))
