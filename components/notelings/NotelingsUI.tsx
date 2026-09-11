'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import WelcomeScreen from './WelcomeScreen'
import AgentStatusCard from './AgentStatusCard'
import KanbanPanel from './KanbanPanel'
import TerminalDock from './TerminalDock'
import OfficeViewControls from './OfficeViewControls'
import AuthControls from './AuthControls'
import KnowledgeGraphOverlay from './KnowledgeGraphOverlay'
import { useAuthSession } from './useAuthSession'
import { useTaskCompletionToasts } from './useTaskCompletionToasts'
import { useArchiveToasts } from './useArchiveToasts'
import { useNotesRealtime } from './useNotesRealtime'
import { useNoteSync } from './useNoteSync'
import { useAgentStore } from '@/components/office/agentStore'
import { useOfficeViewStore } from '@/components/office/officeViewStore'
import { browserApiPath, browserMode } from '@/lib/deployment/mode'

type NotelingsUIProps = { enabled?: boolean }

/**
 * Bloom world overlay (M4.2 reskin + Phase 2 control center). Root stays
 * `pointer-events-none`; only interactive surfaces opt in. Composition: brand
 * bar + live agents pill (+ mobile board toggle) + the always-on view controls
 * (Nav Grid Editor toggle + Hide UI), three glass agent cards on the left, the
 * live Spatial Board kanban on the right (bottom-sheet on mobile), the terminal
 * dock bottom-center, and the Bloom hero welcome above everything until
 * dismissed.
 */
export default function NotelingsUI({ enabled = true }: NotelingsUIProps) {
  const [gateDismissed, setGateDismissed] = useState(false)
  const [kanbanOpen, setKanbanOpen] = useState(false)
  const [demoEntryPending, setDemoEntryPending] = useState(() => browserMode() === 'demo')
  const demoEntryAttempted = useRef(false)
  const router = useRouter()
  const { authenticated, loading, user, refresh } = useAuthSession()
  // The gate is the signed-out entry surface AND the signed-in "ready" card:
  // it always shows with no session, and stays until dismissed for signed-in
  // users (who land on "Private workspace ready → Initialize Agents").
  const showGate = !loading && !demoEntryPending && (!authenticated || !gateDismissed)
  const isDemo = Boolean(user?.user_metadata?.is_demo)

  const enterWorkspace = useCallback(() => setGateDismissed(true), [])
  // The root link navigates into the trusted demo path first. Only once the
  // browser is on /demo does this request establish a demo Supabase session.
  const enterDemo = useCallback(async () => {
    if (browserMode() !== 'demo') {
      router.push('/demo')
      return
    }
    setDemoEntryPending(true)
    try {
      const res = await fetch(browserApiPath('/auth/demo'), { method: 'POST' })
      if (!res.ok) throw new Error('demo unavailable')
      const signedIn = await refresh()
      if (!signedIn) throw new Error('demo session unavailable')
      setGateDismissed(true)
    } catch {
      toast.error('Demo workspace is unavailable right now.')
    }
  }, [refresh, router])

  // The root welcome card navigates to the trusted demo path first. Finish the
  // entry automatically after that navigation so the user never has to click
  // the demo button twice.
  useEffect(() => {
    if (browserMode() !== 'demo' || loading) return
    if (authenticated) return
    if (demoEntryAttempted.current) return
    demoEntryAttempted.current = true
    setDemoEntryPending(true)
    void enterDemo().finally(() => setDemoEntryPending(false))
  }, [authenticated, enterDemo, loading])
  // The header's "Hide UI" collapses the chrome to just the view controls so
  // the office can be viewed (or the nav grid painted) on its own.
  const hidden = useOfficeViewStore((state) => state.uiHidden)
  // Fires 'Success: <Agent> filed your note in <Category>.' per delivery.
  useTaskCompletionToasts()
  // M2: 'Note archived — <Agent> filed it in the trash.' per disposal.
  useArchiveToasts()
  // Phase 2 M1: fetch + realtime-mirror notes into the store; push robot
  // lifecycle transitions (pending → in_transit → filed) to the DB.
  useNotesRealtime()
  useNoteSync()
  const online = useAgentStore(
    (state) => Object.values(state.agents).filter((agent) => agent.status !== 'error').length,
  )

  if (!enabled) return null

  return (
    <>
      {!hidden && showGate && (
        <WelcomeScreen onInitialize={enterWorkspace} onBrowseDemo={() => void enterDemo()} />
      )}
      <div className="notelings-ui-shell absolute inset-0 z-20 pointer-events-none flex flex-col p-6 md:p-10">
        <header className="notelings-header flex items-center justify-between gap-4">
          {hidden ? (
            // Keep the header row so the view controls stay pinned top-right.
            <span aria-hidden />
          ) : (
            <div className="flex items-baseline gap-3">
              {/* Logotype, not a heading: the page keeps one h1 (welcome hero). */}
              <p className="text-2xl font-semibold tracking-tighter text-white">notelings</p>
              <span className="hidden font-serif text-[15px] italic text-white/50 md:inline">second brain</span>
            </div>
          )}
          <div className="notelings-header-actions flex flex-wrap items-center justify-end gap-3">
            {!hidden && (
              <button
                type="button"
                aria-label="Open task board"
                aria-expanded={kanbanOpen}
                onClick={() => setKanbanOpen((open) => !open)}
                className="pointer-events-auto flex size-10 min-h-10 min-w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95 xl:hidden"
              >
                <LayoutGrid size={16} />
              </button>
            )}
            {!hidden && isDemo && (
              <div className="liquid-glass hidden items-center gap-2 rounded-full px-3 py-2 text-[11px] text-cyan-100/90 sm:flex" title="Shared demo workspace">
                <Eye size={13} className="text-cyan-200/80" />
                Demo workspace
              </div>
            )}
            {!hidden && <AuthControls />}
            {!hidden && (
              <div className="notelings-online-pill liquid-glass flex items-center gap-2.5 rounded-full px-4 py-2 text-xs text-white/70">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                </span>
                <span className="notelings-online-count">{online}</span><span className="notelings-online-label"> agents online</span>
              </div>
            )}
            <OfficeViewControls />
          </div>
        </header>

        {!hidden && (
          <div className="notelings-ui-content mt-8 flex min-h-0 flex-1 items-start justify-between gap-6">
            <div className="notelings-agent-stack flex flex-col gap-6">
              <AgentStatusCard id="blue" />
              <AgentStatusCard id="green" />
              <AgentStatusCard id="red" />
            </div>
            {/* Desktop: the board is a persistent right rail. */}
            <div className="notelings-board-rail hidden xl:block">
              <KanbanPanel />
            </div>
          </div>
        )}
      </div>
      {!hidden && <TerminalDock />}
      {/* Mobile: the board opens as a bottom sheet above the terminal. */}
      {!hidden && kanbanOpen && (
        <div className="absolute inset-x-3 bottom-[calc(11rem+env(safe-area-inset-bottom))] z-40 xl:hidden">
          <KanbanPanel className="w-full" />
        </div>
      )}
      {/* M5: knowledge graph overlay (works even in Hide-UI mode). */}
      <KnowledgeGraphOverlay />
      {!hidden && <Toaster position="bottom-right" />}
    </>
  )
}
