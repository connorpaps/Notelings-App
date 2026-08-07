'use client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import VoxelOffice from './VoxelOffice'

export default function OfficeCanvas() {
  return (
    <Canvas
      orthographic
      camera={{ position: [24, 22, 24], zoom: 38, near: -100, far: 300 }}
      shadows
      dpr={[1, 2]}
      frameloop="demand"
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }} // preserveDrawingBuffer: screenshots/e2e capture
      onCreated={({ camera, scene }) => {
        camera.lookAt(0, 1.5, 0)
        // Read-only scene handle: used by e2e tests (scene-graph audit) and
        // Milestone 2+ debugging/pathfinding targets.
        if (typeof window !== 'undefined') {
          ;(window as unknown as { __NOTELINGS_SCENE__: typeof scene; __NOTELINGS_CAMERA__: typeof camera }).__NOTELINGS_SCENE__ = scene
          ;(window as unknown as { __NOTELINGS_CAMERA__: typeof camera }).__NOTELINGS_CAMERA__ = camera
        }
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Isometric-friendly lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[18, 26, 12]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <hemisphereLight args={['#bfd4ff', '#1c1e24', 0.3]} />
      <VoxelOffice />
      <OrbitControls enablePan enableZoom minZoom={10} maxZoom={120} target={[0, 1.5, 0]} />
    </Canvas>
  )
}
