import type { Figure, HairlineOptions } from '@lucasmarkes/hairline'
import {
  Cam, clamp, disposer, facing, fit, flatDot, lerp, mk, place, pointer, poly, prism, proj, put, register, ringAt, rings, rrect, seg, smooth, solid, spring, stepS, unproj,
  type FigureEls, type Ring, type Solid, type Spring, type Vec2,
} from './kernel'

/**
 * Plan → Volume. A villa drawn at 1:100 — five rooms, its doors left as gaps,
 * a little furniture and a pool on the terrace — that grows from a drawing
 * into a building. `setProgress` (scroll) sweeps a front across the plan from
 * the back corner, and every wall behind it rises on its own spring; past
 * three quarters the roof drops in and settles. The pointer answers on top:
 * walls near it lift out of the drawing, the room under it lights and reads
 * out its area, and the roof rises off so you can look inside.
 *
 * 1 unit = 12.5 cm, so the house is 16 × 12 m.
 */

const W = 128, D = 96, HMAX = 30, LOW = 1.1, FLOOR = 1.5, LIFT = 24
const TE = 2.8, TI = 0.9
const M = 0.125

type Rect = [number, number, number, number]
type Block = { r: Rect; hmax: number; d: number; cx: number; cy: number; ring: Ring; inner: Ring; sp: Spring; el: Solid; drawn: number }

const WALLS: Rect[] = [
  [0, 0, W, TE], [0, TE, TE, D], [W - TE, TE, W, D],
  [TE, D - TE, 30, D], [42, D - TE, 58, D], [86, D - TE, W - TE, D],
  [TE, 40 - TI, 34, 40 + TI], [42, 40 - TI, 56, 40 + TI], [64, 40 - TI, 81, 40 + TI], [87, 40 - TI, W - TE, 40 + TI],
  [48 - TI, TE, 48 + TI, 40 - TI], [80 - TI, TE, 80 + TI, 40 - TI],
  [88 - TI, 40 + TI, 88 + TI, 52], [88 - TI, 78, 88 + TI, D - TE],
]
const FURNITURE: Array<[Rect, number]> = [
  [[10, 9, 34, 29], 5], [[96, 9, 120, 29], 5], [[54, 8, 74, 19], 5], [[100, 61, 118, 71], 9], [[10, 72, 42, 80], 6],
]
const ROOMS: Array<{ name: string; r: Rect }> = [
  { name: 'Master suite', r: [0, 0, 48, 40] },
  { name: 'Spa bath', r: [48, 0, 80, 40] },
  { name: 'Bedroom', r: [80, 0, W, 40] },
  { name: 'Living & dining', r: [0, 40, 88, D] },
  { name: 'Kitchen', r: [88, 40, W, D] },
  { name: 'Terrace & pool', r: [-10, D, 138, 124] },
]
const area = (r: Rect) => Math.round((r[2] - r[0]) * M * (r[3] - r[1]) * M)

/** 1 at the pointer → .31 at 42% of the radius → .09 at its edge (Hairline's terrain falloff). */
const falloff = (u: number) => (u <= 0 ? 1 : u <= 0.417 ? 1 - (u / 0.417) * 0.6875 : u <= 1 ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185 : 0)
const touches = (a: Rect, b: Rect, e: number) => a[0] < b[2] + e && a[2] > b[0] - e && a[1] < b[3] + e && a[3] > b[1] - e

/** Painter's order for boxes on one ground: A goes first when it lies wholly behind B on one axis and not in front on the other. */
function paintOrder(rs: Rect[]): number[] {
  const e = 0.01, n = rs.length
  const behind = (a: Rect, b: Rect) => (a[2] <= b[0] + e || a[3] <= b[1] + e) && !(b[2] <= a[0] + e || b[3] <= a[1] + e)
  const indeg = new Array(n).fill(0), edges: number[][] = rs.map(() => [])
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && behind(rs[i], rs[j])) { edges[i].push(j); indeg[j]++ }
  const depth = (i: number) => rs[i][0] + rs[i][2] + rs[i][1] + rs[i][3]
  const out: number[] = [], ready = rs.map((_, i) => i).filter((i) => !indeg[i])
  while (ready.length) {
    ready.sort((a, b) => depth(b) - depth(a))
    const i = ready.pop()!
    out.push(i)
    for (const j of edges[i]) if (!--indeg[j]) ready.push(j)
  }
  return out.length === n ? out : rs.map((_, i) => i)
}

export type PlanFigure = Figure & { setProgress(p: number): void }

/** `intensity` widens the pointer's reach, from about 3 m to 7.5 m. */
const reach = (i = 0.5) => lerp(24, 60, clamp(i))

