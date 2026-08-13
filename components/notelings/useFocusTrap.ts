'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type FocusTrapOptions = {
  enabled: boolean
}

/**
 * Lightweight modal focus management without another dependency. It keeps
 * keyboard focus inside the active surface, focuses its first usable control,
 * and returns focus to the trigger when the surface closes.
 */
export function useFocusTrap<T extends HTMLElement>({ enabled }: FocusTrapOptions): RefObject<T | null> {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const visible = (element: HTMLElement) =>
      !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0
    const focusFirst = () => {
      const first = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].find(visible)
      first?.focus()
    }
    const frame = requestAnimationFrame(focusFirst)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return
      if (event.key !== 'Tab') return
      const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible)
      if (focusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('keydown', onKeyDown)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [enabled])

  return containerRef
}
