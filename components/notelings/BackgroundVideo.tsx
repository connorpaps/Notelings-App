'use client'

/**
 * Bloom world layer 0: a static frame from the Skybridge reference background.
 * The transparent WebGL canvas floats the office above it (z-10) and the glass
 * UI sits on top (z-20). Neutral scrims keep white glass text legible.
 */
export default function BackgroundVideo() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
      <img
        data-background="static-frame"
        src="/images/skybridge-background-frame.jpg"
        alt=""
        className="h-full w-full object-cover"
      />
      {/* Legibility scrim: flat + vignette, strictly neutral. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
      {/* Slow drifting pool of light — room-scale echo of the glass glow rings. */}
      <div aria-hidden className="ambient-glow" />
    </div>
  )
}