export function planEngine({ stage, svg, read }: FigureEls, o: HairlineOptions = {}): PlanFigure {
  const bag = disposer()
  const C = Cam(45, 0.5, 1.7)
  fit(C, [[-10, -10, -5], [138, 124, -5], [138, -10, -5], [-10, 124, -5], [-4, -4, FLOOR + HMAX + 3]], 200, 165)
  const P = proj(C), front = facing(C)
  const g = mk('g', {}, svg)
  const line = (d: string, cls: string) => mk('path', { d, class: cls }, g)

  // Ground: plinth, terrace pool and stepping stones, dimension lines, the floor slab.
  const [po, pi] = rings(-10, -10, 138, 124, 8, 2.2)
  put(solid(g), prism(P, front, po, pi, -5, 0))
  line(poly(ringAt(P, rrect(64, 102, 124, 118, 2), 0)), 'nf sil')
  line(poly(ringAt(P, rrect(65.6, 103.6, 122.4, 116.4, 1.4), -1.6)), 'nf lo')
  line([106, 110, 114].map((y) => seg(P(70, y, -1.6), P(118, y, -1.6))).join(''), 'nf lo dash')
  line([0, 1, 2].map((k) => poly(ringAt(P, rrect(32, 100 + k * 8, 40, 105 + k * 8, 1), 0))).join(''), 'nf lo')
  let dims = seg(P(-5, 0, 0), P(-5, D, 0)) + seg(P(0, -5, 0), P(W, -5, 0))
  for (let y = 0; y <= D; y += 16) dims += seg(P(-6.5, y, 0), P(-3.5, y, 0))
  for (let x = 0; x <= W; x += 16) dims += seg(P(x, -6.5, 0), P(x, -3.5, 0))
  line(dims, 'nf lo')
  const [fo, fi] = rings(0, 0, W, D, 2, 1.2)
  put(solid(g), prism(P, front, fo, fi, 0, FLOOR))

  // The lit room: a tinted floor and a 3 × 3 mark, under the walls in paint order.
  const tint = mk('path', { class: 'tint', style: 'opacity:0' }, g)
  const mark = mk('g', { style: 'opacity:0' }, g)
  const dots = Array.from({ length: 9 }, (_, k) => flatDot(mark, C, 0.6, k === 4 ? 'dot' : 'dot m'))

  // Walls and furniture, back to front.
  const span = W + D
  const rects: Array<[Rect, number]> = [...WALLS.map((r): [Rect, number] => [r, HMAX]), ...FURNITURE]
  const blocks: Block[] = rects.map(([r, hmax]) => {
    const wall = hmax === HMAX
    const [ring, inner] = rings(r[0], r[1], r[2], r[3], wall ? 0.7 : 1.6, wall ? 0.5 : 0.9)
    const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2
    return { r, hmax, cx, cy, d: (0.9 * (cx + cy)) / span, ring, inner, sp: spring(LOW, { k: 120, c: 20, eps: 0.03 }), el: null as unknown as Solid, drawn: NaN }
  })
  for (const i of paintOrder(blocks.map((b) => b.r))) blocks[i].el = solid(g)

  // The roof floats above everything, so it paints last.
  const roofG = mk('g', { style: 'opacity:0' }, g)
  const roof = solid(roofG)
  roof.sil.classList.add('hi')
  const [ro, ri] = rings(-4, -4, W + 4, D + 4, 3, 2.4)
  const roofSp = spring(FLOOR + HMAX + 70, { k: 90, c: 17, eps: 0.05 })
  let roofDrawn = NaN

  let R = reach(o.intensity), progress = 0, over: Vec2 | null = null, room = -1

  function retarget() {
    const pw = clamp(progress / 0.72), sweep = lerp(-0.25, 1.15, pw)
    for (const b of blocks) {
      const s = smooth(b.d, b.d + 0.25, sweep)
      const f = over ? falloff(Math.hypot(b.cx - over[0], b.cy - over[1]) / R) : 0
      b.sp.t = Math.max(LOW, b.hmax * Math.max(s, f))
    }
    const q = smooth(0.74, 0.98, progress)
    roofSp.t = FLOOR + HMAX + (1 - q) * 70 + (over && room >= 0 && room < 5 ? LIFT : 0)
    roofG.setAttribute('style', `opacity:${smooth(0.72, 0.84, progress).toFixed(3)}`)

    const lit = room >= 0 ? ROOMS[room] : null
    tint.setAttribute('style', `opacity:${lit ? 1 : 0}`)
    mark.setAttribute('style', `opacity:${lit ? 1 : 0}`)
    if (lit) {
      const [x0, y0, x1, y1] = lit.r, z = room === 5 ? 0 : FLOOR
      tint.setAttribute('d', poly(ringAt(P, rrect(x0 + 3.5, y0 + 3.5, x1 - 3.5, y1 - 3.5, 2), z)))
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
      dots.forEach((el, k) => place(el, P(cx + ((k % 3) - 1) * 2.6, cy + (Math.floor(k / 3) - 1) * 2.6, z)))
    }
    for (const b of blocks) b.el.sil.classList.toggle('hi', !!lit && touches(b.r, lit.r, 0.5))

    read(lit ? `${lit.name} · ${area(lit.r)} m²` : progress < 0.12 ? 'Plan · 1:100' : progress < 0.74 ? `Walls · ${Math.round(pw * 100)}%` : 'Volume · 16 × 12 m')
    B.wake()
  }

  const B = register(stage, (dt) => {
    let moving = false
    for (const b of blocks) {
      if (stepS(b.sp, dt)) moving = true
      const h = b.sp.x
      if (h !== b.drawn) { b.drawn = h; put(b.el, prism(P, front, b.ring, b.inner, FLOOR, FLOOR + h)) }
    }
    if (stepS(roofSp, dt)) moving = true
    if (roofSp.x !== roofDrawn) {
      roofDrawn = roofSp.x
      put(roof, prism(P, front, ro, ri, roofSp.x, roofSp.x + 2.6))
    }
    return moving
  })
  bag.add(B.unregister)

  bag.add(pointer(stage, {
    move: (p) => {
      over = unproj(C, p[0], p[1], FLOOR)
      const [x, y] = over
      room = ROOMS.findIndex(({ r }) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3])
      retarget()
    },
    leave: () => { over = null; room = -1; retarget() },
  }))
  bag.add(() => svg.replaceChildren())
  retarget()

  return {
    update: (n) => { if ('intensity' in n) { R = reach(n.intensity); retarget() } },
    setProgress: (p) => { const n = clamp(p); if (Math.abs(n - progress) < 1e-4) return; progress = n; retarget() },
    destroy: bag.dispose,
  }
}
