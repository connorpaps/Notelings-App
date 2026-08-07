'use client'
import { Grid } from '@react-three/drei'

export default function Floor() {
  return (
    <group>
      {/* Solid ground so shadows have something to land on (light gray per preview) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#c9cace" />
      </mesh>
      {/* Subtle grid overlay (nav-grid debugging aid for Milestone 2) */}
      <Grid
        position={[0, 0, 0]}
        args={[40, 40]}
        cellSize={1.2}
        cellThickness={0.35}
        cellColor="#b4b6bc"
        sectionSize={6}
        sectionThickness={0.8}
        sectionColor="#9ea1a9"
        fadeDistance={60}
        infiniteGrid
      />
    </group>
  )
}
