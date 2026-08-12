'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ForceGraphMethods, NodeObject } from 'react-force-graph-2d'
import { CATEGORY_GRAPH_COLOR, type GraphData, type GraphNode } from '@/lib/notes/graphData'

// Bundle the force-graph lib only when the overlay opens (SSR-safe).
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

const HUB_FONT = '"Poppins", sans-serif'
/** Opacity of everything NOT connected to the hovered/focused node (10%). */
const DIMMED_ALPHA = 0.1
const EDGE_COLOR = 'rgba(255,255,255,0.1)'
const EDGE_DIMMED = 'rgba(255,255,255,0.012)'
const MAX_LABEL = 18

function truncateLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

/** Tag hub font size scales with degree (d3-viz: size encodes a quantity). */
function hubFontSize(degree: number): number {
  return Math.max(9, Math.min(6.5 + Math.sqrt(degree) * 1.5, 17))
}

type KnowledgeGraphCanvasProps = {
  graphData: GraphData
  hoveredId: string | null
  focusedTag: string | null
  onNodeHover: (id: string | null) => void
  onNodeClick: (id: string) => void
  onBackgroundClick: () => void
}

/**
 * The lib renders with the default node type (`NodeObject<{}>` — custom
 * fields ride its `[others: string]: any` index signature); this helper
 * re-views a rendered node as our domain node once x/y are guaranteed.
 */
function asGraphNode(node: NodeObject): GraphNode & { x: number; y: number } {
  return node as unknown as GraphNode & { x: number; y: number }
}

/**
 * M5 Knowledge Graph canvas. The d3-force simulation is pre-computed with
 * `warmupTicks` and then FROZEN with `cooldownTicks={0}` — no tick loop ever
 * runs, so pan/zoom/hover cost zero physics CPU while the R3F office keeps
 * animating. Node x/y persist by id across graphData changes, so tag edits
 * swap the graph instantly without re-animation.
 */
