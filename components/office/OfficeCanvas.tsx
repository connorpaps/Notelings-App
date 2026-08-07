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
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera }) => camera.lookAt(0, 1.5, 0)}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Isometric-friendly lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[18, 26, 12]}
        intensity={1.6}
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
      <hemisphereLight args={['#bfd4ff', '#1c1e24', 0.35]} />
      <VoxelOffice />
      <OrbitControls enablePan enableZoom minZoom={10} maxZoom={120} target={[0, 1.5, 0]} />
    </Canvas>
  )
}
