import { stat } from 'node:fs/promises'

const assetPath = 'public/models/3D_Note_Office_2/3d_note_office.glb'
const maxBytes = 4 * 1024 * 1024
const size = (await stat(assetPath)).size

console.log(`${assetPath}: ${(size / 1024 / 1024).toFixed(2)} MB`)
if (size > maxBytes) {
  console.error(`Asset exceeds the ${maxBytes / 1024 / 1024} MB budget.`)
  process.exit(1)
}
