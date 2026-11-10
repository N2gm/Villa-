import type { Figure, HairlineOptions } from '@lucasmarkes/hairline'
import {
  Cam, circ, clamp, disposer, facing, fit, hull, lerp, mk, open, pointer, poly, prism, proj, put, r2, reducedMotion, register, ringAt, rings, seg, smooth, solid, spring, stepS, uniqueId,
  type FigureEls, type Vec2, type Vec3,
} from './kernel'

/**
 * Sun Study. A villa's massing on a round plinth under Cairo's sky. Across
 * the figure is the time of day, from sunrise on the left to sunset on the
 * right; up and down is the season, from the high June sun to the low
 * December one. The sun runs its true arc for latitude 30° N and every
 * volume throws its shadow, hatched, onto the plinth. With `play` the day
 * passes on its own until the pointer arrives.
 *
 * The viewer faces south, so east is on the left and the shadows fall
 * forward. 1 unit = 25 cm.
 */

const deg = Math.PI / 180
const LAT = 30.04 * deg, TILT = 23.44 * deg, NOON = 11 + 55 / 60
const RS = 112, PR = 72
const N: Vec2 = [Math.SQRT1_2, Math.SQRT1_2], E: Vec2 = [-Math.SQRT1_2, Math.SQRT1_2]
const REST = { u: 0.36, s: 0.35 }

/** Half the day, as an hour angle, for a season from -1 (December) to 1 (June). */
const halfDay = (s: number) => Math.acos(clamp(-Math.tan(LAT) * Math.tan(TILT * s), -1, 1))

function sunAt(s: number, H: number) {
  const d = TILT * s
  const alt = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H))
  // Azimuth from north, clockwise through east.
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(d) * Math.cos(LAT)) + Math.PI
  const c = Math.cos(alt), ca = Math.cos(az), sa = Math.sin(az)
  const dir: Vec3 = [c * (ca * N[0] + sa * E[0]), c * (ca * N[1] + sa * E[1]), Math.sin(alt)]
  return { dir, alt, clock: NOON + H / deg / 15 }
}

