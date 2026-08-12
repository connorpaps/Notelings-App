'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { OFFICE_CENTER, PLACEMENTS } from './officeLayout'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import {
  getBuilderAssets,
  type BuilderAsset,
  type BuilderItem,
  type BuilderTransform,
} from './officeBuilderAssets'

export {
  getBuilderAssets,
  type BuilderAsset,
  type BuilderCategory,
  type BuilderItem,
  type BuilderTransform,
} from './officeBuilderAssets'

export const BUILDER_STORAGE_KEY = 'notelings-office-builder-v4'
export const BUILDER_EXPORT_STORAGE_KEY = 'notelings-office-builder-json-v1'

type BuilderContextValue = {
  assets: BuilderAsset[]
  items: BuilderItem[]
  selectedId: string | null
  selectedItem: BuilderItem | null
  transformMode: 'translate' | 'rotate'
  hydrated: boolean
  selectItem: (id: string | null) => void
  setTransformDragging: (dragging: boolean) => void
  clearSuppressedClick: () => void
  consumeSuppressedClick: () => boolean
  setTransformMode: (mode: 'translate' | 'rotate') => void
  spawnAsset: (assetId: string) => void
  updateTransform: (id: string, transform: Partial<BuilderTransform>) => void
  duplicateItem: (id: string) => void
  deleteItem: (id: string) => void
  clearScene: () => void
  resetScene: () => void
  exportScene: () => string
}

const BuilderContext = createContext<BuilderContextValue | null>(null)

function cloneTransform(transform: BuilderTransform): BuilderTransform {
  return {
    position: [...transform.position] as [number, number, number],
    rotation: [...transform.rotation] as [number, number, number],
    scale: [...transform.scale] as [number, number, number],
  }
}

function cloneBuilderItem(item: BuilderItem): BuilderItem {
  return {
    ...item,
    transform: cloneTransform(item.transform),
    wall: item.wall ? { ...item.wall, cell: [...item.wall.cell] as [number, number] } : undefined,
  }
}

/** Return independent copies so Reset cannot mutate the checked-in baseline. */
export function getInitialBuilderItems(): BuilderItem[] {
  return LOCKED_DEFAULT_ITEMS.map(cloneBuilderItem)
}

function isBuilderItem(value: unknown, assets: BuilderAsset[]): value is BuilderItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<BuilderItem>
  const transform = item.transform as Partial<BuilderTransform> | undefined
  const asset = assets.find((candidate) => candidate.id === item.assetId)
  const validVector = (vector: unknown): vector is [number, number, number] =>
    Array.isArray(vector) && vector.length === 3 && vector.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  const sourcePlacement = item.kind === 'model' && typeof item.sourcePlacementId === 'string'
    ? PLACEMENTS.find((placement) => placement.id === item.sourcePlacementId)
    : undefined
  const wallMatchesAsset = item.kind !== 'wall'
    || Boolean(
      item.wall
      && asset?.wall
      && item.wall.id === asset.wall.id
      && item.wall.axis === asset.wall.axis
      && item.wall.lenCells === asset.wall.lenCells
      && item.wall.cell[0] === asset.wall.cell[0]
      && item.wall.cell[1] === asset.wall.cell[1]
      && item.wall.height === asset.wall.height
      && item.wall.thickness === asset.wall.thickness,
    )
  const modelMatchesAsset = item.kind !== 'model'
    || Boolean(
      asset?.obj
      && asset.mtl
      && (!sourcePlacement || (sourcePlacement.obj === asset.obj && sourcePlacement.mtl === asset.mtl)),
    )
  return typeof item.id === 'string'
    && typeof item.assetId === 'string'
    && Boolean(asset)
    && item.kind === asset?.kind
    && typeof item.name === 'string'
    && (item.kind !== 'floor' || (item.id === 'office-floor' && item.sourcePlacementId === 'office-floor'))
    && modelMatchesAsset
    && wallMatchesAsset
    && Boolean(transform && validVector(transform.position) && validVector(transform.rotation) && validVector(transform.scale))
}

function readStoredItems(assets: BuilderAsset[], initialItems: BuilderItem[]): BuilderItem[] | null {
  try {
    const raw = window.localStorage.getItem(BUILDER_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every((item) => isBuilderItem(item, assets))) return null

    const floorItems = parsed.filter((item) => item.kind === 'floor')
    const initialFloor = initialItems.find((item) => item.kind === 'floor')
    const withoutExtraFloors = floorItems.length > 1
      ? [...parsed.filter((item) => item.kind !== 'floor'), floorItems[0]]
      : parsed
    if (floorItems.length === 0 && initialFloor) return [...withoutExtraFloors, initialFloor]
    return withoutExtraFloors
  } catch {
    return null
  }
}

