"use client"
import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { useReducedMotion } from '../motion'
import { gsap, ScrollTrigger } from './gsap'
import { setLenis } from './scroll'

/**
 * Smooth scrolling for the whole app, mounted once. Lenis runs on GSAP's
 * ticker and reports every scroll to ScrollTrigger, so pinned and scrubbed
 * timelines read the same position Lenis paints. Under reduced motion Lenis
 * is not created and the page scrolls natively.
 */
export default function SmoothScroll() {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, stopInertiaOnNavigate: true })
    const off = lenis.on('scroll', () => ScrollTrigger.update())
    const raf = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    setLenis(lenis)
    return () => {
      off()
      gsap.ticker.remove(raf)
      gsap.ticker.lagSmoothing(500, 33)
      setLenis(null)
      lenis.destroy()
    }
  }, [reduced])

  // Lazy images, fonts and late layout all move trigger positions; re-measure once things settle.
  useEffect(() => {
    let t = 0
    const refresh = () => { clearTimeout(t); t = window.setTimeout(() => ScrollTrigger.refresh(), 160) }
    const ro = new ResizeObserver(refresh)
    ro.observe(document.body)
    document.fonts?.ready.then(refresh)
    window.addEventListener('load', refresh)
    return () => { clearTimeout(t); ro.disconnect(); window.removeEventListener('load', refresh) }
  }, [])

  return null
}
