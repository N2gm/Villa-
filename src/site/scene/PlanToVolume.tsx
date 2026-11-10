"use client"
import { useEffect, useRef, useState } from 'react'
import { useInView } from '../hooks'
import { Spring, clamp, lerp, prefersReducedMotion, smoothstep, useFrame, useMedia, useScrollFrame, wake, FINE_POINTER } from '../motion'
import { Eyebrow, Reveal, SplitText } from '../components/ui'
import { type Cam, type P2, type P3, type Solid, depthOf, dimension, drawFlat, drawSolid, fit, path, proj, rect, sizeCanvas, slab, slabChunks, unproj } from './iso'

/* ── Plan data (metres) ────────────────────────────────────────────────── */

const H = 2.9
const T_EXT = 0.24
const T_INT = 0.12

type Room = { id: string; name: string; x0: number; y0: number; x1: number; y1: number }
const ROOMS: Room[] = [
  { id: 'living', name: 'Living & Dining', x0: 0, y0: 0, x1: 7, y1: 5 },
  { id: 'kitchen', name: 'Kitchen', x0: 7, y0: 0, x1: 12, y1: 4 },
  { id: 'study', name: 'Study', x0: 7, y0: 4, x1: 12, y1: 9 },
  { id: 'bath', name: 'Bath', x0: 5, y0: 5, x1: 7, y1: 9 },
  { id: 'master', name: 'Master Suite', x0: 0, y0: 5, x1: 5, y1: 9 },
]
const areaOf = (r: Room) => (r.x1 - r.x0) * (r.y1 - r.y0)
const roomIndexAt = (p: P2) => ROOMS.findIndex((r) => p[0] > r.x0 && p[0] < r.x1 && p[1] > r.y0 && p[1] < r.y1)
const centre = (r: Room): P2 => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]

type Gap = { a: number; b: number; kind: 'door' | 'window' | 'open' }
type Piece = { a: P2; b: P2; t: number; z0: number; z1: number; glass: boolean; rooms: number[]; chunks: P2[][] }

/** A wall run along one axis, broken up by doors, windows and openings. */
function run(along: 'x' | 'y', at: number, from: number, to: number, t: number, gaps: Gap[] = []) {
  const pt = (u: number): P2 => (along === 'x' ? [u, at] : [at, u])
  const out: Omit<Piece, 'rooms' | 'chunks'>[] = []
  const push = (u0: number, u1: number, z0: number, z1: number, glass = false) => out.push({ a: pt(u0), b: pt(u1), t: glass ? 0.05 : t, z0, z1, glass })
  let u = from
  for (const g of gaps) {
    if (g.a > u) push(u, g.a, 0, H)
    if (g.kind === 'window') { push(g.a, g.b, 0, 0.9); push(g.a, g.b, 0.9, 2.2, true); push(g.a, g.b, 2.2, H) }
    if (g.kind === 'door') push(g.a, g.b, 2.3, H)
    u = g.b
  }
  if (to > u) push(u, to, 0, H)
  return out
}

const PIECES: Piece[] = [
  ...run('x', 0, -0.12, 12.12, T_EXT, [{ a: 1.4, b: 4.4, kind: 'window' }, { a: 5.2, b: 6.2, kind: 'door' }, { a: 8.4, b: 10.6, kind: 'window' }]),
  ...run('x', 9, -0.12, 12.12, T_EXT, [{ a: 1.2, b: 3.8, kind: 'window' }, { a: 8.4, b: 11, kind: 'window' }]),
  ...run('y', 0, 0.12, 8.88, T_EXT, [{ a: 1.5, b: 3.5, kind: 'window' }]),
  ...run('y', 12, 0.12, 8.88, T_EXT, [{ a: 5.6, b: 7.6, kind: 'window' }]),
  ...run('y', 7, 0.12, 8.88, T_INT, [{ a: 0.8, b: 3, kind: 'open' }, { a: 4.05, b: 4.95, kind: 'door' }]),
  ...run('x', 4, 7.06, 11.88, T_INT, [{ a: 7.4, b: 8.3, kind: 'door' }]),
  ...run('x', 5, 0.12, 6.94, T_INT, [{ a: 3.6, b: 4.5, kind: 'door' }]),
  ...run('y', 5, 5.06, 8.88, T_INT, [{ a: 7.4, b: 8.2, kind: 'door' }]),
].map((p) => {
  const dx = p.b[0] - p.a[0], dy = p.b[1] - p.a[1]
  const len = Math.hypot(dx, dy)
  const mid: P2 = [p.a[0] + dx / 2, p.a[1] + dy / 2]
  const nx = -dy / len, ny = dx / len
  const rooms = [1, -1].map((s) => roomIndexAt([mid[0] + nx * 0.35 * s, mid[1] + ny * 0.35 * s])).filter((i) => i >= 0)
  // Translucent glass stays in one piece so overlapping chunks do not show seams.
  return { ...p, rooms, chunks: p.glass ? [slab(p.a, p.b, p.t)] : slabChunks(p.a, p.b, p.t) }
})

