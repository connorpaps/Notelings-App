import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { NEW_OFFICE_FLOOR, NEW_OFFICE_MODEL_PATH, NEW_OFFICE_RECENTER } from './newOfficeLayout'

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

function createLoader() {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  return loader
}

function measureFloor(): Promise<{ topY: number; minX: number; maxX: number; minZ: number; maxZ: number }> {
  return new Promise((resolve, reject) => {
    const loader = createLoader()
    loader.parse(
      readFileSync(PUBLIC_MODEL_PATH).buffer as ArrayBuffer,
      '',
      (gltf) => {
        gltf.scene.updateMatrixWorld(true)
        const found: THREE.Box3[] = []
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh || found.length > 0) return
          const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
          if (m?.name === 'floor.001') found.push(new THREE.Box3().setFromObject(mesh))
        })
        if (found.length === 0) {
          reject(new Error('floor.001 mesh not found in the GLB'))
          return
        }
        const box = found[0]
        resolve({
          topY: box.max.y,
          minX: box.min.x + NEW_OFFICE_RECENTER[0],
          maxX: box.max.x + NEW_OFFICE_RECENTER[0],
          minZ: box.min.z + NEW_OFFICE_RECENTER[2],
          maxZ: box.max.z + NEW_OFFICE_RECENTER[2],
        })
      },
      (error) => reject(error),
    )
  })
}

function measureCenter(): Promise<THREE.Vector3> {
  return new Promise((resolve, reject) => {
    const loader = createLoader()
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

  it('matches the GLB floor slab (top surface + footprint, used by the debug overlay)', async () => {
    const floor = await measureFloor()
    expect(floor.topY).toBeCloseTo(NEW_OFFICE_FLOOR.topY, 2)
    expect(floor.minX).toBeCloseTo(NEW_OFFICE_FLOOR.minX, 1)
    expect(floor.maxX).toBeCloseTo(NEW_OFFICE_FLOOR.maxX, 1)
    expect(floor.minZ).toBeCloseTo(NEW_OFFICE_FLOOR.minZ, 1)
    expect(floor.maxZ).toBeCloseTo(NEW_OFFICE_FLOOR.maxZ, 1)
  })
})
