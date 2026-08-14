'use client'

import { useMemo, useState } from 'react'
import { useOfficeBuilder, type BuilderCategory, type BuilderTransform } from './OfficeBuilderContext'

const CATEGORIES: BuilderCategory[] = ['Seating', 'Cubicles', 'Tables', 'Electronics', 'Coffee', 'Plants', 'Utilities', 'Wall Decor', 'Architecture']

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: 16,
  bottom: 16,
  zIndex: 20,
  width: 360,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  color: '#e7f2f0',
  background: 'rgba(8, 17, 22, 0.9)',
  border: '1px solid rgba(181, 229, 218, 0.2)',
  borderRadius: 18,
  boxShadow: '0 20px 70px rgba(0,0,0,0.35)',
  backdropFilter: 'blur(20px)',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(190,230,221,0.18)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  color: 'inherit',
  padding: '7px 9px',
  cursor: 'pointer',
  fontSize: 11,
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '0'
}

function VectorEditor({
  label,
  value,
  step,
  onChange,
}: {
  label: string
  value: [number, number, number]
  step: number
  onChange: (value: [number, number, number]) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <div style={{ fontSize: 11, color: '#a8c4c0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {value.map((axisValue, index) => (
          <input
            key={`${label}-${index}`}
            aria-label={`${label} ${['x', 'y', 'z'][index]}`}
            type="number"
            step={step}
            value={formatNumber(axisValue)}
            onChange={(event) => {
              const next = [...value] as [number, number, number]
              next[index] = Number(event.target.value)
              onChange(next)
            }}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(190,230,221,0.16)', borderRadius: 6, padding: '6px 5px', background: 'rgba(255,255,255,0.06)', color: '#f4fbf9', fontSize: 11 }}
          />
        ))}
      </div>
    </div>
  )
}

