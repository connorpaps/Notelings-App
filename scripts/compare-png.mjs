import fs from 'node:fs/promises'
import process from 'node:process'
import { inflateSync } from 'node:zlib'

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

async function decodePng(filePath) {
  const data = await fs.readFile(filePath)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!data.subarray(0, 8).equals(signature)) throw new Error(`${filePath} is not a PNG`)

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []
  while (offset < data.length) {
    const length = data.readUInt32BE(offset)
    const type = data.toString('ascii', offset + 4, offset + 8)
    const body = data.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      bitDepth = body[8]
      colorType = body[9]
    } else if (type === 'IDAT') {
      idat.push(body)
    } else if (type === 'IEND') {
      break
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`${filePath} uses unsupported PNG format bitDepth=${bitDepth} colorType=${colorType}`)
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3
  const rowLength = width * bytesPerPixel
  const raw = inflateSync(Buffer.concat(idat))
  const pixels = Buffer.alloc(width * height * 4)
  let rawOffset = 0
  let previous = Buffer.alloc(rowLength)

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++]
    const row = Buffer.from(raw.subarray(rawOffset, rawOffset + rowLength))
    rawOffset += rowLength
    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0
      const up = previous[x]
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0
      if (filter === 1) row[x] = (row[x] + left) & 255
      else if (filter === 2) row[x] = (row[x] + up) & 255
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) row[x] = (row[x] + paeth(left, up, upperLeft)) & 255
      else if (filter !== 0) throw new Error(`${filePath} uses unsupported filter ${filter}`)
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * bytesPerPixel
      const target = (y * width + x) * 4
      pixels[target] = row[source]
      pixels[target + 1] = row[source + 1]
      pixels[target + 2] = row[source + 2]
      pixels[target + 3] = colorType === 6 ? row[source + 3] : 255
    }
    previous = row
  }

  return { width, height, pixels }
}

const [beforePath, afterPath] = process.argv.slice(2)
if (!beforePath || !afterPath) throw new Error('Usage: node scripts/compare-png.mjs <before.png> <after.png>')

const [before, after] = await Promise.all([decodePng(beforePath), decodePng(afterPath)])
if (before.width !== after.width || before.height !== after.height) {
  throw new Error(`Image dimensions differ: ${before.width}x${before.height} vs ${after.width}x${after.height}`)
}

let absoluteError = 0
let changedPixels = 0
let alphaZeroBefore = 0
let alphaZeroAfter = 0
let maxChannelError = 0
const pixelCount = before.width * before.height
for (let index = 0; index < before.pixels.length; index += 4) {
  const redError = Math.abs(before.pixels[index] - after.pixels[index])
  const greenError = Math.abs(before.pixels[index + 1] - after.pixels[index + 1])
  const blueError = Math.abs(before.pixels[index + 2] - after.pixels[index + 2])
  const alphaError = Math.abs(before.pixels[index + 3] - after.pixels[index + 3])
  const error = redError + greenError + blueError + alphaError
  absoluteError += error
  maxChannelError = Math.max(maxChannelError, redError, greenError, blueError, alphaError)
  if (error > 24) changedPixels += 1
  if (before.pixels[index + 3] === 0) alphaZeroBefore += 1
  if (after.pixels[index + 3] === 0) alphaZeroAfter += 1
}

console.log(JSON.stringify({
  before: beforePath,
  after: afterPath,
  width: before.width,
  height: before.height,
  meanAbsoluteChannelError: absoluteError / (pixelCount * 4),
  changedPixelRatio: changedPixels / pixelCount,
  maxChannelError,
  alphaZeroBefore,
  alphaZeroAfter,
}, null, 2))
