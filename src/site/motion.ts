import { useEffect, useRef, useSyncExternalStore } from 'react'

/* ── Math ──────────────────────────────────────────────────────────────── */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Progress (0→1) of a tall "pinned" section while its sticky child fills the viewport. */
export function pinProgress(el: HTMLElement | null) {
  if (!el) return 0
  const r = el.getBoundingClientRect()
  return clamp(-r.top / Math.max(1, r.height - window.innerHeight))
}

/** Smoothly scrolls so a pinned section sits at progress `p`. */
export function scrollToProgress(el: HTMLElement | null, p: number) {
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY
  window.scrollTo({ top: top + p * (el.offsetHeight - window.innerHeight), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

/* ── Media queries ─────────────────────────────────────────────────────── */

export const REDUCED = '(prefers-reduced-motion: reduce)'
export const FINE_POINTER = '(hover: hover) and (pointer: fine)'
export const DESKTOP = '(min-width: 1024px)'

const lists = new Map<string, MediaQueryList>()
const subscribers = new Map<string, (cb: () => void) => () => void>()
const getList = (q: string) => {
  let m = lists.get(q)
  if (!m) lists.set(q, (m = window.matchMedia(q)))
  return m
}
const getSubscriber = (q: string) => {
  let s = subscribers.get(q)
  if (!s) {
    s = (cb) => {
      const m = getList(q)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    }
    subscribers.set(q, s)
  }
  return s
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && getList(REDUCED).matches
export const useMedia = (q: string) => useSyncExternalStore(getSubscriber(q), () => getList(q).matches, () => false)
export const useReducedMotion = () => useMedia(REDUCED)

/* ── Shared frame scheduler ────────────────────────────────────────────── */
// One requestAnimationFrame loop serves every scroll-linked and animated
// component. It sleeps whenever nothing is moving and wakes on scroll,
// resize, pointer input or an explicit wake() call.

type FrameFn = (dt: number, now: number) => boolean | void
const frameFns = new Set<{ current: FrameFn }>()
const scrollFns = new Set<{ current: () => void }>()

/** Scroll state sampled once per frame. `velocity` is smoothed, in px/s. */
export const scroll = { y: 0, velocity: 0, dir: 1 }

let raf = 0
let last = 0
let dirty = true
let bound = false

function onScroll() {
  dirty = true
  wake()
}

function bind() {
  if (bound) return
  bound = true
  scroll.y = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
}

export function wake() {
  if (!raf && typeof window !== 'undefined') raf = requestAnimationFrame(tick)
}

function tick(now: number) {
  raf = 0
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60
  last = now
  const y = window.scrollY
  const dy = y - scroll.y
  scroll.y = y
  if (dy) scroll.dir = dy > 0 ? 1 : -1
  scroll.velocity += (dy / dt - scroll.velocity) * (1 - Math.exp(-dt * 10))
  if (Math.abs(scroll.velocity) < 4 || prefersReducedMotion()) scroll.velocity = 0
  let again = scroll.velocity !== 0
  if (dirty || dy) {
    dirty = false
    scrollFns.forEach((f) => f.current())
  }
  frameFns.forEach((f) => {
    if (f.current(dt, now)) again = true
  })
  if (again) wake()
  else last = 0
}

/** Runs `fn` once on mount and on every frame in which the page scrolled or resized. */
export function useScrollFrame(fn: () => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    bind()
    scrollFns.add(ref)
    dirty = true
    wake()
    return () => {
      scrollFns.delete(ref)
    }
  }, [])
}

/**
 * Runs `fn(dt, now)` on every frame of the shared loop while `active`.
 * Return `true` to keep the loop awake; return nothing to let it sleep until
 * the next scroll, resize or wake().
 */
export function useFrame(fn: FrameFn, active = true) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    bind()
    frameFns.add(ref)
    wake()
    return () => {
      frameFns.delete(ref)
    }
  }, [active])
}

/* ── Springs ───────────────────────────────────────────────────────────── */

/** Damped spring integrated with semi-implicit Euler. Snaps under reduced motion. */
export class Spring {
  v = 0
  x: number
  target: number
  constructor(x = 0, public k = 170, public c = 26) {
    this.x = this.target = x
  }
  snap(x = this.target) {
    this.x = this.target = x
    this.v = 0
  }
  /** Advances the spring; returns true while it is still moving. */
  step(dt: number) {
    if (prefersReducedMotion()) {
      this.snap()
      return false
    }
    let t = dt
    while (t > 0) {
      const h = Math.min(t, 1 / 120)
      this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h
      this.x += this.v * h
      t -= h
    }
    if (Math.abs(this.v) < 1e-4 && Math.abs(this.x - this.target) < 1e-4) {
      this.snap()
      return false
    }
    return true
  }
}
