'use client'

/**
 * Light paper world layer 0: a restrained neutral surface behind the
 * transparent WebGL office (z-10) and light glass UI (z-20). The office stays
 * the colorful centerpiece while the background gives the controls a clean,
 * contemporary canvas.
 */
export default function PaperWorldBackground() {
  return (
    <div data-background="light-paper" className="absolute inset-0 z-0 overflow-hidden bg-[#f6f7f5]" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(85%_75%_at_50%_42%,rgba(255,255,255,0.92)_0%,rgba(246,247,245,0.72)_52%,rgba(224,229,226,0.72)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_44%,transparent_45%,rgba(20,31,35,0.08)_100%)]" />
      {/* Slow drifting pool of light — kept neutral and low-contrast on paper. */}
      <div aria-hidden className="ambient-glow opacity-60" />
    </div>
  )
}
