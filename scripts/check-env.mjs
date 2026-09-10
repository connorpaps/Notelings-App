import { readFile } from 'node:fs/promises'

const mode = process.argv[2] ?? 'all'
const envPath = '.env.local'
const contents = await readFile(envPath, 'utf8').catch(() => '')
const configured = new Set(
  contents
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/)?.[1])
    .filter((name) => name),
)

const requirements = {
  private: [
    'PRIVATE_SUPABASE_URL',
    'PRIVATE_SUPABASE_ANON_KEY',
    'PRIVATE_SUPABASE_SERVICE_ROLE_KEY',
  ],
  demo: [
    'DEMO_SUPABASE_URL',
    'DEMO_SUPABASE_ANON_KEY',
    'DEMO_SUPABASE_SERVICE_ROLE_KEY',
    'NOTELINGS_DEMO_EMAIL',
    'NOTELINGS_DEMO_PASSWORD',
  ],
}

const modes = mode === 'private' || mode === 'demo' ? [mode] : ['private', 'demo']
let missingCount = 0
for (const selectedMode of modes) {
  const missing = requirements[selectedMode].filter((name) => !configured.has(name))
  missingCount += missing.length
  console.log(`${selectedMode}: ${missing.length === 0 ? 'ready' : `missing ${missing.join(', ')}`}`)
}

if (missingCount > 0) {
  console.error(`Environment check failed for ${missingCount} variable(s). Values are intentionally never printed.`)
  process.exit(1)
}
