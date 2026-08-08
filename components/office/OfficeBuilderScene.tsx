'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { TransformControls as TransformControlsImpl } from 'three-stdlib'
import OfficeModel from './OfficeModel'
import { PLACEMENTS, type ModelPlacement } from './officeLayout'
import { useOfficeBuilder } from './OfficeBuilderContext'
import type { BuilderItem } from './officeBuilderAssets'
import Floor from './Floor'

function placementForItem(item: BuilderItem, assets: ReturnType<typeof useOfficeBuilder>['assets']): ModelPlacement | null {
  const asset = assets.find((candidate) => candidate.id === item.assetId)
  if (asset?.kind === 'model' && asset.obj && asset.mtl) {
    return {
      id: item.id,
      name: item.name,
      obj: asset.obj,
      mtl: asset.mtl,
      cell: [0, 0],
      mount: asset.defaultMount,
    }
  }

  if (item.sourcePlacementId) {
    const placement = PLACEMENTS.find((candidate) => candidate.id === item.sourcePlacementId)
    if (placement) return placement
  }

  if (!asset) return null
  if (asset.kind !== 'model' || !asset.obj || !asset.mtl) return null
  return {
    id: item.id,
    name: item.name,
    obj: asset.obj,
    mtl: asset.mtl,
    cell: [0, 0],
    mount: asset.defaultMount,
  }
}

function syncTransform(object: THREE.Object3D | null, item: BuilderItem, updateTransform: ReturnType<typeof useOfficeBuilder>['updateTransform']) {
  if (!object) return
  updateTransform(item.id, {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  })
}

type RegisterObject = (id: string, object: THREE.Group | null) => void

function EditableItem({ item, registerObject }: { item: BuilderItem; registerObject: RegisterObject }) {
  const { assets, selectedId, selectItem, consumeSuppressedClick } = useOfficeBuilder()
  const setObjectRef = useCallback((object: THREE.Group | null) => registerObject(item.id, object), [item.id, registerObject])
  const selected = selectedId === item.id

  const onSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (consumeSuppressedClick() || event.delta > 2) return
    selectItem(item.id)
  }

  if (item.kind === 'floor') {
    return (
      <Floor
        name={item.id}
        position={item.transform.position}
        rotation={item.transform.rotation}
        scale={item.transform.scale}
        groupRef={setObjectRef}
        selected={selected}
        builderItemId={item.id}
        onSelect={onSelect}
      />
    )
  }

  if (item.kind === 'wall' && item.wall) {
    const isX = item.wall.axis === 'x'
    const length = item.wall.lenCells * 1.2
    const thickness = item.wall.thickness ?? 0.25
    return (
      <group
        ref={setObjectRef}
        name={item.id}
        position={item.transform.position}
        rotation={item.transform.rotation}
        scale={item.transform.scale}
        onClick={onSelect}
        userData={{ notelingsBuilderItemId: item.id, notelingsRole: 'wall', notelingsWallId: item.wall.id, notelingsSelected: selected }}
      >
        <mesh name={item.wall.id} castShadow receiveShadow userData={{ notelingsWallId: item.wall.id }}>
          <boxGeometry args={[isX ? length : thickness, item.wall.height, isX ? thickness : length]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.88} />
        </mesh>
      </group>
    )
  }

  if (item.kind === 'divider') {
    return (
      <group
        ref={setObjectRef}
        name={item.id}
        position={item.transform.position}
        rotation={item.transform.rotation}
        scale={item.transform.scale}
        onClick={onSelect}
        userData={{ notelingsBuilderItemId: item.id, notelingsRole: 't-divider', notelingsSelected: selected }}
      >
        <mesh name="divider-horizontal" position={[0, 1.15, -0.9]} castShadow receiveShadow>
          <boxGeometry args={[5.2, 2.3, 0.14]} />
          <meshStandardMaterial color="#f1f2f1" roughness={0.86} />
        </mesh>
        <mesh name="divider-desk-stem" position={[0, 1.15, 0.14]} castShadow receiveShadow>
          <boxGeometry args={[1.55, 2.3, 1.15]} />
          <meshStandardMaterial color="#f1f2f1" roughness={0.86} />
        </mesh>
      </group>
    )
  }

  const placement = placementForItem(item, assets)
  if (!placement) return null
  return (
    <OfficeModel
      placement={placement}
      name={item.id}
      transform={item.transform}
      groupRef={setObjectRef}
      selected={selected}
      onSelect={onSelect}
    />
  )
}

function BuilderTransformGizmo({ target, item }: { target: THREE.Group; item: BuilderItem }) {
  const { transformMode, updateTransform, setTransformDragging, clearSuppressedClick } = useOfficeBuilder()
  const invalidate = useThree((state) => state.invalidate)
  const controlsRef = useRef<TransformControlsImpl>(null)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const onDraggingChanged = (event: { value: boolean }) => {
      setTransformDragging(event.value)
      if (!event.value) syncTransform(target, item, updateTransform)
    }
    const onChange = () => invalidate()
    const eventTarget = controls as unknown as {
      addEventListener: (type: string, listener: (event: { value: boolean }) => void) => void
      removeEventListener: (type: string, listener: (event: { value: boolean }) => void) => void
    }
    eventTarget.addEventListener('dragging-changed', onDraggingChanged)
    eventTarget.addEventListener('change', onChange)
    return () => {
      eventTarget.removeEventListener('dragging-changed', onDraggingChanged)
      eventTarget.removeEventListener('change', onChange)
      clearSuppressedClick()
    }
  }, [clearSuppressedClick, invalidate, item, setTransformDragging, target, updateTransform])

  return <TransformControls ref={controlsRef} object={target} mode={transformMode} />
}

export default function OfficeBuilderScene() {
  const { items, selectedId } = useOfficeBuilder()
  const [registeredObjects, setRegisteredObjects] = useState<Record<string, THREE.Group>>({})
  const registerObject = useCallback<RegisterObject>((id, object) => {
    setRegisteredObjects((current) => {
      if (object && current[id] === object) return current
      if (!object && !(id in current)) return current
      if (object) return { ...current, [id]: object }
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])
  const selectedItem = items.find((item) => item.id === selectedId) ?? null
  const selectedObject = selectedId ? registeredObjects[selectedId] ?? null : null

  return (
    <group name="office-builder-scene">
      <Suspense fallback={null}>
        <group name="office-walls">
          {items.filter((item) => item.kind === 'wall').map((item) => <EditableItem key={item.id} item={item} registerObject={registerObject} />)}
        </group>
        <group name="office-builder-items" userData={{ notelingsRole: 'builder-items', notelingsItemCount: items.length }}>
          {items.filter((item) => item.kind !== 'wall').map((item) => <EditableItem key={item.id} item={item} registerObject={registerObject} />)}
        </group>
        {selectedItem && selectedObject && <BuilderTransformGizmo key={selectedItem.id} target={selectedObject} item={selectedItem} />}
      </Suspense>
    </group>
  )
}
