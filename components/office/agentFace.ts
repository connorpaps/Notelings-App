'use client'
import * as THREE from 'three'
import type { AgentState } from './agentState'
import { FACE_STYLES } from './agentState'

export const FACE_TEXTURE_SIZE = 256

/** Draw one state's LCD face onto a 2D canvas and return a CanvasTexture. */
export function createFaceTexture(state: AgentState, size = FACE_TEXTURE_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const style = FACE_STYLES[state]
  const pad = size * 0.06
  ctx.fillStyle = '#06090d' // bezel
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = style.screen // screen
  ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2)

  const [left, right] = style.glyph.split(' ')
  ctx.font = `bold ${Math.floor(size * 0.34)}px Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style.ink
  ctx.shadowColor = style.glow
  ctx.shadowBlur = size * 0.06
  ctx.fillText(left, size / 3, size / 2)
  ctx.fillText(right, (size * 2) / 3, size / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