export default function OfficeBuilderPanel() {
  const {
    assets,
    items,
    selectedId,
    selectedItem,
    transformMode,
    selectItem,
    setTransformMode,
    spawnAsset,
    updateTransform,
    duplicateItem,
    deleteItem,
    clearScene,
    resetScene,
    exportScene,
  } = useOfficeBuilder()
  const [category, setCategory] = useState<BuilderCategory>('Seating')
  const [copied, setCopied] = useState(false)

  const categoryAssets = useMemo(() => assets.filter((asset) => asset.category === category), [assets, category])

  if (process.env.NODE_ENV === 'production') return null

  const copyExport = async () => {
    const json = exportScene()
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      window.prompt('Copy this scene JSON:', json)
    }
  }

  const update = (patch: Partial<BuilderTransform>) => {
    if (selectedItem) updateTransform(selectedItem.id, patch)
  }

  return (
    <aside style={panelStyle} aria-label="Office builder">
      <header style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(190,230,221,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: '#86d7c5', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Admin builder</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 19, letterSpacing: '-0.03em' }}>Build the office</h1>
          </div>
          <div style={{ fontSize: 11, color: '#8daaa6' }}>{items.length} items</div>
        </div>
        <p style={{ margin: '9px 0 0', color: '#9cb6b2', fontSize: 11, lineHeight: 1.45 }}>
          Spawn any asset, click it in the room, then drag the gizmo or edit exact values. Your scene is saved in this browser.
        </p>
      </header>

      <section style={{ padding: '11px 12px 8px' }}>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 3 }}>
          {CATEGORIES.map((name) => (
            <button key={name} type="button" onClick={() => setCategory(name)} style={{ ...buttonStyle, flex: '0 0 auto', color: category === name ? '#071b18' : '#b9d4cf', background: category === name ? '#91e6d0' : 'rgba(255,255,255,0.05)', borderColor: category === name ? '#91e6d0' : 'rgba(190,230,221,0.12)' }}>
              {name}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
          {categoryAssets.map((asset) => (
            <button key={asset.id} type="button" disabled={asset.kind === 'floor' && items.some((item) => item.kind === 'floor')} onClick={() => spawnAsset(asset.id)} style={{ ...buttonStyle, textAlign: 'left', minHeight: 42, opacity: asset.kind === 'floor' && items.some((item) => item.kind === 'floor') ? 0.45 : 1, cursor: asset.kind === 'floor' && items.some((item) => item.kind === 'floor') ? 'not-allowed' : 'pointer' }}>
              <strong style={{ display: 'block', fontSize: 11, color: '#f0faf7', fontWeight: 600 }}>{asset.name}</strong>
              <span style={{ display: 'block', marginTop: 3, color: '#81aaa3', fontSize: 10 }}>＋ Spawn</span>
            </button>
          ))}
          {categoryAssets.length === 0 && <div style={{ gridColumn: '1 / -1', color: '#8daaa6', fontSize: 11 }}>No assets in this category.</div>}
        </div>
      </section>

      <section style={{ flex: '1 1 auto', minHeight: 120, overflow: 'auto', padding: '4px 12px 10px', borderTop: '1px solid rgba(190,230,221,0.08)' }}>
        <div style={{ padding: '10px 0 7px', display: 'flex', justifyContent: 'space-between', color: '#8daaa6', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span>Scene items</span><span>{selectedId ? 'Selected' : 'Click an item'}</span>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => selectItem(item.id)} style={{ ...buttonStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', borderColor: item.id === selectedId ? '#85ddc8' : 'rgba(190,230,221,0.12)', background: item.id === selectedId ? 'rgba(133,221,200,0.15)' : 'rgba(255,255,255,0.035)' }}>
              <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{item.name}</strong><small style={{ color: '#82aaa3', fontSize: 9 }}>{item.category} · {item.id.slice(-8)}</small></span>
              <span style={{ color: '#86d7c5', fontSize: 15 }}>›</span>
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: '11px 12px 13px', borderTop: '1px solid rgba(190,230,221,0.12)' }}>
        {selectedItem ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
              <div><div style={{ color: '#86d7c5', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Selected</div><strong style={{ display: 'block', marginTop: 3, fontSize: 14 }}>{selectedItem.name}</strong></div>
              <div style={{ display: 'flex', gap: 4 }}><button type="button" disabled={selectedItem.kind === 'floor'} onClick={() => duplicateItem(selectedItem.id)} style={{ ...buttonStyle, opacity: selectedItem.kind === 'floor' ? 0.45 : 1, cursor: selectedItem.kind === 'floor' ? 'not-allowed' : 'pointer' }}>Duplicate</button><button type="button" disabled={selectedItem.kind === 'floor'} onClick={() => deleteItem(selectedItem.id)} style={{ ...buttonStyle, color: '#ffb1aa', opacity: selectedItem.kind === 'floor' ? 0.45 : 1, cursor: selectedItem.kind === 'floor' ? 'not-allowed' : 'pointer' }}>Delete</button></div>
            </div>
            <div style={{ display: 'flex', gap: 5, margin: '10px 0' }}>
              <button type="button" onClick={() => setTransformMode('translate')} style={{ ...buttonStyle, flex: 1, background: transformMode === 'translate' ? '#91e6d0' : 'rgba(255,255,255,0.05)', color: transformMode === 'translate' ? '#071b18' : '#b9d4cf' }}>Move</button>
              <button type="button" onClick={() => setTransformMode('rotate')} style={{ ...buttonStyle, flex: 1, background: transformMode === 'rotate' ? '#91e6d0' : 'rgba(255,255,255,0.05)', color: transformMode === 'rotate' ? '#071b18' : '#b9d4cf' }}>Rotate</button>
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <VectorEditor label="Position" value={selectedItem.transform.position} step={0.05} onChange={(position) => update({ position })} />
              <VectorEditor label="Rotation · radians" value={selectedItem.transform.rotation} step={0.01} onChange={(rotation) => update({ rotation })} />
              <VectorEditor label="Scale" value={selectedItem.transform.scale} step={0.05} onChange={(scale) => update({ scale })} />
            </div>
          </>
        ) : <div style={{ padding: '4px 0 8px', color: '#8daaa6', fontSize: 11 }}>Select an item in the scene or from the list to edit it.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 10 }}>
          <button type="button" onClick={resetScene} style={buttonStyle}>Reset</button>
          <button type="button" onClick={clearScene} style={{ ...buttonStyle, color: '#ffb1aa' }}>Clear</button>
          <button type="button" onClick={copyExport} style={{ ...buttonStyle, color: '#91e6d0' }}>{copied ? 'Copied' : 'Export JSON'}</button>
        </div>
      </section>
    </aside>
  )
}
