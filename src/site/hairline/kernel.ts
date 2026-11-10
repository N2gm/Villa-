/**
 * The drawing kernel behind Bonyan's line figures, ported from
 * @lucasmarkes/hairline (MIT © Lucas Marques). The package exports only its
 * thirty-three finished figures, so the engine they share is reproduced here
 * in compact form: the orthographic camera, rounded prisms painted back to
 * front, springs, one shared frame loop that sleeps offscreen, and pointer
 * input in viewBox units. Every figure draws in a 400 × 320 box.
 */

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Sample = { u: number; v: number; nu: number; nv: number }
export type Ring = Sample[]
export type Camera = { az: number; k: number; S: number; ox: number; oy: number }
export type Projector = (x: number, y: number, z: number) => Vec2

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const rad = (d: number) => (d * Math.PI) / 180
export const r2 = (n: number) => Math.round(n * 100) / 100

export const poly = (pts: readonly Vec2[]) => (pts.length ? 'M' + pts.map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L') + 'Z' : '')
export const seg = (a: Vec2, b: Vec2) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`
export const open = (pts: readonly Vec2[]) => (pts.length < 2 ? '' : 'M' + pts.map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L'))

/* ── projection ───────────────────────────────────────────────────────── */

export const Cam = (azDeg: number, k: number, S: number): Camera => ({ az: rad(azDeg), k, S, ox: 0, oy: 0 })

export function proj(C: Camera): Projector {
  const c = Math.cos(C.az), s = Math.sin(C.az), zf = Math.sqrt(1 - C.k * C.k)
  return (x, y, z) => {
    const X = x * c - y * s, Y = x * s + y * c
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * zf)]
  }
}

/** The world x/y under a screen point, on the horizontal plane at height z. */
export function unproj(C: Camera, sx: number, sy: number, z: number): [number, number] {
  const c = Math.cos(C.az), s = Math.sin(C.az), zf = Math.sqrt(1 - C.k * C.k)
  const X = (sx - C.ox) / C.S, Y = ((sy - C.oy) / C.S + z * zf) / C.k
  return [X * c + Y * s, -X * s + Y * c]
}

/** Centres the bounding box of `pts` on (cx, cy). */
export function fit(C: Camera, pts: readonly Vec3[], cx: number, cy: number) {
  C.ox = 0; C.oy = 0
  const P = proj(C)
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9
  for (const p of pts) {
    const q = P(p[0], p[1], p[2])
    a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1])
  }
  C.ox = cx - (a + b) / 2; C.oy = cy - (c + d) / 2
}

/* ── rounded solids ───────────────────────────────────────────────────── */

export function rrect(u0: number, v0: number, u1: number, v1: number, r: number, n = 4): Ring {
  r = Math.max(0, Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2))
  const out: Ring = []
  for (const [cu, cv, a0] of [[u1 - r, v1 - r, 0], [u0 + r, v1 - r, 90], [u0 + r, v0 + r, 180], [u1 - r, v0 + r, 270]])
    for (let k = 0; k <= n; k++) {
      const a = rad(a0 + (90 * k) / n), ca = Math.cos(a), sa = Math.sin(a)
      out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa })
    }
  return out
}

export function circ(R: number, n = 64, cx = 0, cy = 0): Ring {
  const out: Ring = []
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a)
    out.push({ u: cx + R * ca, v: cy + R * sa, nu: ca, nv: sa })
  }
  return out
}

/** Convex hull (monotone chain). */
export function hull(input: readonly Vec2[]): Vec2[] {
  const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const x = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: Vec2[] = [], up: Vec2[] = []
  for (const p of pts) { while (lo.length > 1 && x(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && x(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p) }
  lo.pop(); up.pop()
  return lo.concat(up)
}

export const ringAt = (P: Projector, ring: readonly Sample[], z: number): Vec2[] => ring.map((q) => P(q.u, q.v, z))

/** Samples whose normal faces the camera. */
export const facing = (C: Camera) => {
  const s = Math.sin(C.az), c = Math.cos(C.az)
  return (q: Sample) => q.nu * s + q.nv * c >= -1e-6
}

export function run(ring: readonly Sample[], keep: (q: Sample) => boolean): Ring {
  const n = ring.length
  let s = -1
  for (let i = 0; i < n; i++) if (keep(ring[i]) && !keep(ring[(i + n - 1) % n])) { s = i; break }
  if (s < 0) return keep(ring[0]) ? ring.slice() : []
  const out: Ring = []
  for (let k = 0; k < n && keep(ring[(s + k) % n]); k++) out.push(ring[(s + k) % n])
  return out
}

export type PrismPaths = { sil: string; crease: string }

/** A prism from z0 to z1: its silhouette is the hull of both rings; its one inner line is the lid's bevel. */
export function prism(P: Projector, front: (q: Sample) => boolean, ring: readonly Sample[], inner: readonly Sample[] | null, z0: number, z1: number): PrismPaths {
  return {
    sil: poly(hull(ringAt(P, ring, z1).concat(ringAt(P, ring, z0)))),
    crease: inner ? open(ringAt(P, run(inner, front), z1)) : '',
  }
}

export const rings = (x0: number, y0: number, x1: number, y1: number, r: number, b: number): [Ring, Ring] => [
  rrect(x0, y0, x1, y1, r),
  rrect(x0 + b, y0 + b, x1 - b, y1 - b, Math.max(0.3, r - b)),
]

/* ── motion ───────────────────────────────────────────────────────────── */

let reduced = false
export const reducedMotion = () => reduced

export type Spring = { x: number; v: number; t: number; k: number; c: number; eps: number }
export const spring = (x: number, o: { k?: number; c?: number; eps?: number } = {}): Spring => ({ x, v: 0, t: x, k: o.k ?? 100, c: o.c ?? 18, eps: o.eps ?? 0.01 })

/** Advances a spring toward `sp.t`, substepped at 240 Hz. Returns whether it is still moving. */
export function stepS(sp: Spring, dt: number): boolean {
  if (reduced) { sp.x = sp.t; sp.v = 0; return false }
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n
  for (let i = 0; i < n; i++) {
    sp.v += (-sp.k * (sp.x - sp.t) - sp.c * sp.v) * h
    sp.x += sp.v * h
  }
  if (Math.abs(sp.x - sp.t) < sp.eps && Math.abs(sp.v) < sp.eps * 10) { sp.x = sp.t; sp.v = 0; return false }
  return true
}

/* ── svg ──────────────────────────────────────────────────────────────── */

const NS = 'http://www.w3.org/2000/svg'
type Attrs = Record<string, string | number>

export function mk<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, parent?: Element | null): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  if (parent) parent.appendChild(e)
  return e
}

export type Solid = { g: SVGGElement; sil: SVGPathElement; cr: SVGPathElement }
export function solid(parent: Element): Solid {
  const g = mk('g', {}, parent)
  return { g, sil: mk('path', { class: 'sil' }, g), cr: mk('path', { class: 'nf lo' }, g) }
}
export const put = (el: Solid, s: PrismPaths) => { el.sil.setAttribute('d', s.sil); el.cr.setAttribute('d', s.crease) }

/** A dot lying flat on a horizontal plane. */
export const flatDot = (parent: Element, C: Camera, r: number, cls: string) => mk('ellipse', { rx: r2(r * C.S), ry: r2(r * C.S * C.k), class: cls }, parent)
export const place = (el: SVGElement, q: Vec2) => { el.setAttribute('cx', String(r2(q[0]))); el.setAttribute('cy', String(r2(q[1]))) }

let uid = 0
export const uniqueId = (p: string) => `${p}${++uid}`

/* ── one loop for every figure, asleep offscreen ─────────────────────── */

export type Tick = (dt: number, now: number) => boolean | void
type Board = { stage: Element; tick: Tick; vis: boolean; awake: boolean }

let boards: Board[] = []
let raf = 0, last = 0
let io: IntersectionObserver | null = null
let rm: MediaQueryList | null = null

function frame() {
  const now = performance.now()
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  let any = false
  for (const b of boards.slice()) if (b.vis && b.awake) {
    b.awake = !!b.tick(dt, now)
    any = any || b.awake
  }
  raf = any ? requestAnimationFrame(frame) : 0
}

function wakeBoard(b: Board) {
  b.awake = true
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame) }
}

const onMotion = () => { reduced = !!rm?.matches; boards.forEach(wakeBoard) }

function start() {
  if (io) return
  io = new IntersectionObserver((es) => {
    for (const e of es) for (const b of boards) if (b.stage === e.target) { b.vis = e.isIntersecting; if (b.vis) wakeBoard(b) }
  }, { rootMargin: '80px' })
  rm = matchMedia('(prefers-reduced-motion: reduce)')
  reduced = rm.matches
  rm.addEventListener('change', onMotion)
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  io?.disconnect(); io = null
  rm?.removeEventListener('change', onMotion); rm = null
}

/** Joins the shared loop; the tick runs once now and then while the stage is near the viewport and asks for frames. */
export function register(stage: Element, tick: Tick) {
  start()
  const b: Board = { stage, tick, vis: false, awake: true }
  boards.push(b)
  io!.observe(stage)
  tick(0, performance.now())
  let gone = false
  return {
    wake: () => { if (!gone) wakeBoard(b) },
    unregister: () => {
      if (gone) return
      gone = true
      boards = boards.filter((x) => x !== b)
      if (!boards.some((x) => x.stage === stage)) io?.unobserve(stage)
      if (!boards.length) stop()
    },
  }
}

/* ── pointer, in viewBox units ────────────────────────────────────────── */

export function pointer(stage: HTMLElement, on: { move(p: Vec2): void; leave(): void }) {
  let tm = 0
  const pt = (e: PointerEvent): Vec2 => {
    const r = stage.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 400, ((e.clientY - r.top) / r.height) * 320]
  }
  const move = (e: PointerEvent) => { clearTimeout(tm); on.move(pt(e)) }
  const down = (e: PointerEvent) => {
    clearTimeout(tm)
    if (e.pointerType !== 'mouse') stage.releasePointerCapture?.(e.pointerId)
    on.move(pt(e))
  }
  // A finger lifting holds the pose for a moment, so a tap reads as a look rather than a flash.
  const leave = (e: PointerEvent) => { clearTimeout(tm); tm = window.setTimeout(on.leave, e.pointerType === 'mouse' ? 0 : 1400) }
  stage.addEventListener('pointermove', move)
  stage.addEventListener('pointerdown', down)
  stage.addEventListener('pointerleave', leave)
  return () => {
    clearTimeout(tm)
    stage.removeEventListener('pointermove', move)
    stage.removeEventListener('pointerdown', down)
    stage.removeEventListener('pointerleave', leave)
  }
}

/** Collects tear-down so a figure's destroy is one call. */
export function disposer() {
  let fns: Array<() => void> = []
  return {
    add: (fn: () => void) => { fns.push(fn) },
    dispose: () => { const r = fns; fns = []; for (let i = r.length - 1; i >= 0; i--) r[i]() },
  }
}

export type FigureEls = { stage: HTMLElement; svg: SVGSVGElement; read: (text: string) => void }
