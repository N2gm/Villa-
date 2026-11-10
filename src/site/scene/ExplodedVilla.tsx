"use client"
import { useEffect, useRef, useState } from 'react'
import { Link } from '@/site/router'
import { useInView } from '../hooks'
import { DESKTOP, Spring, clamp, lerp, pinProgress, prefersReducedMotion, scrollToProgress, smoothstep, useFrame, useMedia, useReducedMotion, useScrollFrame, wake } from '../motion'
import { serviceByTitle } from '../data'
import { Arrow, SplitText } from '../components/ui'
import { type Cam, type P2, type P3, type RGB, type Solid, depthOf, dimension, drawFlat, drawSolid, fit, mixRGB, path, proj, rect, rgba, sizeCanvas, slab, slabChunks } from './iso'

/* ── Materials ─────────────────────────────────────────────────────────── */

type Mat = Omit<Solid, 'fp' | 'z0' | 'z1'>
type Kind = 'plinth' | 'slab' | 'part' | 'wall' | 'glass' | 'roof' | 'wood' | 'soft' | 'dark' | 'plant'
const MAT: Record<Kind, Mat> = {
  plinth: { top: '#1B1E20', dark: [8, 10, 11], light: [64, 68, 70] },
  slab: { top: '#ECE5DA', dark: [148, 136, 120], light: [228, 218, 204] },
  part: { top: '#FFFFFF', dark: [166, 156, 144], light: [246, 241, 234] },
  wall: { top: '#F8F4EF', dark: [150, 139, 126], light: [242, 236, 228] },
  glass: { top: 'rgb(214,226,230)', dark: [104, 128, 138], light: [206, 224, 230], alpha: 0.42 },
  roof: { top: '#2C3034', dark: [16, 18, 20], light: [76, 80, 84] },
  wood: { top: '#B08A63', dark: [84, 60, 40], light: [180, 142, 104] },
  soft: { top: '#E9DFD1', dark: [122, 106, 90], light: [228, 216, 200] },
  dark: { top: '#2A2D30', dark: [18, 20, 22], light: [74, 78, 82] },
  plant: { top: '#748F62', dark: [38, 56, 36], light: [104, 132, 90] },
}
const GOLD: RGB = [201, 166, 120]
const GOLD_TOP = '#E8CC98'

/* ── Geometry (metres) ─────────────────────────────────────────────────── */

type Part = { fp: P2[]; z0: number; z1: number; kind: Kind }
type Flat = { r: [number, number, number, number]; fill: string; grain: number; dir?: 'x' | 'y' }
type Layer = { name: string; group: number; lift: number; under: Part[]; flats?: Flat[]; parts: Part[]; over?: Part[] }
type Opening = { a: number; b: number; sill: number; head: number; glass?: boolean }

const Z = 0.5 // top of the floor slab
const WALL_H = 3
const PZ = Z + WALL_H + 0.3 // pavilion floor, on the roof slab
const TOP = PZ + 2.6 + 0.25
const MAX_LIFT = 7.4

const door = (a: number, b: number, head = 2.3): Opening => ({ a, b, sill: 0, head, glass: false })
const win = (a: number, b: number, sill = 0.9, head = 2.4): Opening => ({ a, b, sill, head })
const box = (x0: number, y0: number, x1: number, y1: number, h: number, kind: Kind, z0 = Z): Part => ({ fp: rect(x0, y0, x1, y1), z0, z1: z0 + h, kind })
const oct = (cx: number, cy: number, r: number): P2[] => Array.from({ length: 8 }, (_, i) => [cx + r * Math.cos((i + 0.5) * (Math.PI / 4)), cy + r * Math.sin((i + 0.5) * (Math.PI / 4))] as const)

const PLAN: P2[][] = []