type Furn = { room: number; fp: P2[]; h: number; soft?: boolean }
const FURN: Furn[] = [
  { room: 0, fp: rect(1, 3.7, 3.8, 4.6), h: 0.45, soft: true },
  { room: 0, fp: rect(1.7, 2.3, 3.1, 3.1), h: 0.36 },
  { room: 0, fp: rect(4.4, 0.9, 6.3, 2.1), h: 0.75 },
  { room: 1, fp: rect(7.4, 0.3, 11.7, 0.95), h: 0.9 },
  { room: 1, fp: rect(8.6, 2, 10.6, 2.9), h: 0.9 },
  { room: 2, fp: rect(10.1, 7.2, 11.6, 8.6), h: 0.75 },
  { room: 2, fp: rect(7.4, 8.35, 9.6, 8.75), h: 1.7 },
  { room: 2, fp: rect(8.1, 5.3, 9, 6.2), h: 0.42, soft: true },
  { room: 3, fp: rect(5.3, 5.3, 6.8, 6.1), h: 0.55, soft: true },
  { room: 3, fp: rect(6.3, 7, 6.85, 8.5), h: 0.85 },
  { room: 4, fp: rect(1, 6.6, 3, 8.7), h: 0.5, soft: true },
  { room: 4, fp: rect(0.4, 8.1, 0.9, 8.6), h: 0.5 },
  { room: 4, fp: rect(3.1, 8.1, 3.6, 8.6), h: 0.5 },
  { room: 4, fp: rect(0.2, 5.2, 2.6, 5.75), h: 2.1 },
]

// Door swings: hinge, radius and the angle of the open leaf.
const SWINGS: { h: P2; r: number; leaf: number }[] = [
  { h: [5.2, 0], r: 1, leaf: Math.PI / 2 },
  { h: [7, 4.05], r: 0.9, leaf: 0 },
  { h: [7.4, 4], r: 0.9, leaf: Math.PI / 2 },
  { h: [3.6, 5], r: 0.9, leaf: Math.PI / 2 },
  { h: [5, 7.4], r: 0.8, leaf: 0 },
]

const FIT_PTS: P3[] = [[-1.4, -1.4, 0], [13.4, -1.4, 0], [13.4, 10.4, 0], [-1.4, 10.4, 0], [0, 0, H], [12, 0, H], [12, 9, H], [0, 9, H]]
const AZ_MID = 0.78

const WALL = { top: '#F4EFE8', dark: [52, 44, 37], light: [224, 212, 196] } as const
const WALL_LIT = { top: '#EBCB97', dark: [104, 78, 52], light: [236, 206, 154] } as const
const GLASS = { top: 'rgb(243,217,164)', dark: [150, 120, 90], light: [243, 217, 164], alpha: 0.3 } as const
const WOOD = { top: '#A8835E', dark: [62, 46, 34], light: [170, 134, 100] } as const
const SOFT = { top: '#D3B489', dark: [96, 74, 54], light: [214, 184, 140] } as const

function segDist(p: P2, a: P2, b: P2) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

const GOLD = [201, 166, 120] as const

type State = {
  ctx: CanvasRenderingContext2D | null
  w: number
  h: number
  cam: Cam
  az: Spring
  walls: Spring[]
  rooms: Spring[]
  pointer: P2 | null
  pinned: boolean
  draw: number
  tour: number
  lastInput: number
  hover: number
  dirty: boolean
  started: boolean
}

