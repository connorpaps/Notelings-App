'use client'

import { useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, SSAO, ToneMapping } from '@react-three/postprocessing'
import NewOfficeScene from './NewOfficeScene'
import {
  getBrowserRenderCapabilities,
  OFFICE_RENDER_PROFILES,
  resolveOfficeRenderQuality,
  type OfficeRenderProfile,
} from './renderProfile'

const CAMERA_POSITION: [number, number, number] = [24, 22, 24]
// Re-framed for the 10 m GLB office (2026-08-10 swap): zoom raised so the
// smaller floor fills the frame like the legacy 21.6×16.8 m office did.
const CAMERA_TARGET: [number, number, number] = [0, 1, 0]
// Tighter framing so the office reads about 20% larger in the app.
// Orthographic screen size is proportional to zoom, so 72 * 1.2 ≈ 86.
const CAMERA_ZOOM = 86
const CAMERA_NEAR = -100
const CAMERA_FAR = 300

// Keep the high profile exported as the approved desktop reference. Runtime
// QA exposes the selected profile, which may be balanced on constrained devices.
export const OFFICE_RENDER_PROFILE = OFFICE_RENDER_PROFILES.high

// High quality is the approved desktop visual baseline. The balanced profile is
// selected only for coarse-pointer/low-capability devices or an explicit local
// override. Both profiles cap DPR at 1 because the composer multiplies pixel cost.

type OfficeCanvasProps = {
  onPointerMissed?: () => void
}

type CameraProfile = {
  position: [number, number, number]
  target: [number, number, number]
  zoom: number
  near: number
  far: number
  controls: false
  frameloop: 'always'
}

export default function OfficeCanvas({ onPointerMissed }: OfficeCanvasProps) {
  const [renderQuality] = useState(() => resolveOfficeRenderQuality(
    getBrowserRenderCapabilities(),
    process.env.NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY as 'high' | 'balanced' | 'auto' | undefined,
  ))
  const renderProfile: OfficeRenderProfile = OFFICE_RENDER_PROFILES[renderQuality]

  return (
    <Canvas
      orthographic
      camera={{ position: CAMERA_POSITION, zoom: CAMERA_ZOOM, near: CAMERA_NEAR, far: CAMERA_FAR }}
      shadows={renderProfile.shadows ? 'soft' : false}
      dpr={renderProfile.dpr}
      frameloop={renderProfile.frameloop}
      gl={{
        antialias: true,
        alpha: true,
        // Kept true only for e2e pixel sampling (corner-alpha + readPixels);
        // normal runs omit it to avoid the extra GPU memory copy. See
        // playwright.config.ts webServer.env.
        preserveDrawingBuffer: process.env.NEXT_PUBLIC_PRESERVE_DRAWING_BUFFER === '1',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: renderProfile.toneMappingExposure,
      }}
      onCreated={({ camera, scene, gl }) => {
        camera.lookAt(...CAMERA_TARGET)
        if (typeof window !== 'undefined') {
          ;(window as unknown as {
            __NOTELINGS_SCENE__: typeof scene
            __NOTELINGS_CAMERA__: typeof camera
            __NOTELINGS_RENDERER__: typeof gl
            __NOTELINGS_CAMERA_PROFILE__: CameraProfile
            __NOTELINGS_RENDER_PROFILE__: OfficeRenderProfile
          }).__NOTELINGS_SCENE__ = scene
          ;(window as unknown as { __NOTELINGS_CAMERA__: typeof camera }).__NOTELINGS_CAMERA__ = camera
          ;(window as unknown as { __NOTELINGS_RENDERER__: typeof gl }).__NOTELINGS_RENDERER__ = gl
          ;(window as unknown as { __NOTELINGS_CAMERA_PROFILE__: CameraProfile }).__NOTELINGS_CAMERA_PROFILE__ = {
            position: [...CAMERA_POSITION],
            target: [...CAMERA_TARGET],
            zoom: CAMERA_ZOOM,
            near: CAMERA_NEAR,
            far: CAMERA_FAR,
            controls: false,
            frameloop: renderProfile.frameloop,
          }
          ;(window as unknown as { __NOTELINGS_RENDER_PROFILE__: OfficeRenderProfile }).__NOTELINGS_RENDER_PROFILE__ = renderProfile
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
        shadow-mapSize-width={renderProfile.shadowMapSize[0]}
        shadow-mapSize-height={renderProfile.shadowMapSize[1]}
        shadow-camera-left={-renderProfile.shadowCascade}
        shadow-camera-right={renderProfile.shadowCascade}
        shadow-camera-top={renderProfile.shadowCascade}
        shadow-camera-bottom={-renderProfile.shadowCascade}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <hemisphereLight name="office-fill" args={['#d8eeee', '#34504f', 0.32]} />
      <NewOfficeScene />
      {renderProfile.postprocessing && (
        <EffectComposer enableNormalPass>
          <SSAO {...renderProfile.ssao} />
          <Bloom {...renderProfile.bloom} />
          <ToneMapping />
        </EffectComposer>
      )}
    </Canvas>
  )
}