const hhmm = (h: number) => {
  const m = Math.round(h * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** The spring date on which the sun reaches this declination. */
const dateOf = (s: number) =>
  new Date(2026, 0, 1 + Math.round(79 + (Math.asin(clamp(s, -1, 1)) / (2 * Math.PI)) * 365.25)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

type Box = { r: [number, number, number, number]; z0: number; z1: number }
const BOXES: Box[] = [
  { r: [-42, -4, -30, 10], z0: 0, z1: 34 }, // stair tower
  { r: [-30, -18, 20, 14], z0: 0, z1: 14 }, // ground floor
  { r: [-18, -24, 38, 4], z0: 14, z1: 25 }, // cantilevered upper floor
]
type Tree = { x: number; y: number; h: number; r: number }
const BACK_TREES: Tree[] = [{ x: -50, y: -34, h: 11, r: 8 }]
const FRONT_TREES: Tree[] = [{ x: 42, y: 30, h: 9, r: 7 }, { x: -46, y: 40, h: 8, r: 6 }, { x: 52, y: 4, h: 7, r: 5 }]

export function sunEngine({ stage, svg, read }: FigureEls, o: HairlineOptions = {}): Figure {
  const bag = disposer()
  const C = Cam(45, 0.5, 1.05)
  // Rebuilt whenever the camera turns; draw() only touches the dynamic parts.
  let P = proj(C), front = facing(C)
  let g!: SVGGElement, today!: Element, trunkShadows!: Element, beam!: Element, rays!: Element, disc!: Element, sunG!: Element, shade!: Element
  let tints: Element[] = [], hatches: Element[] = [], rayPath = ''
  const casters = [...BOXES, ...BACK_TREES, ...FRONT_TREES]
  const line = (d: string, cls: string, parent: Element = g) => mk('path', { d, class: cls }, parent)
  const arcOf = (s: number) => {
    const h0 = halfDay(s), pts: Vec2[] = []
    for (let k = 0; k <= 48; k++) {
      const d = sunAt(s, lerp(-h0, h0, k / 48)).dir
      pts.push(P(d[0] * RS, d[1] * RS, Math.max(0, d[2]) * RS))
    }
    return open(pts)
  }

  function build() {
  svg.replaceChildren()
  const ring8: Vec3[] = Array.from({ length: 8 }, (_, k) => [Math.cos(k * 45 * deg) * PR, Math.sin(k * 45 * deg) * PR, -5] as Vec3)
  fit(C, [...ring8, [0, 0, 40]], 200, 218)
  P = proj(C)
  front = facing(C)
  g = mk('g', {}, svg) as SVGGElement

  // Hatching and the plinth top it is clipped to.
  const hatchId = uniqueId('hl-hatch-'), clipId = uniqueId('hl-clip-')
  const defs = mk('defs', {}, g)
  const pat = mk('pattern', { id: hatchId, patternUnits: 'userSpaceOnUse', width: 3.2, height: 3.2, patternTransform: 'rotate(45)' }, defs)
  mk('path', { d: 'M0 0V3.2', class: 'hatch' }, pat)
  const top = poly(ringAt(P, circ(PR, 72), 0))
  mk('path', { d: top }, mk('clipPath', { id: clipId }, defs))

  // Sky: the horizon with its compass, the solstice arcs, then today's arc.
  line(poly(ringAt(P, circ(RS, 96), 0)), 'nf lo dash')
  let ticks = '', cardinals = ''
  for (let k = 0; k < 36; k++) {
    const a = k * 10 * deg, card = k % 9 === 0
    const dx = Math.cos(a) * N[0] + Math.sin(a) * E[0], dy = Math.cos(a) * N[1] + Math.sin(a) * E[1]
    const d = seg(P(dx * (RS - (card ? 5 : 2.5)), dy * (RS - (card ? 5 : 2.5)), 0), P(dx * (RS + (card ? 6 : 2.5)), dy * (RS + (card ? 6 : 2.5)), 0))
    if (card) cardinals += d
    else ticks += d
  }
  line(ticks, 'nf lo')
  line(cardinals, 'nf mid')
  ;(['N', 'E', 'S', 'W'] as const).forEach((t, k) => {
    const a = k * 90 * deg, q = P((Math.cos(a) * N[0] + Math.sin(a) * E[0]) * (RS + 14), (Math.cos(a) * N[1] + Math.sin(a) * E[1]) * (RS + 14), 0)
    mk('text', { x: r2(q[0]), y: r2(q[1] + 3), class: t === 'N' ? 'lbl hi' : 'lbl' }, g).textContent = t
  })
  line(arcOf(1) + arcOf(-1), 'nf lo dash')
  today = line('', 'nf mid dash')

  // Ground: plinth, pool, path.
  put(solid(g), prism(P, front, circ(PR, 72), circ(PR - 2.5, 72), -5, 0))
  line(poly(ringAt(P, rings(2, 22, 30, 36, 1.5, 1)[0], 0)) + poly(ringAt(P, rings(3.2, 23.2, 28.8, 34.8, 1, 1)[0], -1)), 'nf lo')
  line([0, 1, 2, 3].map((k) => poly(ringAt(P, rings(-22 + k * 0.6, 20 + k * 9, -14 + k * 0.6, 25 + k * 9, 1, 0.5)[0], 0))).join(''), 'nf lo')

  // Shadows: one tint group (so overlaps do not darken) under one hatch group, both on the plinth only.
  shade = mk('g', { 'clip-path': `url(#${clipId})` }, g)
  const tintG = mk('g', { class: 'shade' }, shade)
  const hatchG = mk('g', { fill: `url(#${hatchId})` }, shade)
  tints = casters.map(() => mk('path', {}, tintG))
  hatches = casters.map(() => mk('path', {}, hatchG))
  trunkShadows = line('', 'nf mid', shade)

  // Volumes, back to front, and the trees around them.
  const tree = (t: Tree) => {
    line(seg(P(t.x, t.y, 0), P(t.x, t.y, t.h + t.r * 0.3)), 'nf mid')
    const c = P(t.x, t.y, t.h + t.r)
    mk('circle', { cx: r2(c[0]), cy: r2(c[1]), r: r2(t.r * C.S), class: 'sil' }, g)
    const eq: Vec2[] = []
    for (let k = 0; k <= 16; k++) {
      const a = -45 * deg + (k / 16) * Math.PI
      eq.push(P(t.x + Math.cos(a) * t.r * 0.72, t.y + Math.sin(a) * t.r * 0.72, t.h + t.r * 0.72))
    }
    line(open(eq), 'nf lo')
  }
  // Painter's order for the current view: far to near, upper floors after the floor below.
  const depth = (x: number, y: number) => x * Math.sin(C.az) + y * Math.cos(C.az)
  const items = [
    ...BOXES.map((b) => ({ d: depth((b.r[0] + b.r[2]) / 2, (b.r[1] + b.r[3]) / 2) + b.z0 * 2, f: () => {
      const [ring, inner] = rings(b.r[0], b.r[1], b.r[2], b.r[3], 1.2, 0.8)
      put(solid(g), prism(P, front, ring, inner, b.z0, b.z1))
    } })),
    ...[...BACK_TREES, ...FRONT_TREES].map((t) => ({ d: depth(t.x, t.y), f: () => tree(t) })),
  ]
  items.sort((a, b) => a.d - b.d).forEach((it) => it.f())

  // The sun, with a faint line down to the house.
  sunG = mk('g', {}, g)
  beam = line('', 'nf hi dash', sunG)
  rays = line('', 'nf ray', sunG)
  disc = mk('circle', { r: 5.5, class: 'sun' }, sunG)
  rayPath = ''
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    rayPath += seg([Math.cos(a) * 9, Math.sin(a) * 9], [Math.cos(a) * 13, Math.sin(a) * 13])
  }

  arcFor = NaN
  }

  const tSp = spring(REST.u, { k: 60, c: 14, eps: 0.0005 })
  const sSp = spring(REST.s, { k: 60, c: 14, eps: 0.0005 })
  let play = !!o.play, over = false, leftAt = -1e9, auto = false, clockT = REST.u, drawn = '', arcFor = NaN

  function draw(u: number, s: number, alpha: number) {
    const h0 = halfDay(s)
    const sun = sunAt(s, lerp(-h0, h0, lerp(0.05, 0.95, u)))
    const [dx, dy] = sun.dir, dz = Math.max(sun.dir[2], Math.sin(4 * deg))
    const cast = (x: number, y: number, z: number): Vec2 => [x - (z * dx) / dz, y - (z * dy) / dz]

    casters.forEach((c, i) => {
      const w: Vec2[] = []
      if ('z0' in c) {
        const [x0, y0, x1, y1] = c.r
        for (const z of [c.z0, c.z1]) w.push(cast(x0, y0, z), cast(x1, y0, z), cast(x1, y1, z), cast(x0, y1, z))
      } else {
        const cz = c.h + c.r
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2
          w.push(cast(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, cz))
        }
        w.push(cast(c.x, c.y, cz + c.r), cast(c.x, c.y, cz - c.r))
      }
      const d = poly(hull(w).map((q) => P(q[0], q[1], 0)))
      tints[i].setAttribute('d', d)
      hatches[i].setAttribute('d', d)
    })
    trunkShadows.setAttribute('d', [...BACK_TREES, ...FRONT_TREES].map((t) => seg(P(t.x, t.y, 0), P(...cast(t.x, t.y, t.h), 0))).join(''))

    if (s !== arcFor) { arcFor = s; today.setAttribute('d', arcOf(s)) }
    const q = P(sun.dir[0] * RS, sun.dir[1] * RS, sun.dir[2] * RS)
    disc.setAttribute('cx', String(r2(q[0])))
    disc.setAttribute('cy', String(r2(q[1])))
    rays.setAttribute('d', rayPath)
    rays.setAttribute('transform', `translate(${r2(q[0])} ${r2(q[1])})`)
    beam.setAttribute('d', seg(q, P(-6, -4, 14)))
    sunG.setAttribute('style', `opacity:${r2(alpha)}`)
    shade.setAttribute('style', `opacity:${r2(alpha * lerp(0.55, 1, smooth(0, 25 * deg, sun.alt)))}`)

    const text = `${hhmm(sun.clock)} · ${Math.round(sun.alt / deg)}° · ${dateOf(s)}`
    if (text !== drawn) { drawn = text; read(text) }
  }

  let lastAlpha = 1, dragging = false
  build()

  const B = register(stage, (dt, now) => {
    const wantAuto = play && !over && !reducedMotion() && now - leftAt > 2200
    if (wantAuto && !auto) { clockT = tSp.x; sSp.t = REST.s }
    auto = wantAuto
    let moving = false
    if (auto) {
      clockT += dt / 11
      if (clockT >= 1) clockT -= 1
      tSp.x = tSp.t = clockT
      tSp.v = 0
      moving = true
    } else if (!over && !play) {
      tSp.t = REST.u
      sSp.t = REST.s
    }
    if (stepS(tSp, dt)) moving = true
    if (stepS(sSp, dt)) moving = true
    const alpha = auto ? smooth(0, 0.035, clockT) * (1 - smooth(0.965, 1, clockT)) : 1
    lastAlpha = alpha
    draw(tSp.x, sSp.x, alpha)
    // While the pointer has just left, keep ticking until autoplay resumes.
    return moving || (play && !over && !auto && !reducedMotion())
  })
  bag.add(B.unregister)

  bag.add(pointer(stage, {
    move: (p) => {
      if (dragging) return
      over = true
      tSp.t = clamp((p[0] - 48) / 304)
      sSp.t = 1 - 2 * clamp((p[1] - 56) / 208)
      B.wake()
    },
    leave: () => { over = false; leftAt = performance.now(); B.wake() },
  }))
  // Hold the left button (or drag a finger sideways) to turn the model; up/down tilts it.
  let last: Vec2 = [0, 0]
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragging = true
    over = true
    last = [e.clientX, e.clientY]
    stage.setPointerCapture?.(e.pointerId)
    stage.style.cursor = 'grabbing'
  }
  const move = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - last[0], dy = e.clientY - last[1]
    last = [e.clientX, e.clientY]
    C.az += dx * 0.6 * deg
    C.k = clamp(C.k - dy * 0.004, 0.22, 0.9)
    build()
    draw(tSp.x, sSp.x, lastAlpha)
  }
  const up = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    stage.releasePointerCapture?.(e.pointerId)
    stage.style.cursor = 'grab'
    if (e.type === 'pointercancel') { over = false; leftAt = performance.now() }
    B.wake()
  }
  stage.style.cursor = 'grab'
  stage.addEventListener('pointerdown', down)
  stage.addEventListener('pointermove', move)
  stage.addEventListener('pointerup', up)
  stage.addEventListener('pointercancel', up)
  bag.add(() => {
    stage.removeEventListener('pointerdown', down)
    stage.removeEventListener('pointermove', move)
    stage.removeEventListener('pointerup', up)
    stage.removeEventListener('pointercancel', up)
    stage.style.cursor = ''
  })
  bag.add(() => svg.replaceChildren())

  return {
    update: (n) => { if ('play' in n) { play = !!n.play; B.wake() } },
    destroy: bag.dispose,
  }
}
