"use client"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@/site/router'
import { lockScroll } from '../lib/scroll'

/**
 * PageTransition — intercepts link clicks → covers with black curtain → navigates → reveals.
 *
 * FLOW:
 *  1. User clicks an internal link → intercept click (don't navigate yet)
 *  2. Black curtain slides up from bottom to fully cover the screen
 *  3. Curtain fully covers → actually navigate to the new route
 *  4. New page mounts (pageReady=true) → curtain slides up off-screen
 *  5. Curtain gone → page animations start naturally
 *
 * This prevents the white flash that occurs when the route changes before
 * the curtain has time to cover.
 */

type Phase = 'idle' | 'enter' | 'covering' | 'covered' | 'revealing' | 'done'

interface PageTransitionProps {
  children: React.ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const navigateTo = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const pendingPath = useRef<string | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  // ── Lock body scroll + pointer events when curtain is active ───────────────
  useEffect(() => {
    lockScroll('transition', phase !== 'idle' && phase !== 'done')
    return () => lockScroll('transition', false)
  }, [phase])

  // ── Intercept internal link clicks (capturing phase — before React Router) ──
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (phase !== 'idle') return // Already transitioning — ignore

    const anchor = (e.target as HTMLElement).closest('a')
    if (!anchor) return

    const href = anchor.getAttribute('href')
    if (!href) return
    // Skip external links, mailto, tel, hash-only
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#') return
    // Skip same page
    if (href === location.pathname) return

    // Internal link — intercept: prevent React Router from navigating
    e.preventDefault()
    e.stopPropagation()

    pendingPath.current = href
    window.dispatchEvent(new CustomEvent('bonyan:navigating', { detail: href }))
    setPhase('enter')
  }, [phase, location.pathname])

  // ── 'enter' → trigger covering slide on next frame ─────────────────────────
  useLayoutEffect(() => {
    if (phase !== 'enter') return
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('covering'))
    })
    return () => cancelAnimationFrame(id)
  }, [phase])

  // ── Covering transition finished → fully covered ───────────────────────────
  const handleCoverEnd = (e: React.TransitionEvent) => {
    if (phase === 'covering' && e.propertyName === 'transform') {
      setPhase('covered')
    }
  }

  // ── Covered: navigate to pending path, then reveal new page ────────────────
  useEffect(() => {
    if (phase !== 'covered') return

    if (pendingPath.current) {
      const path = pendingPath.current
      pendingPath.current = null
      navigateTo(path)
    }

    const timer = addTimer(() => {
      setPhase('revealing')
    }, 120)

    return () => clearTimeout(timer)
  }, [phase, navigateTo])

  // ── Curtain reveal transition ended → done ─────────────────────────────────
  const handleRevealEnd = (e: React.TransitionEvent) => {
    if (phase === 'revealing' && e.propertyName === 'transform') {
      setPhase('done')
      addTimer(() => setPhase('idle'), 50)
    }
  }

  // Safety timeout: ensure covering never gets stuck
  useEffect(() => {
    if (phase !== 'covering') return
    const id = addTimer(() => {
      setPhase((p) => (p === 'covering' ? 'covered' : p))
    }, 700)
    return () => clearTimeout(id)
  }, [phase])

  // Safety timeout: ensure revealing never gets stuck
  useEffect(() => {
    if (phase !== 'revealing') return
    const id = addTimer(() => {
      setPhase('done')
      addTimer(() => setPhase('idle'), 50)
    }, 800)
    return () => clearTimeout(id)
  }, [phase])

  // Curtain position:
  //  enter     → 100%  (off-screen below, no transition)
  //  covering  → 0%    (sliding up to cover, with transition)
  //  covered   → 0%    (static, fully covering)
  //  revealing → -100% (sliding up off-screen, with transition)
  //  done      → -100%
  const curtainTransform =
    phase === 'enter'    ? 'translateY(100%)' :
    phase === 'covering' ? 'translateY(0%)' :
    phase === 'covered'  ? 'translateY(0%)' :
                           'translateY(-100%)'

  const curtainTransition =
    phase === 'covering'  ? 'transform 550ms cubic-bezier(.76,0,.24,1)' :
    phase === 'revealing' ? 'transform 650ms cubic-bezier(.76,0,.24,1)' :
                            'none'

  // Hide page content ONLY when fully covered to allow clean mount of the new page
  const contentVisible = phase !== 'covered'

  return (
    <div className="relative" onClickCapture={handleClickCapture}>
      {/* Page content */}
      <div style={{
        visibility: contentVisible ? 'visible' : 'hidden',
        pointerEvents: phase === 'idle' ? 'auto' : 'none',
      }}>
        {children}
      </div>

      {/* ── Black curtain ── */}
      {phase !== 'idle' && (
        <div
          className="fixed inset-0 z-[89] bg-ink pointer-events-none"
          style={{ transform: curtainTransform, transition: curtainTransition }}
          onTransitionEnd={phase === 'covering' ? handleCoverEnd : handleRevealEnd}
        />
      )}
    </div>
  )
}