function wallRun(along: 'x' | 'y', at: number, from: number, to: number, t: number, z0: number, h: number, kind: Kind, openings: Opening[] = [], plan = false): Part[] {
  const pt = (u: number): P2 => (along === 'x' ? [u, at] : [at, u])
  const parts: Part[] = []
  const seg = (u0: number, u1: number, a: number, b: number, k: Kind = kind) => {
    if (b - a < 1e-3 || u1 - u0 < 1e-3) return
    if (plan && a === 0) PLAN.push(slab(pt(u0), pt(u1), t))
    const fps = k === 'glass' ? [slab(pt(u0), pt(u1), 0.06)] : slabChunks(pt(u0), pt(u1), t)
    for (const fp of fps) parts.push({ fp, z0: z0 + a, z1: z0 + b, kind: k })
  }
  let u = from
  for (const o of openings) {
    seg(u, o.a, 0, h)
    seg(o.a, o.b, 0, o.sill)
    if (o.glass !== false) seg(o.a, o.b, o.sill, o.head, 'glass')
    seg(o.a, o.b, o.head, h)
    u = o.b
  }
  seg(u, to, 0, h)
  return parts
}

const LAYERS: Layer[] = [
  { name: 'Base plate & drawings', group: 0, lift: 0, under: [box(-2, -2, 16, 12, 0.3, 'plinth', 0)], parts: [] },
  {
    name: 'Slab, finishes & partitions',
    group: 2,
    lift: 1.3,
    under: [box(0, 0, 14, 10, 0.2, 'slab', 0.3)],
    flats: [
      { r: [0.15, 0.15, 6.43, 5.93], fill: '#C9A27A', grain: 0.42, dir: 'x' },
      { r: [0.15, 6.07, 6.43, 9.85], fill: '#C29C74', grain: 0.42, dir: 'y' },
      { r: [6.57, 0.15, 13.85, 4.93], fill: '#DCD5CA', grain: 0.8 },
      { r: [6.57, 5.07, 10.43, 9.85], fill: '#BE9870', grain: 0.42, dir: 'x' },
      { r: [10.57, 5.07, 13.85, 9.85], fill: '#E3DDD3', grain: 0.6 },
    ],
    parts: [
      ...wallRun('y', 6.5, 0.15, 9.85, 0.14, Z, 1.2, 'part', [door(1.4, 4.2, 1.2)], true),
      ...wallRun('x', 6, 0.15, 6.43, 0.14, Z, 1.2, 'part', [door(4.4, 5.3, 1.2)], true),
      ...wallRun('x', 5, 6.57, 13.85, 0.14, Z, 1.2, 'part', [door(7.2, 8.8, 1.2)], true),
      ...wallRun('y', 10.5, 5.07, 9.85, 0.14, Z, 1.2, 'part', [door(6.1, 6.9, 1.2)], true),
    ],
  },
  {
    name: 'Furniture & styling',
    group: 3,
    lift: 3,
    under: [],
    parts: [
      box(0.8, 4.3, 4.4, 5.3, 0.45, 'soft'),
      box(1.7, 2.7, 3.5, 3.5, 0.35, 'wood'),
      box(4.8, 3.2, 5.7, 4.1, 0.45, 'soft'),
      { fp: oct(0.8, 0.8, 0.32), z0: Z, z1: Z + 0.9, kind: 'plant' },
      box(7.2, 1.6, 8.8, 3.6, 0.75, 'wood'),
      box(9.8, 2, 11.8, 3, 0.9, 'dark'),
      box(13, 0.5, 13.65, 4.6, 0.9, 'wood'),
      box(1.2, 7.4, 3.4, 9.6, 0.5, 'soft'),
      box(0.45, 9.05, 0.95, 9.6, 0.5, 'wood'),
      box(3.65, 9.05, 4.15, 9.6, 0.5, 'wood'),
      box(5.6, 6.6, 6.3, 8.8, 1, 'wood'),
      box(7, 8.7, 9.4, 9.6, 0.75, 'wood'),
      box(8.4, 6.2, 9.3, 7.1, 0.45, 'soft'),
      box(6.65, 5.5, 7.05, 7.9, 1, 'dark'),
      box(11, 8.4, 13.65, 9.6, 0.55, 'soft'),
      box(13.05, 5.6, 13.65, 7.4, 0.85, 'wood'),
    ],
  },
  {
    name: 'Shell',
    group: 1,
    lift: 4.6,
    under: [],
    parts: [
      ...wallRun('x', 0, -0.15, 14.15, 0.3, Z, WALL_H, 'wall', [win(1.6, 6.2, 0, 2.6), door(8, 9.2), win(10.4, 13)], true),
      ...wallRun('x', 10, -0.15, 14.15, 0.3, Z, WALL_H, 'wall', [win(2, 4.6), win(8, 9.6), win(11.2, 12.8, 1.2)], true),
      ...wallRun('y', 0, 0.15, 9.85, 0.3, Z, WALL_H, 'wall', [win(2, 4.4), win(7, 8.6)], true),
      ...wallRun('y', 14, 0.15, 9.85, 0.3, Z, WALL_H, 'wall', [win(1.4, 3.8), win(6.2, 8.6)], true),
    ],
  },
  {
    name: 'Roof & upper pavilion',
    group: 1,
    lift: MAX_LIFT,
    under: [box(-0.4, -0.4, 14.4, 10.4, 0.3, 'roof', Z + WALL_H)],
    parts: [
      ...wallRun('x', 4, 7.5, 13.5, 0.22, PZ, 2.6, 'wall', [win(8.1, 12.9, 0, 2.3)]),
      ...wallRun('x', 9.5, 7.5, 13.5, 0.22, PZ, 2.6, 'wall', [win(9, 12, 1, 2.3)]),
      ...wallRun('y', 7.5, 4.11, 9.39, 0.22, PZ, 2.6, 'wall', [win(5, 8.5, 0.9, 2.3)]),
      ...wallRun('y', 13.5, 4.11, 9.39, 0.22, PZ, 2.6, 'wall', [win(5.2, 8.3, 0, 2.3)]),
      box(0.6, 0.6, 5.6, 1.2, 0.45, 'plant', PZ),
      box(0.6, 1.2, 1.2, 8.8, 0.45, 'plant', PZ),
    ],
    over: [box(7, 3.5, 14, 10, 0.25, 'roof', PZ + 2.6)],
  },
]

