'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type GlassPanelProps = {
  /** Strong tier (heavy blur, for the dock/CTA). Default: light tier. */
  strong?: boolean
  /** Render the rotating monochrome glow ring + halo behind the glass. */
  glow?: boolean
  className?: string
  children: ReactNode
}

/**
 * Bloom liquid-glass panel. The wrapper owns the border-radius; the rotating
 * glow ring (masked conic gradient) and soft halo live behind the glass card,
 * which carries the `.liquid-glass`/`-strong` tier and clips its own content.
 */
export default function GlassPanel({ strong = false, glow = true, className, children }: GlassPanelProps) {
  return (
    <div className={cn('relative', className)}>
      {glow && (
        <>
          <div aria-hidden className="glass-glow-halo rounded-[inherit]" />
          <div aria-hidden className="glass-glow-ring rounded-[inherit]" />
        </>
      )}
      <div
        className={cn(
          'relative z-[1] h-full w-full rounded-[inherit]',
          strong ? 'liquid-glass-strong' : 'liquid-glass',
        )}
      >
        {children}
      </div>
    </div>
  )
}