function render(s: State, labels: (HTMLButtonElement | null)[], out: { room: HTMLElement | null; area: HTMLElement | null; height: HTMLElement | null; built: HTMLElement | null }) {
  const { ctx, w, h, cam } = s
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  const draw = s.draw

  // Blueprint grid, one metre per cell.
  ctx.lineWidth = 1
  ctx.strokeStyle = `rgba(244,239,232,${0.055 * draw})`
  ctx.beginPath()
  for (let x = -1; x <= 13; x++) { const a = proj(cam, x, -1, 0), b = proj(cam, x, 10, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) }
  for (let y = -1; y <= 10; y++) { const a = proj(cam, -1, y, 0), b = proj(cam, 13, y, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) }
  ctx.stroke()

  ROOMS.forEach((r, i) => drawFlat(ctx, cam, rect(r.x0, r.y0, r.x1, r.y1), 0, `rgba(201,166,120,${(0.025 + 0.16 * s.rooms[i].x) * draw})`))

  // Plan linework draws itself in, wall by wall.
  const N = PIECES.length
  PIECES.forEach((pc, i) => {
    if (pc.z0 > 0) return
    const k = clamp((draw - (i / N) * 0.55) / 0.45)
    if (k <= 0) return
    const b: P2 = [pc.a[0] + (pc.b[0] - pc.a[0]) * k, pc.a[1] + (pc.b[1] - pc.a[1]) * k]
    if (pc.glass) return
    ctx.strokeStyle = 'rgba(244,239,232,0.62)'
    path(ctx, slab(pc.a, b, pc.t).map((p) => proj(cam, p[0], p[1], 0)))
    ctx.stroke()
  })
  ctx.strokeStyle = `rgba(201,166,120,${0.8 * draw})`
  PIECES.forEach((pc) => {
    if (!pc.glass) return
    const a = proj(cam, pc.a[0], pc.a[1], 0), b = proj(cam, pc.b[0], pc.b[1], 0)
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
  })
  ctx.setLineDash([3, 4])
  ctx.strokeStyle = `rgba(201,166,120,${0.55 * draw})`
  for (const d of SWINGS) {
    const pts: P2[] = []
    for (let k = 0; k <= 14; k++) {
      const a = (k / 14) * (Math.PI / 2)
      pts.push([d.h[0] + Math.cos(a) * d.r, d.h[1] + Math.sin(a) * d.r])
    }
    path(ctx, pts.map((p) => proj(cam, p[0], p[1], 0)), false)
    ctx.stroke()
    const end = proj(cam, d.h[0] + Math.cos(d.leaf) * d.r, d.h[1] + Math.sin(d.leaf) * d.r, 0), hinge = proj(cam, d.h[0], d.h[1], 0)
    ctx.beginPath(); ctx.moveTo(hinge[0], hinge[1]); ctx.lineTo(end[0], end[1]); ctx.stroke()
  }
  ctx.setLineDash([])
  dimension(ctx, cam, [0, -1], [12, -1], 0, '12.00 m', GOLD, draw, '#080A0B')
  dimension(ctx, cam, [-1, 0], [-1, 9], 0, '9.00 m', GOLD, draw, '#080A0B')

  // Volumes, sorted far → near.
  const list: { d: number; s: Solid }[] = []
  PIECES.forEach((pc, i) => {
    const e = s.walls[i].x
    if (e < 0.004) return
    const z0 = pc.z0 * e, z1 = pc.z1 * e
    const style = pc.glass ? GLASS : pc.rooms.includes(s.hover) ? WALL_LIT : WALL
    for (const fp of pc.chunks) list.push({ d: depthOf(cam, fp, (z0 + z1) / 2), s: { fp, z0, z1, ...style } })
  })
  FURN.forEach((f) => {
    const e = s.rooms[f.room].x
    if (e < 0.004) return
    list.push({ d: depthOf(cam, f.fp, (f.h * e) / 2), s: { fp: f.fp, z0: 0, z1: f.h * e, ...(f.soft ? SOFT : WOOD) } })
  })
  list.sort((a, b) => b.d - a.d)
  for (const it of list) drawSolid(ctx, cam, it.s)

  ROOMS.forEach((r, i) => {
    const el = labels[i]
    if (!el) return
    const [x, y] = proj(cam, ...centre(r), 0)
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
    el.dataset.active = String(i === s.hover)
    el.style.opacity = String(draw)
  })

  const room = ROOMS[s.hover]
  if (out.room) out.room.textContent = room ? room.name : 'Move across the plan'
  if (out.area) out.area.textContent = room ? `${areaOf(room).toFixed(1)} m²` : '108.0 m²'
  if (out.height) out.height.textContent = `${((room ? s.rooms[s.hover].x : 0) * H).toFixed(2)} m`
  if (out.built) out.built.textContent = `${Math.round((s.walls.reduce((a, w) => a + w.x, 0) / s.walls.length) * 100)}%`
}

