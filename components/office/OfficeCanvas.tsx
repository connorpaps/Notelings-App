'use client'

import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, SSAO, ToneMapping } from '@react-three/postprocessing'
import VoxelOffice from './VoxelOffice'

const SHADOW_MAP_SIZE = 4096
const TONE_MAPPING_EXPOSURE = 1.2
const BLOOM_PROPS = {
  luminanceThreshold: 1,
  intensity: 0.2,
} as const
const SHADOW_CASCADE = 30
const CAMERA_POSITION: [number, number, number] = [24, 22, 24]
const CAMERA_TARGET: [number, number, number] = [0, 1.5, 0]
const CAMERA_ZOOM = 38
const CAMERA_NEAR = -100
const CAMERA_FAR = 300

const SSAO_PROPS = {
  radius: 2.4,
  intensity: 2,
  samples: 32,
  rings: 4,
  bias: 0.3,
  luminanceInfluence: 0.65,
} as const

// The composer owns the final tone-mapping pass. Keep its installed default
// here because the explicit ACES override washed out the approved color palette.
// M4.2 reskin: the opaque teal scene background was removed so the looping
// video behind the transparent canvas shows through around the office.

export const OFFICE_RENDER_PROFILE = {
  frameloop: 'always' as const,
  shadows: true as const,
  shadowMapSize: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE] as [number, number],
  postprocessing: true as const,
  toneMappingMode: null,
  toneMappingExposure: TONE_MAPPING_EXPOSURE,
  bloom: { luminanceThreshold: BLOOM_PROPS.luminanceThreshold, intensity: BLOOM_PROPS.intensity },
  ssao: { samples: SSAO_PROPS.samples, rings: SSAO_PROPS.rings, intensity: SSAO_PROPS.intensity },
} as const

type OfficeCanvasProps = {
  onPointerMissed?: () => void
}

export default function OfficeCanvas({ onPointerMissed }: OfficeCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: CAMERA_POSITION, zoom: CAMERA_ZOOM, near: CAMERA_NEAR, far: CAMERA_FAR }}
      shadows="soft"
      // Cap the backbuffer at CSS resolution: on Retina displays this halves
      // the pixels processed by the transparent canvas and its composer passes
      // while preserving the scene's geometry, lighting, and texture quality.
      dpr={[1, 2]}
      frameloop="always"
      gl={{
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: TONE_MAPPING_EXPOSURE,
      }}
      onCreated={({ camera, scene, gl }) => {
        camera.lookAt(...CAMERA_TARGET)
        if (typeof window !== 'undefined') {
          ;(window as unknown as {
            __NOTELINGS_SCENE__: typeof scene
            __NOTELINGS_CAMERA__: typeof camera
            __NOTELINGS_RENDERER__: typeof gl
            __NOTELINGS_CAMERA_PROFILE__: {
              position: [number, number, number]
              target: [number, number, number]
              zoom: number
              near: number
              far: number
              controls: false
              frameloop: 'always'
            }
            __NOTELINGS_RENDER_PROFILE__: typeof OFFICE_RENDER_PROFILE
          }).__NOTELINGS_SCENE__ = scene
          ;(window as unknown as { __NOTELINGS_CAMERA__: typeof camera }).__NOTELINGS_CAMERA__ = camera
          ;(window as unknown as { __NOTELINGS_RENDERER__: typeof gl }).__NOTELINGS_RENDERER__ = gl
          ;(window as unknown as {
            __NOTELINGS_CAMERA_PROFILE__: {
              position: [number, number, number]
              target: [number, number, number]
              zoom: number
              near: number
              far: number
              controls: false
              frameloop: 'always'
            }
          }).__NOTELINGS_CAMERA_PROFILE__ = {
            position: [...CAMERA_POSITION],
            target: [...CAMERA_TARGET],
            zoom: CAMERA_ZOOM,
            near: CAMERA_NEAR,
            far: CAMERA_FAR,
            controls: false,
            frameloop: 'always',
          }
          ;(window as unknown as {
            __NOTELINGS_RENDER_PROFILE__: typeof OFFICE_RENDER_PROFILE
          }).__NOTELINGS_RENDER_PROFILE__ = OFFICE_RENDER_PROFILE
        }
      }}
      style={{ width: '100%', height: '100%' }}
      onPointerMissed={onPointerMissed}
    >
      <ambientLight name="office-ambient" intensity={0.5} color="#e3eeee" />
      <directionalLight
        name="office-key"
        position={[10, 20, 10]}
        intensity={3.0}
        color="#fff8ed"
        castShadow
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-left={-SHADOW_CASCADE}
        shadow-camera-right={SHADOW_CASCADE}
        shadow-camera-top={SHADOW_CASCADE}
        shadow-camera-bottom={-SHADOW_CASCADE}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <hemisphereLight name="office-fill" args={['#d8eeee', '#34504f', 0.32]} />
      <VoxelOffice />
      <EffectComposer enableNormalPass>
        <SSAO {...SSAO_PROPS} />
        <Bloom {...BLOOM_PROPS} />
        <ToneMapping />
      </EffectComposer>
    </Canvas>
  )
}
