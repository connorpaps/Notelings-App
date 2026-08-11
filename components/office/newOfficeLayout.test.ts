import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { NEW_OFFICE_MODEL_PATH, NEW_OFFICE_RECENTER } from './newOfficeLayout'

// Node shims so GLTFLoader can parse the GLB without a browser (same as
// scripts/generate-new-office-grid.mjs).
;(globalThis as unknown as { self: unknown }).self = globalThis

class FakeImage {
  width = 1
  height = 1
  private srcValue = ''
  onload: (() => void) | null = null

  set src(v: string) {
    this.srcValue = v
    setTimeout(() => this.onload?.(), 0)
  }
  get src() {
    return this.srcValue
  }
}
;(globalThis as unknown as { Image: unknown }).Image = FakeImage
;(globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = async () => ({ width: 1, height: 1 })

const PUBLIC_MODEL_PATH = NEW_OFFICE_MODEL_PATH.replace(/^\//, 'public/')

function measureCenter(): Promise<THREE.Vector3> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.parse(
      readFileSync(PUBLIC_MODEL_PATH).buffer as ArrayBuffer,
      '',
      (gltf) => {
        gltf.scene.updateMatrixWorld(true)
        resolve(new THREE.Box3().setFromObject(gltf.scene).getCenter(new THREE.Vector3()))
      },
      (error) => reject(error),
    )
  })
}

describe('new office layout constants', () => {
  it('matches the GLB bbox center (recenter offset stays in sync with the grid)', async () => {
    const c = await measureCenter()
    expect(c.x).toBeCloseTo(-NEW_OFFICE_RECENTER[0], 1)
    expect(c.z).toBeCloseTo(-NEW_OFFICE_RECENTER[2], 1)
  })
})
