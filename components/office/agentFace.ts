'use client'
import * as THREE from 'three'
import type { AgentState } from './agentState'
import { FACE_STYLES } from './agentState'

export const FACE_TEXTURE_SIZE = 256

/**
 * Draw one state's LCD face onto a fully opaque 2D canvas and return a
 * CanvasTexture. The screen is light with dark glyphs so the expression reads
 * clearly at diorama scale through tone mapping and SSAO.
 */
export function createFaceTexture(state: AgentState, size = FACE_TEXTURE_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const style = FACE_STYLES[state]
  const pad = Math.round(size * 0.07)
  // Bezel, then screen — both fully painted so the texture is opaque.
  ctx.fillStyle = '#0b1016'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = style.screen
  ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2)

  // The two glyph characters (e.g. '^ ^' → '^' + '^') with a soft glow.
  const [left, right] = style.glyph.split(' ')
  ctx.font = `bold ${Math.floor(size * 0.42)}px Consolas, "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style.ink
  ctx.shadowColor = style.glow
  ctx.shadowBlur = Math.floor(size * 0.09)
  const midY = size / 2 + size * 0.02
  ctx.fillText(left, size * 0.33, midY)
  ctx.fillText(right, size * 0.67, midY)
  ctx.shadowBlur = 0

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // Canvas textures are power-of-two here; linear filters avoid mipmap upload surprises.
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}