/** The four service groups, the layer each leader points at, and where. */
const GROUPS = [
  { title: '2D / 3D Design', layer: 0, anchor: [16, -2, 0.3] as P3, side: 1, label: 'Base plate & drawings' },
  { title: 'Architecture', layer: 4, anchor: [-0.4, 10.4, Z + WALL_H + 0.3] as P3, side: -1, label: 'Shell, roof & pavilion' },
  { title: 'Interior Work', layer: 1, anchor: [0, 10, Z] as P3, side: -1, label: 'Slab, finishes & partitions' },
  { title: 'Decoration Art', layer: 2, anchor: [13.65, 0.5, Z + 0.9] as P3, side: 1, label: 'Furniture & styling' },
]

const AZ = 0.62
const EL = 0.5
const INTRO = 0.1
const EXPLODED = 0.3
const GROUP0 = 0.32
const SEG = (1 - GROUP0) / GROUPS.length

const boxPts = (zTop: number): P3[] => [[-2, -2, 0], [16, -2, 0], [16, 12, 0], [-2, 12, 0], [-0.4, -0.4, zTop], [14.4, -0.4, zTop], [14.4, 10.4, zTop], [-0.4, 10.4, zTop]]

/* ── Rendering ─────────────────────────────────────────────────────────── */

type Fit = { s: number; ox: number; oy: number }
type VState = {
  ctx: CanvasRenderingContext2D | null
  w: number
  h: number
  cam: Cam
  fA: Fit
  fE: Fit
  az: Spring
  el: Spring
  ex: Spring
  vis: Spring[]
  baseAz: number
  spin: number
  spinning: boolean
  nudge: [number, number]
  active: number
  dirty: boolean
}

function drawPart(ctx: CanvasRenderingContext2D, cam: Cam, p: Part, lift: number, v: number, lit: boolean) {
  const m = MAT[p.kind]
  const glass = p.kind === 'glass'
  drawSolid(ctx, cam, {
    fp: p.fp,
    z0: p.z0 + lift,
    z1: p.z1 + lift,
    top: lit && !glass ? GOLD_TOP : m.top,
    dark: lit && !glass ? mixRGB(m.dark, GOLD, 0.3) : m.dark,
    light: lit && !glass ? mixRGB(m.light, GOLD, 0.3) : m.light,
    // Ghosted layers stay faintly visible so the whole stack always reads.
    alpha: (m.alpha ?? 1) * (0.09 + 0.91 * v),
  })
}