export default function KnowledgeGraphCanvas({
  graphData,
  hoveredId,
  focusedTag,
  onNodeHover,
  onNodeClick,
  onBackgroundClick,
}: KnowledgeGraphCanvasProps) {
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // ResizeObserver keeps the 2D canvas matched to the overlay viewport.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Bidirectional adjacency for hover-focus dimming (d3-viz: prepare derived
  // data before rendering).
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of graphData.links) {
      if (!map.has(link.source)) map.set(link.source, new Set())
      if (!map.has(link.target)) map.set(link.target, new Set())
      map.get(link.source)!.add(link.target)
      map.get(link.target)!.add(link.source)
    }
    return map
  }, [graphData])

  const highlightId = hoveredId ?? focusedTag

  // Position snapshot taken inside nodeCanvasObject (the lib clones nodes into
  // its own state, so our prop objects never receive x/y; drawNode sees them).
  const positionsRef = useRef(new Map<string, { x: number; y: number }>())
  const recordPosition = (id: string, x: number, y: number) => {
    positionsRef.current.set(id, { x, y })
  }

  const isActive = (nodeId: string): boolean => {
    if (!highlightId || nodeId === highlightId) return true
    return adjacency.get(highlightId)?.has(nodeId) ?? false
  }

  const drawNode = (node: NodeObject, ctx: CanvasRenderingContext2D) => {
    if (node.x == null || node.y == null || node.id == null) return
    const n = asGraphNode(node)
    recordPosition(String(node.id), node.x, node.y)
    const active = isActive(n.id)
    if (n.type === 'tag') {
      const fontSize = hubFontSize(n.degree)
      const label = truncateLabel(n.name ?? '', MAX_LABEL)
      ctx.font = `${fontSize}px ${HUB_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Hovered hub: bold + a soft halo behind the label.
      if (n.id === hoveredId) {
        const w = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.beginPath()
        ctx.roundRect(node.x - w / 2 - 8, node.y - fontSize / 2 - 6, w + 16, fontSize + 12, 8)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = `600 ${fontSize}px ${HUB_FONT}`
      } else {
        ctx.fillStyle = active ? `rgba(255,255,255,${0.95})` : `rgba(255,255,255,${DIMMED_ALPHA})`
      }
      ctx.fillText(label, node.x, node.y)
      return
    }
    // Note satellite: dim gray dot; hovered one glows in its category color.
    if (n.id === hoveredId && n.category) {
      ctx.fillStyle = CATEGORY_GRAPH_COLOR[n.category]
      ctx.beginPath()
      ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.beginPath()
      ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI)
      ctx.fill()
    } else {
      ctx.fillStyle = active ? '#888' : `rgba(136,136,136,${DIMMED_ALPHA})`
      ctx.beginPath()
      ctx.arc(node.x, node.y, 2.4, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  const paintPointerArea = (node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
    if (node.x == null || node.y == null) return
    const n = asGraphNode(node)
    ctx.fillStyle = color
    if (n.type === 'tag') {
      const fontSize = hubFontSize(n.degree)
      const label = truncateLabel(n.name ?? '', MAX_LABEL)
      ctx.font = `${fontSize}px ${HUB_FONT}`
      const w = ctx.measureText(label).width
      ctx.fillRect(node.x - w / 2 - 8, node.y - fontSize / 2 - 6, w + 16, fontSize + 12)
    } else {
      ctx.beginPath()
      ctx.arc(node.x, node.y, 7, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  // Latest graph data fed to the engine. force-graph runs its warmup ticks on
  // THESE node objects in place, so after the layout settles they carry x/y.
  const graphDataRef = useRef(graphData)
  useEffect(() => {
    graphDataRef.current = graphData
  }, [graphData])


  // E2E probe: live node/edge counts + frozen positions. The React ref only
  // exposes kapsule `methodNames` (graphData is NOT one of them), so counts
  // read from the prop mirror; graph2ScreenCoords IS on the ref.
  useEffect(() => {
    const api = {
      get nodeCount() {
        return graphDataRef.current.nodes.length
      },
      get linkCount() {
        return graphDataRef.current.links.length
      },
      nodePositions() {
        // Only ids still in the graph (drops nodes removed by tag edits).
        const live = new Set(graphDataRef.current.nodes.map((n) => n.id))
        return [...positionsRef.current.entries()]
          .filter(([id]) => live.has(id))
          .map(([id, p]) => ({ id, x: p.x, y: p.y }))
      },
      // Screen coords of a node (canvas is full-viewport inside the overlay).
      nodeScreenPosition(id: string) {
        const pos = positionsRef.current.get(id)
        const g = graphRef.current
        if (!g?.graph2ScreenCoords || !pos) return null
        const p = g.graph2ScreenCoords(pos.x, pos.y)
        return { x: p.x, y: p.y }
      },
    }
    ;(window as unknown as Record<string, unknown>).__NOTELINGS_GRAPH__ = api
    return () => {
      delete (window as unknown as Record<string, unknown>).__NOTELINGS_GRAPH__
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          // d3-viz: pre-compute the settled layout, then freeze — zero CPU.
          warmupTicks={250}
          cooldownTicks={0}
          // Neural-glass custom renderer (full replace of the default shapes).
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={paintPointerArea}
          linkColor={(link) => {
            // Connected edges stay visible; everything else fades to ~1%.
            if (!highlightId) return EDGE_COLOR
            const source = typeof link.source === 'string' ? link.source : (link.source as NodeObject | undefined)?.id
            const target = typeof link.target === 'string' ? link.target : (link.target as NodeObject | undefined)?.id
            return source === highlightId || target === highlightId ? EDGE_COLOR : EDGE_DIMMED
          }}
          linkWidth={1}
          onNodeHover={(node) => onNodeHover(node ? (node.id as string) : null)}
          onNodeClick={(node) => onNodeClick(node.id as string)}
          onBackgroundClick={onBackgroundClick}
          minZoom={0.25}
          maxZoom={6}
        />
      )}
    </div>
  )
}
