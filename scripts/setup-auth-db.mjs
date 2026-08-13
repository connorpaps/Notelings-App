#!/usr/bin/env node
/**
 * Notelings auth DB setup (one-time, dev).
 *
 * Applies, in order:
 *   1. supabase/migrations/20260812_auth_ownership.sql   (adds user_id columns)
 *   2. owner backfill                                    (existing notes → owner)
 *   3. supabase/migrations/20260813_auth_cutover.sql     (owner RLS + NOT NULL)
 *   4. supabase/migrations/20260813_username_password_auth.sql (usernames table)
 *   5. supabase/migrations/20260813_manual_capture_category.sql (manual state)
 *
 * Then, via the service role + admin API:
 *   - creates the shared demo account (demo@notelings.local / NOTELINGS_DEMO_PASSWORD)
 *   - sets a password on the owner account (printed once — change it afterwards)
 *   - registers usernames for both accounts
 *
 * SQL runs through the Supabase Management API when SUPABASE_ACCESS_TOKEN is
 * present in .env.local; otherwise a combined SQL file is written for the
 * Dashboard SQL editor. Never commit .env.local or the generated SQL file.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env.local')

function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (match && !line.trimStart().startsWith('#')) out[match[1]] = match[2]
  }
  return out
}

if (!existsSync(envPath)) {
  console.error('✗ .env.local not found. Copy .env.example to .env.local first.')
  process.exit(1)
}

const env = parseEnv(readFileSync(envPath, 'utf8'))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const accessToken = env.SUPABASE_ACCESS_TOKEN
const ownerEmail = (env.NOTELINGS_OWNER_EMAIL || 'buh417432@gmail.com').toLowerCase()
const demoEmail = (env.NOTELINGS_DEMO_EMAIL || 'demo@notelings.local').toLowerCase()
const demoUsername = 'demo'

if (!url || !serviceKey) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const projectRef = new URL(url).hostname.split('.')[0]
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const readMigration = (file) => readFileSync(path.join(root, 'supabase', 'migrations', file), 'utf8')

const SQL_STEPS = [
  { name: 'ownership columns', sql: readMigration('20260812_auth_ownership.sql') },
  {
    name: 'owner backfill',
    sql: `update public.notes set user_id = (select id from auth.users where email = '${ownerEmail}') where user_id is null;`,
  },
  { name: 'RLS cutover', sql: readMigration('20260813_auth_cutover.sql') },
  { name: 'usernames table', sql: readMigration('20260813_username_password_auth.sql') },
  { name: 'manual capture category', sql: readMigration('20260813_manual_capture_category.sql') },
]

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SQL step failed (HTTP ${res.status}): ${body.slice(0, 500)}`)
  }
}

async function applyViaManagementApi() {
  for (const step of SQL_STEPS) {
    process.stdout.write(`· ${step.name}... `)
    try {
      await runSql(step.sql)
      console.log('ok')
    } catch (error) {
      console.log('FAILED')
      throw error
    }
  }
}

function writeDashboardSql() {
  const combined = SQL_STEPS.map((step) => `-- ===== ${step.name} =====\n${step.sql}`).join('\n\n')
  const out = path.join(root, 'supabase', '_apply_auth_setup_pending.sql')
  writeFileSync(out, combined, 'utf8')
  console.log(`\nNo SUPABASE_ACCESS_TOKEN in .env.local — wrote ${out}\n` +
    'Open your Supabase project → SQL Editor → paste that file and run it, then run this script again with SUPABASE_ACCESS_TOKEN for the account setup.\n')
}

function listUsers() {
  return admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
}

async function ensureUser({ email, password, username, isDemo, setPassword }) {
  const { data: users } = await listUsers()
  const existing = users.users.find((u) => u.email === email)
  let userId
  if (existing) {
    userId = existing.id
    // Merge (not replace) metadata so existing keys like email_verified survive.
    const mergedMetadata = { ...(existing.user_metadata ?? {}), username, ...(isDemo ? { is_demo: true } : {}) }
    await admin.auth.admin.updateUserById(userId, { user_metadata: mergedMetadata })
    if (isDemo || setPassword) {
      // Keep the env-managed demo password in sync; only touch the owner
      // password when explicitly requested (avoids rotating it on re-runs).
      await admin.auth.admin.updateUserById(userId, { password })
    }
    console.log(`· ${email}: exists — username metadata ensured${isDemo || setPassword ? ', password set' : ''}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: isDemo ? { username, is_demo: true } : { username },
    })
    if (error) throw new Error(`createUser(${email}) failed: ${error.message}`)
    userId = data.user.id
    console.log(`· ${email}: created`)
  }
  await admin.from('usernames').upsert({ user_id: userId, username }, { onConflict: 'user_id' })
  return userId
}

function ensureEnvVar(key, value) {
  if (env[key]) return env[key]
  const line = `${key}=${value}`
  appendFileSync(envPath, `\n${line}\n`)
  console.log(`· added ${key} to .env.local`)
  return value
}

async function main() {
  const demoPassword = ensureEnvVar('NOTELINGS_DEMO_PASSWORD', randomBytes(18).toString('base64url'))
  ensureEnvVar('NOTELINGS_DEMO_EMAIL', demoEmail)

  if (accessToken) {
    await applyViaManagementApi()
  } else {
    writeDashboardSql()
    console.log('\nAccount setup (demo + owner password) requires the SQL above to be applied first.')
    process.exit(2)
  }

  // Account setup — requires the usernames table + notes.user_id to exist.
  const ownerUsername = ownerEmail.split('@')[0]
  const resetOwnerPassword = process.argv.includes('--reset-owner-password')
  const ownerPassword = resetOwnerPassword ? randomBytes(12).toString('base64url') : null
  await ensureUser({
    email: ownerEmail,
    password: ownerPassword,
    username: ownerUsername,
    isDemo: false,
    setPassword: resetOwnerPassword,
  })
  await ensureUser({ email: demoEmail, password: demoPassword, username: demoUsername, isDemo: true, setPassword: true })

  console.log('\n✔ Auth DB setup complete.')
  console.log(`\nYour private workspace (owner):\n  username: ${ownerUsername}\n  email:    ${ownerEmail}`)
  if (resetOwnerPassword) console.log(`  password: ${ownerPassword}`)
  else console.log('  password: unchanged (already set)')
  console.log('  (Change it anytime in Supabase Dashboard → Authentication → Users → reset password.)')
  console.log('\n  ⚠ This password was generated for you and printed only once — change it soon')
  console.log('  (Supabase Dashboard → Authentication → Users → edit → reset password).')
  console.log(`\nDemo workspace (shared):\n  username: ${demoUsername}\n  email:    ${demoEmail}\n  password: stored in .env.local (NOTELINGS_DEMO_PASSWORD)\n`)
  console.log('You can now sign in on http://localhost:3000 with the username + password above,')
  console.log('or click "Enter demo workspace" to use the shared demo account.')
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`)
  process.exit(1)
})
