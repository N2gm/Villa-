import type Lenis from 'lenis'

/**
 * The one Lenis instance (null under reduced motion) and keyed scroll locks.
 * Each overlay locks under its own key, so a curtain that finishes early can
 * never unlock the page while the preloader still holds it.
 */
let lenis: Lenis | null = null
const locks = new Set<string>()

function sync() {
  document.documentElement.classList.toggle('is-locked', locks.size > 0)
  if (lenis) locks.size ? lenis.stop() : lenis.start()
}

export const getLenis = () => lenis
export function setLenis(l: Lenis | null) {
  lenis = l
  sync()
}

export function lockScroll(key: string, on: boolean) {
  if (on) locks.add(key)
  else locks.delete(key)
  sync()
}

/** Scrolls through Lenis when it runs, natively otherwise. `immediate` jumps. */
export function scrollToTarget(target: number | string | HTMLElement, { immediate = false, offset = 0 } = {}) {
  if (lenis) {
    lenis.scrollTo(target, { immediate, offset, force: true })
    return
  }
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : typeof target === 'number' ? null : target
  const top = typeof target === 'number' ? target : el ? el.getBoundingClientRect().top + window.scrollY : null
  if (top == null) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: top + offset, behavior: immediate || reduced ? 'auto' : 'smooth' })
}

/** Lenis's scroll velocity in px per frame; 0 without Lenis. */
export const scrollVelocity = () => lenis?.velocity ?? 0
