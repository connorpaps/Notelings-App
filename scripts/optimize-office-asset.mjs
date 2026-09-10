import { mkdir, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const input = process.argv[2]
const output = resolve('public/models/3D_Note_Office_2/3d_note_office.glb')

if (!input) {
  console.error('Usage: npm run optimize:office -- path/to/source.glb')
  process.exit(1)
}

const source = resolve(input)
if (source === output) {
  console.error('Refusing to optimize in place. Provide an uncompressed source GLB as the input.')
  process.exit(1)
}

await mkdir(dirname(output), { recursive: true })
const temporaryOutput = `${output}.tmp.glb`
const cliPath = resolve('node_modules/@gltf-transform/cli/bin/cli.js')
const result = spawnSync(process.execPath, [cliPath,
  'optimize', source, temporaryOutput,
  '--compress', 'meshopt',
  '--simplify', 'false',
  '--texture-compress', 'webp',
  '--texture-size', '1024',
  '--join', 'false',
  '--instance', 'false',
], { stdio: 'inherit', shell: false })

if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? `gltf-transform exited with status ${result.status}`)
  process.exit(result.status || 1)
}

await rename(temporaryOutput, output)
console.log(`Optimized office asset written to ${output}`)