function newInstanceId(assetId: string): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${assetId.slice(0, 24)}-${suffix}`
}

export function OfficeBuilderProvider({ children }: { children: ReactNode }) {
  const assets = useMemo(() => getBuilderAssets(), [])
  const initialItems = useMemo(() => getInitialBuilderItems(), [])
  const [items, setItems] = useState<BuilderItem[]>(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('translate')
  const [hydrated, setHydrated] = useState(process.env.NODE_ENV === 'production')
  const [persistenceEnabled, setPersistenceEnabled] = useState(process.env.NODE_ENV === 'production')
  const suppressNextClickRef = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const clearStaleSuppression = () => {
      // A new pointer sequence means any prior drag-release guard is stale.
      // The release click itself has no preceding pointerdown, so it remains
      // suppressed until it is consumed by the scene or an item.
      suppressNextClickRef.current = false
    }
    window.addEventListener('pointerdown', clearStaleSuppression)
    return () => window.removeEventListener('pointerdown', clearStaleSuppression)
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    let raw: string | null = null
    let storageReadable = true
    try {
      raw = window.localStorage.getItem(BUILDER_STORAGE_KEY)
    } catch {
      storageReadable = false
    }
    const stored = readStoredItems(assets, initialItems)
    window.setTimeout(() => {
      if (stored) setItems(stored)
      // Never replace malformed/unreadable existing data automatically. A
      // later explicit builder action can intentionally establish a new save.
      // The v3 scene remains untouched as a manual rollback/backup; it is not
      // loaded because this v4 baseline is an intentional new default.
      setPersistenceEnabled(storageReadable && (!raw || Boolean(stored)))
      setHydrated(true)
    }, 0)
  }, [assets, initialItems])

  useEffect(() => {
    if (!hydrated || !persistenceEnabled || process.env.NODE_ENV === 'production') return
    const serialized = JSON.stringify(items, null, 2)
    try {
      // Keep both the validated working state and a human-readable JSON
      // snapshot. The hydration guard prevents initial defaults from
      // overwriting an existing scene while the app is starting.
      window.localStorage.setItem(BUILDER_STORAGE_KEY, serialized)
      window.localStorage.setItem(BUILDER_EXPORT_STORAGE_KEY, serialized)
    } catch {
      // A full/blocked browser storage area must not break the builder UI.
    }
  }, [hydrated, items, persistenceEnabled])

  const selectItem = useCallback((id: string | null) => setSelectedId(id), [])
  const setTransformDragging = useCallback((dragging: boolean) => {
    // A fresh drag owns the following pointer sequence; discard any stale
    // suppression before arming the one-click release guard.
    suppressNextClickRef.current = !dragging
  }, [])
  const clearSuppressedClick = useCallback(() => {
    suppressNextClickRef.current = false
  }, [])
  const consumeSuppressedClick = useCallback(() => {
    if (!suppressNextClickRef.current) return false
    suppressNextClickRef.current = false
    return true
  }, [])

  const spawnAsset = useCallback((assetId: string) => {
    const asset = assets.find((candidate) => candidate.id === assetId)
    if (!asset || (asset.kind === 'floor' && items.some((item) => item.kind === 'floor'))) return
    setPersistenceEnabled(true)
    const id = newInstanceId(asset.id)
    const item: BuilderItem = {
      id: asset.kind === 'floor' ? 'office-floor' : id,
      assetId: asset.id,
      name: asset.name,
      category: asset.category,
      kind: asset.kind,
      sourcePlacementId: asset.kind === 'model' || asset.kind === 'floor' ? asset.sourcePlacementId : undefined,
      transform: {
        position: asset.kind === 'floor' ? [OFFICE_CENTER[0], 0, OFFICE_CENTER[1]] : [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      wall: asset.wall,
    }
    setItems((current) => [...current, item])
    setSelectedId(id)
  }, [assets, items])

  const updateTransform = useCallback((id: string, patch: Partial<BuilderTransform>) => {
    setPersistenceEnabled(true)
    setItems((current) => current.map((item) => item.id === id
      ? {
          ...item,
          transform: {
            ...item.transform,
            ...patch,
            position: patch.position ? [...patch.position] as [number, number, number] : item.transform.position,
            rotation: patch.rotation ? [...patch.rotation] as [number, number, number] : item.transform.rotation,
            scale: patch.scale ? [...patch.scale] as [number, number, number] : item.transform.scale,
          },
        }
      : item))
  }, [])

  const duplicateItem = useCallback((id: string) => {
    const source = items.find((item) => item.id === id)
    if (!source || source.kind === 'floor') return
    setPersistenceEnabled(true)
    const duplicate = {
      ...source,
      id: newInstanceId(source.assetId),
      name: `${source.name} copy`,
      transform: cloneTransform(source.transform),
    }
    duplicate.transform.position[0] += 1
    duplicate.transform.position[2] += 1
    setItems((current) => [...current, duplicate])
    setSelectedId(duplicate.id)
  }, [items])

  const deleteItem = useCallback((id: string) => {
    if (items.some((item) => item.id === id && item.kind === 'floor')) return
    setPersistenceEnabled(true)
    setItems((current) => current.filter((item) => item.id !== id))
    setSelectedId((current) => current === id ? null : current)
  }, [items])

  const clearScene = useCallback(() => {
    setPersistenceEnabled(true)
    setItems((current) => current.filter((item) => item.kind === 'floor'))
    setSelectedId(null)
  }, [])

  const resetScene = useCallback(() => {
    setPersistenceEnabled(true)
    setItems(initialItems)
    setSelectedId(null)
  }, [initialItems])

  const exportScene = useCallback(() => JSON.stringify(items, null, 2), [items])

  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  const value = useMemo<BuilderContextValue>(() => ({
    assets,
    items,
    selectedId,
    selectedItem,
    transformMode,
    hydrated,
    selectItem,
    setTransformDragging,
    clearSuppressedClick,
    consumeSuppressedClick,
    setTransformMode,
    spawnAsset,
    updateTransform,
    duplicateItem,
    deleteItem,
    clearScene,
    resetScene,
    exportScene,
  }), [assets, items, selectedId, selectedItem, transformMode, hydrated, selectItem, setTransformDragging, clearSuppressedClick, consumeSuppressedClick, spawnAsset, updateTransform, duplicateItem, deleteItem, clearScene, resetScene, exportScene])

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
}

export function useOfficeBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext)
  if (!context) throw new Error('useOfficeBuilder must be used inside OfficeBuilderProvider')
  return context
}

export function useOptionalOfficeBuilder(): BuilderContextValue | null {
  return useContext(BuilderContext)
}