/** Home figure: a floor plan whose walls extrude toward the visitor's pointer. */
export default function PlanToVolume() {
  const fine = useMedia(FINE_POINTER)
  const [sectionRef, onScreen] = useInView<HTMLElement>(0, false)
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const labels = useRef<(HTMLButtonElement | null)[]>([])
  const roomOut = useRef<HTMLElement>(null)
  const areaOut = useRef<HTMLElement>(null)
  const heightOut = useRef<HTMLElement>(null)
  const builtOut = useRef<HTMLElement>(null)
  const [raised, setRaised] = useState(() => prefersReducedMotion())
  const [live, setLive] = useState('')
  const raisedRef = useRef(raised)
  raisedRef.current = raised
  const readouts: [string, React.RefObject<HTMLElement | null>][] = [
    ['Room', roomOut],
    ['Area', areaOut],
    ['Wall height', heightOut],
    ['Built', builtOut],
  ]

  const st = useRef<State>({
    ctx: null, w: 0, h: 0,
    cam: { az: AZ_MID, el: 0.56, s: 30, cx: 6, cy: 4.5, ox: 0, oy: 0 },
    az: new Spring(AZ_MID, 40, 13),
    walls: PIECES.map(() => new Spring(0, 150, 15)),
    rooms: ROOMS.map(() => new Spring(0, 120, 18)),
    pointer: null, pinned: false, draw: 0, tour: 0, lastInput: -1e9, hover: -1, dirty: true, started: false,
  })

  useEffect(() => {
    const el = wrap.current, cv = canvas.current
    if (!el || !cv) return
    const ro = new ResizeObserver(() => {
      const s = st.current
      const w = el.clientWidth, h = el.clientHeight
      s.w = w; s.h = h
      s.ctx = sizeCanvas(cv, w, h, w < 640 ? 1.5 : 2)
      Object.assign(s.cam, fit({ ...s.cam, az: AZ_MID }, FIT_PTS, w, h, w < 640 ? 8 : 20))
      s.dirty = true
      wake()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    st.current.dirty = true
    wake()
  }, [raised])

  useScrollFrame(() => {
    const el = wrap.current
    if (!el) return
    const r = el.getBoundingClientRect()
    st.current.az.target = lerp(0.62, 0.94, clamp((innerHeight - r.top) / (innerHeight + r.height)))
  })

  useFrame((dt, now) => {
    const s = st.current
    if (!s.ctx || !s.w) return
    const reduced = prefersReducedMotion()
    s.started = true
    let moving = s.dirty
    s.dirty = false
    if (s.draw < 1) {
      s.draw = reduced ? 1 : Math.min(1, s.draw + dt / 2.2)
      moving = true
    }
    let p = s.pointer
    if (!p && !raisedRef.current && !reduced && s.draw >= 1 && now - s.lastInput > 2600) {
      s.tour += dt
      p = [6 + 4.3 * Math.sin(s.tour * 0.45), 4.5 + 3 * Math.sin(s.tour * 0.63 + 1.1)]
      moving = true
    }
    const all = raisedRef.current
    const hover = p ? roomIndexAt(p) : -1
    PIECES.forEach((pc, i) => {
      const sp = s.walls[i]
      sp.target = all ? 1 : p ? 1 - smoothstep(1, 4, segDist(p, pc.a, pc.b)) : 0
      if (sp.step(dt)) moving = true
    })
    ROOMS.forEach((_, i) => {
      s.rooms[i].target = all || i === hover ? 1 : 0
      if (s.rooms[i].step(dt)) moving = true
    })
    if (s.az.step(dt)) moving = true
    if (hover !== s.hover) { s.hover = hover; moving = true }
    if (!moving) return
    s.cam.az = s.az.x
    render(s, labels.current, { room: roomOut.current, area: areaOut.current, height: heightOut.current, built: builtOut.current })
    return true
  }, onScreen)

  const toWorld = (e: React.PointerEvent): P2 => {
    const r = wrap.current!.getBoundingClientRect()
    return unproj(st.current.cam, e.clientX - r.left, e.clientY - r.top)
  }
  const announce = (i: number) => setLive(i >= 0 ? `${ROOMS[i].name}, ${areaOf(ROOMS[i])} square metres` : '')
  const focusRoom = (i: number, pin = false) => {
    const s = st.current
    s.pointer = centre(ROOMS[i])
    s.pinned = pin || s.pinned
    s.lastInput = performance.now()
    announce(i)
    wake()
  }
  const release = () => {
    const s = st.current
    if (s.pinned) return
    s.pointer = null
    s.lastInput = performance.now()
    wake()
  }

  return (
    <section ref={sectionRef} aria-labelledby="plan-title" className="relative overflow-hidden bg-ink py-28 text-white md:py-36">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_50%,rgba(201,166,120,0.10),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Eyebrow light>From Plan to Place</Eyebrow>
          <h2 id="plan-title" className="mt-6 text-5xl font-light leading-[1.02] tracking-tight md:text-6xl">
            <SplitText text="Every wall starts" /> <SplitText text="as a line." delay={250} />
          </h2>
          <Reveal delay={150}>
            <p className="mt-6 leading-relaxed text-white/60">Before a single block is laid, every Bonyan space is drawn, measured and tested in plan.</p>
          </Reveal>
          <Reveal delay={250}>
            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-sm">
              {readouts.map(([k, ref]) => (
                <div key={k} className="bg-ink px-5 py-4">
                  <dt className="text-xs text-white/50">{k}</dt>
                  <dd ref={ref} className="mt-2 truncate font-display text-lg font-light tabular-nums text-white">&nbsp;</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={350} className="mt-8">
            <button
              type="button"
              aria-pressed={raised}
              onClick={() => setRaised((v) => !v)}
              className="group inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-3 text-sm transition-colors hover:border-gold hover:text-gold"
            >
              <span className={`h-2 w-2 rounded-full transition-colors ${raised ? 'bg-gold' : 'bg-white/40'}`} />
              {raised ? 'Return to plan' : 'Raise every wall'}
            </button>
          </Reveal>
          <p className="sr-only" aria-live="polite">{live}</p>
        </div>

        <div className="lg:col-span-8">
          <div
            ref={wrap}
            className="plan-frame relative aspect-square w-full touch-pan-y select-none sm:aspect-[4/3]"
            onPointerMove={(e) => {
              if (e.pointerType === 'touch') return
              const s = st.current
              s.pointer = toWorld(e)
              s.pinned = false
              s.lastInput = performance.now()
              wake()
            }}
            onPointerLeave={(e) => { if (e.pointerType !== 'touch') { st.current.pinned = false; release() } }}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') return
              const s = st.current
              const w = toWorld(e)
              s.pointer = w
              s.pinned = true
              s.lastInput = performance.now()
              announce(roomIndexAt(w))
              wake()
            }}
          >
            <canvas ref={canvas} role="img" aria-label="Floor plan of a 108 square metre apartment with five rooms. Walls rise into 3D where you point." className="absolute inset-0 h-full w-full" />
            {ROOMS.map((r, i) => (
              <button
                key={r.id}
                ref={(el) => { labels.current[i] = el }}
                type="button"
                onFocus={() => focusRoom(i)}
                onBlur={() => { st.current.pinned = false; release() }}
                onClick={() => focusRoom(i, true)}
                className="absolute left-0 top-0 whitespace-nowrap rounded-full border border-white/15 bg-ink/70 px-3 py-1.5 text-xs text-white/70 opacity-0 backdrop-blur transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold data-[active=true]:border-gold data-[active=true]:text-gold"
              >
                {r.name}
                <span className="ml-2 hidden text-white/50 sm:inline">{areaOf(r)} m²</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
