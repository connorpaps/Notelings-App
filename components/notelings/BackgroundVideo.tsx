'use client'

/**
 * Bloom world layer 0: the looping video background. Sits at z-0; the
 * transparent WebGL canvas floats the office above it (z-10) and the glass UI
 * sits on top (z-20). A subtle grayscale darkening keeps white glass text
 * legible over any frame of the video.
 */
export default function BackgroundVideo() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        src="/videos/bloom-background.mp4"
      />
      {/* Legibility scrim: flat + vignette, strictly neutral. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  )
}
