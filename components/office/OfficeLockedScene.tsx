'use client'

import { Suspense, useMemo } from 'react'
import OfficeModel from './OfficeModel'
import Floor from './Floor'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { getBuilderAssets, type BuilderItem } from './officeBuilderAssets'

function placementForItem(item: BuilderItem, assets: ReturnType<typeof getBuilderAssets>) {
  const asset = assets.find((candidate) => candidate.id === item.assetId)
  if (asset?.kind === 'model' && asset.obj && asset.mtl) {
    return {
      id: item.id,
      name: item.name,
      obj: asset.obj,
      mtl: asset.mtl,
      cell: [0, 0] as [number, number],
    }
  }
  if (item.sourcePlacementId) {
    const placement = assets.find((candidate) => candidate.sourcePlacementId === item.sourcePlacementId)
    if (placement?.obj && placement.mtl) {
      return {
        id: item.id,
        name: item.name,
        obj: placement.obj,
        mtl: placement.mtl,
        cell: [0, 0] as [number, number],
      }
    }
  }
  if (!asset) return null
  if (asset.kind !== 'model' || !asset.obj || !asset.mtl) return null
  return {
    id: item.id,
    name: item.name,
    obj: asset.obj,
    mtl: asset.mtl,
    cell: [0, 0] as [number, number],
  }
}

function LockedItem({ item, assets }: { item: BuilderItem; assets: ReturnType<typeof getBuilderAssets> }) {
  if (item.kind === 'floor') {
    return <Floor name={item.id} position={item.transform.position} rotation={item.transform.rotation} scale={item.transform.scale} />
  }

  if (item.kind === 'wall' && item.wall) {
    const isX = item.wall.axis === 'x'
    const length = item.wall.lenCells * 1.2
    const thickness = item.wall.thickness ?? 0.25
    return (
      <group name={item.id} position={item.transform.position} rotation={item.transform.rotation} scale={item.transform.scale}>
        <mesh name={item.wall.id} castShadow receiveShadow>
          <boxGeometry args={[isX ? length : thickness, item.wall.height, isX ? thickness : length]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.88} />
        </mesh>
      </group>
    )
  }

  const placement = placementForItem(item, assets)
  if (!placement) return null
  return <OfficeModel placement={placement} name={item.id} transform={item.transform} />
}

export default function OfficeLockedScene() {
  const assets = useMemo(() => getBuilderAssets(), [])
  return (
    <group name="locked-office-scene">
      <Suspense fallback={null}>
        {LOCKED_DEFAULT_ITEMS.map((item) => <LockedItem key={item.id} item={item} assets={assets} />)}
      </Suspense>
    </group>
  )
}
