'use client'

/**
 * Static world layer 0: a white background. The transparent WebGL canvas
 * floats the office above it (z-10) and the glass UI sits on top (z-20).
 */
export default function BackgroundVideo() {
  return (
    <div
      data-background="static-white"
      className="absolute inset-0 z-0 overflow-hidden bg-white"
      aria-hidden="true"
    />
  )
}