function render(s: VState, labels: (HTMLButtonElement | null)[]) {
  const { ctx, w, h, cam } = s
  if (!ctx) return
  const e = s.ex.x
  const k = clamp(e)
  cam.az = s.az.x
  cam.el = s.el.x
  cam.s = lerp(s.fA.s, s.fE.s, k)
  cam.ox = lerp(s.fA.ox, s.fE.ox, k)
  cam.oy = lerp(s.fA.oy, s.fE.oy, k)
  ctx.clearRect(0, 0, w, h)

  ctx.save()
  ctx.shadowColor = 'rgba(8,10,11,0.3)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 30
  drawFlat(ctx, cam, rect(-2, -2, 16, 12), 0, 'rgba(8,10,11,0.25)')
  ctx.restore()

  LAYERS.forEach((L, li) => {
    const lift = L.lift * e
    const v = s.vis[li].x
    const lit = s.active === L.group
    for (const p of L.under) drawPart(ctx, cam, p, lift, v, lit)
    if (li === 0) {
      // The base plate carries the drawings: grid, plan and dimensions.
      const z = 0.3, a = 0.35 + 0.65 * v
      ctx.lineWidth = 1
      ctx.strokeStyle = rgba(GOLD, 0.1 * a)
      ctx.beginPath()
      for (let x = -1; x <= 15; x++) { const p = proj(cam, x, -1.5, z), q = proj(cam, x, 11.5, z); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]) }
      for (let y = -1; y <= 11; y++) { const p = proj(cam, -1.5, y, z), q = proj(cam, 15.5, y, z); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]) }
      ctx.stroke()
      ctx.strokeStyle = rgba(GOLD, 0.75 * a)
      for (const fp of PLAN) { path(ctx, fp.map((p) => proj(cam, p[0], p[1], z))); ctx.stroke() }
      dimension(ctx, cam, [0, -1.1], [14, -1.1], z, '14.00', GOLD, a, MAT.plinth.top)
      dimension(ctx, cam, [15.1, 0], [15.1, 10], z, '10.00', GOLD, a, MAT.plinth.top)
    }
    if (L.flats) {
      const z = Z + lift + 0.002
      ctx.globalAlpha = 0.09 + 0.91 * v
      for (const f of L.flats) {
        const [x0, y0, x1, y1] = f.r
        drawFlat(ctx, cam, rect(x0, y0, x1, y1), z, lit ? mixHex(f.fill) : f.fill)
        ctx.strokeStyle = 'rgba(70,50,32,0.16)'
        ctx.beginPath()
        if (f.dir !== 'y') for (let y = y0 + f.grain; y < y1; y += f.grain) { const p = proj(cam, x0, y, z), q = proj(cam, x1, y, z); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]) }
        if (f.dir !== 'x') for (let x = x0 + f.grain; x < x1; x += f.grain) { const p = proj(cam, x, y0, z), q = proj(cam, x, y1, z); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]) }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    const sorted = L.parts.map((p) => ({ p, d: depthOf(cam, p.fp, (p.z0 + p.z1) / 2 + lift) })).sort((a, b) => b.d - a.d)
    for (const it of sorted) drawPart(ctx, cam, it.p, lift, v, lit)
    for (const p of L.over ?? []) drawPart(ctx, cam, p, lift, v, lit)
  })

  // Leader lines and labels fade in as the stack comes apart.
  const la = smoothstep(0.45, 0.9, e)
  GROUPS.forEach((g, gi) => {
    const [x, y] = proj(cam, g.anchor[0], g.anchor[1], g.anchor[2] + LAYERS[g.layer].lift * e)
    const narrow = w < 640
    const lx = clamp(x + g.side * (narrow ? 30 : 64), 18, w - 18), ly = y - (narrow ? 22 : 34)
    const on = s.active === gi
    ctx.globalAlpha = la
    ctx.strokeStyle = on ? rgba(GOLD, 1) : 'rgba(8,10,11,0.4)'
    ctx.lineWidth = on ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + g.side * (narrow ? 12 : 26), ly)
    ctx.lineTo(lx, ly)
    ctx.stroke()
    ctx.fillStyle = on ? rgba(GOLD, 1) : '#080A0B'
    ctx.beginPath()
    ctx.arc(x, y, on ? 4.5 : 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    const el = labels[gi]
    if (el) {
      el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(${g.side < 0 ? '-100%' : '0'}, -50%)`
      el.style.opacity = String(la)
      el.style.visibility = la < 0.05 ? 'hidden' : 'visible'
    }
  })
}

// Finishes warm toward gold when their layer is selected.
const mixHex = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return rgba(mixRGB([(n >> 16) & 255, (n >> 8) & 255, n & 255], [232, 204, 152], 0.35))
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function ExplodedVilla() {
  const desktop = useMedia(DESKTOP)
  const reduced = useReducedMotion()
  // Every screen gets the scroll-driven stack; phones and tablets also turn the villa slowly on its own.
  const pinned = !reduced
  const spinning = pinned && !desktop
  const section = useRef<HTMLElement>(null)
  const [stage, onScreen] = useInView<HTMLDivElement>(0, false)
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const labels = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(-1)
  const [drawn, setDrawn] = useState(false)

  const st = useRef<VState>({
    ctx: null, w: 0, h: 0,
    cam: { az: AZ, el: EL, s: 20, cx: 7, cy: 5, ox: 0, oy: 0 },
    fA: { s: 20, ox: 0, oy: 0 }, fE: { s: 20, ox: 0, oy: 0 },
    // The villa swings in from the side when the page opens.
    az: new Spring(prefersReducedMotion() ? AZ : AZ - 1.25, 26, 10.2),
    el: new Spring(EL, 26, 10.2),
    ex: new Spring(0, 60, 15.5),
    vis: LAYERS.map(() => new Spring(1, 90, 19)),
    baseAz: AZ, spin: 0, spinning: false, nudge: [0, 0], active: -1, dirty: true,
  })

  useEffect(() => {
    st.current.spinning = spinning
    const el = wrap.current, cv = canvas.current
    if (!el || !cv) return
    const ro = new ResizeObserver(() => {
      const s = st.current
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      s.w = w; s.h = h
      s.ctx = sizeCanvas(cv, w, h, w < 640 ? 1.5 : 2)
      const side = w < 640 ? 22 : w < 1024 ? 60 : 150
      const probe = { ...s.cam, az: AZ, el: EL }
      const shift = (f: Fit): Fit => ({ ...f, ox: f.ox + side })
      // While it turns, the villa has to clear the frame at every angle. Phones let the corners graze the edges to keep it large.
      const turn = (pts: P3[], pad: number): Fit => {
        const base = fit(probe, pts, w - side * 2, h, pad)
        if (!s.spinning) return base
        let sm = base.s
        for (let a = 0; a < Math.PI; a += 0.2) sm = Math.min(sm, fit({ ...probe, az: a }, pts, w - side * 2, h, pad).s)
        const k = w < 640 ? 0.25 : 1
        const sc = sm + (Math.max(sm, base.s) - sm) * (1 - k)
        return { ...base, s: sc, ox: (w - side * 2) / 2, oy: base.oy }
      }
      const pad = w < 640 ? 8 : 28
      s.fA = shift(turn(boxPts(TOP), pad))
      s.fE = shift(turn(boxPts(TOP + MAX_LIFT), pad - 4))
      s.dirty = true
      wake()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [spinning])

  // Outside the pinned sequence the stack simply rests exploded.
  useEffect(() => {
    const s = st.current
    if (pinned) return
    s.ex.target = 1
    if (prefersReducedMotion()) s.ex.snap(1)
    s.baseAz = AZ
    s.az.target = AZ
    s.dirty = true
    wake()
  }, [pinned])

  useScrollFrame(() => {
    if (!pinned) return
    const s = st.current
    const p = pinProgress(section.current)
    s.baseAz = AZ - 0.16 + 0.32 * p
    s.az.target = s.baseAz + s.spin + s.nudge[0] * 0.28
    s.ex.target = smoothstep(INTRO * 0.5, EXPLODED, p)
    const g = p < GROUP0 ? -1 : Math.min(GROUPS.length - 1, Math.floor((p - GROUP0) / SEG))
    if (g !== s.active) { s.active = g; s.dirty = true; setActive(g) }
    if (bar.current) bar.current.style.transform = `scaleX(${clamp((p - GROUP0) / (1 - GROUP0))})`
  })

  useFrame((dt) => {
    const s = st.current
    if (!s.ctx || !s.w) return
    let moving = s.dirty
    s.dirty = false
    if (s.spinning) {
      // One full turn in about 40 seconds.
      s.spin += dt * ((Math.PI * 2) / 40)
      s.az.target = s.baseAz + s.spin + s.nudge[0] * 0.28
      moving = true
    }
    if (s.az.step(dt)) moving = true
    if (s.el.step(dt)) moving = true
    if (s.ex.step(dt)) moving = true
    LAYERS.forEach((L, i) => {
      s.vis[i].target = s.active < 0 || L.group === s.active ? 1 : 0
      if (s.vis[i].step(dt)) moving = true
    })
    if (!moving) return
    render(s, labels.current)
    if (!drawn) setDrawn(true)
    return true
  }, onScreen)

  const select = (g: number) => {
    const s = st.current
    if (pinned) {
      scrollToProgress(section.current, g < 0 ? 0 : GROUP0 + (g + 0.5) * SEG)
      return
    }
    s.active = g
    // Reduced-motion springs snap without reporting movement, so force a repaint.
    s.dirty = true
    setActive(g)
    wake()
  }

  const onLabelKey = (e: React.KeyboardEvent, i: number) => {
    const n = GROUPS.length
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (to < 0) return
    e.preventDefault()
    labels.current[to]?.focus()
    select(to)
  }

  const g = active >= 0 ? GROUPS[active] : null
  const svc = g ? serviceByTitle(g.title) : null

  return (
    <section ref={section} aria-labelledby="services-title" className="relative bg-sand" style={pinned ? { height: '420svh' } : undefined}>
      <div ref={stage} className={pinned ? 'sticky top-0 h-[100svh] overflow-hidden' : 'relative overflow-hidden'}>
        <div className="blueprint-grid pointer-events-none absolute inset-0" />
        <div className={`relative mx-auto grid max-w-[90rem] px-6 lg:grid-cols-12 lg:gap-10 ${pinned ? 'h-full grid-rows-[auto_minmax(0,1fr)] gap-2 pb-2 pt-20 sm:pt-28 lg:grid-rows-none lg:items-center lg:pb-8 lg:pt-24' : 'gap-10 pb-24 pt-36'}`}>
          <div className="relative z-10 lg:col-span-5">
            <p className="hidden text-xs text-mute lg:block"><Link to="/" className="hover:text-brand">Home</Link> <span className="mx-2 text-brand">/</span> Services</p>
            <h1 id="services-title" className="text-4xl font-extralight leading-[0.95] tracking-tight sm:text-6xl lg:mt-6 lg:text-6xl xl:text-8xl">
              <SplitText text="Every layer," play stagger={90} /> <SplitText text="one studio." play delay={260} stagger={90} />
            </h1>
            <p className="mt-6 hidden max-w-md text-lg text-mute lg:block">Architecture, interiors, 2D/3D design and decoration, one continuous journey.</p>

            <div className="mt-3 min-h-[8.5rem] border-t border-ink/10 pt-3 sm:mt-5 sm:min-h-[11rem] sm:pt-5 lg:mt-10 lg:min-h-[17rem] lg:pt-8" aria-live="polite">
              {g && svc ? (
                <div key={active} className="panel-in">
                  <p className="text-sm font-medium text-brand">{g.label}</p>
                  <h2 className="mt-1 text-2xl font-light tracking-tight sm:mt-3 sm:text-4xl lg:mt-4 lg:text-5xl">{svc.title}</h2>
                  <p className="mt-2 line-clamp-3 max-w-md text-sm leading-relaxed text-mute sm:mt-4 sm:text-base lg:line-clamp-none">{svc.text}</p>
                  <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
                    {svc.tags.map((t) => <span key={t} className="rounded-full border border-brand/25 px-3 py-1 text-xs text-brand">{t}</span>)}
                  </div>
                  <Link to="/get-a-quote" className="group mt-3 inline-flex items-center gap-3 text-sm font-medium sm:mt-8">
                    <span className="border-b border-ink/30 pb-1 transition-colors group-hover:border-brand group-hover:text-brand">Start with {svc.title}</span>
                    <Arrow className="h-4 w-4 text-brand transition-transform duration-500 group-hover:translate-x-1.5" />
                  </Link>
                </div>
              ) : (
                <div key="intro" className="panel-in">
                  <p className="text-sm font-medium text-brand">Four disciplines &middot; one model</p>
                  <p className="mt-2 max-w-md font-display text-base font-light leading-snug sm:mt-4 sm:text-2xl md:text-3xl">From the first drawing on the base plate to the last cushion on the sofa, every layer of a Bonyan home is designed and delivered by the same team.</p>
                </div>
              )}
            </div>
            {!pinned && active >= 0 && (
              <button type="button" onClick={() => select(-1)} className="mt-6 text-xs text-mute underline-offset-4 hover:text-brand hover:underline">Show every layer</button>
            )}
          </div>

          <div className={`relative lg:col-span-7 ${pinned ? '-mx-6 min-h-0 lg:mx-0 lg:h-[min(82svh,820px)]' : 'aspect-[4/5] sm:aspect-square'}`}>
            <div
              ref={wrap}
              className="villa-in absolute inset-0"
              onPointerMove={(e) => {
                if (reduced) return
                const r = e.currentTarget.getBoundingClientRect()
                const s = st.current
                s.nudge = [((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2]
                s.az.target = s.baseAz + s.spin + s.nudge[0] * 0.28
                s.el.target = EL - s.nudge[1] * 0.07
                wake()
              }}
              onPointerLeave={() => {
                const s = st.current
                s.nudge = [0, 0]
                s.az.target = s.baseAz + s.spin
                s.el.target = EL
                wake()
              }}
            >
              {/* Until the first frame is drawn, a sheen holds the villa's place. */}
              <span aria-hidden="true" data-ready={drawn ? '' : undefined} className={`skeleton pointer-events-none absolute inset-x-6 inset-y-[12%] rounded-[2rem] transition-opacity duration-700 ${drawn ? 'opacity-0' : ''}`} />
              <canvas ref={canvas} role="img" aria-label="Exploded axonometric drawing of a two-storey villa: base plate with drawings, floor slab with partitions, furniture, outer walls, and roof with an upper pavilion." className="absolute inset-0 h-full w-full" />
              <div role="group" aria-label="Service layers">
                {GROUPS.map((x, i) => (
                  <button
                    key={x.title}
                    ref={(el) => { labels.current[i] = el }}
                    type="button"
                    aria-pressed={active === i}
                    aria-label={`${x.title}: ${x.label}`}
                    onClick={() => select(active === i && !pinned ? -1 : i)}
                    onKeyDown={(e) => onLabelKey(e, i)}
                    className="group absolute left-0 top-0 flex items-center gap-2 whitespace-nowrap rounded-full border border-ink/15 bg-white/85 py-1.5 pl-1.5 pr-1.5 text-xs shadow-[0_10px_30px_-12px_rgba(8,10,11,.35)] backdrop-blur transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand aria-pressed:border-brand aria-pressed:bg-ink aria-pressed:text-white sm:pr-4"
                    style={{ opacity: 0 }}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-sand font-display text-[11px] text-brand group-aria-pressed:bg-gold group-aria-pressed:text-ink">{i + 1}</span>
                    <span className="hidden sm:inline">{x.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
