/**
 * A tiny orthographic projection engine for Bonyan's architectural figures.
 * World units are metres: x/y lie on the ground plane and z points up. The
 * camera orbits a pivot by azimuth `az` and looks down at elevation `el`.
 */
import { clamp } from '../motion'

export type P2 = readonly [number, number]
export type P3 = readonly [number, number, number]
export type RGB = readonly [number, number, number]

export interface Cam {
  az: number
  el: number
  /** pixels per metre */
  s: number
  /** world pivot */
  cx: number
  cy: number
  /** screen pivot */
  ox: number
  oy: number
}

/** World → screen. Returns [x, y, depth]; larger depth is further from the viewer. */
export function proj(c: Cam, x: number, y: number, z: number): [number, number, number] {
  const dx = x - c.cx
  const dy = y - c.cy
  const ca = Math.cos(c.az)
  const sa = Math.sin(c.az)
  const xr = dx * ca - dy * sa
  const yr = dx * sa + dy * ca
  const se = Math.sin(c.el)
  const ce = Math.cos(c.el)
  return [c.ox + xr * c.s, c.oy - (yr * se + z * ce) * c.s, yr * ce - z * se]
}

/** Screen → world point on the horizontal plane at height z. */
export function unproj(c: Cam, sx: number, sy: number, z = 0): [number, number] {
  const se = Math.sin(c.el)
  const ce = Math.cos(c.el)
  const xr = (sx - c.ox) / c.s
  const yr = (-(sy - c.oy) / c.s - z * ce) / se
  const ca = Math.cos(c.az)
  const sa = Math.sin(c.az)
  return [xr * ca + yr * sa + c.cx, -xr * sa + yr * ca + c.cy]
}

/** Scale and centre the camera so every point fits inside w×h with `pad` px of margin. */
export function fit(c: Cam, pts: P3[], w: number, h: number, pad: number) {
  const probe = { ...c, s: 1, ox: 0, oy: 0 }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of pts) {
    const [x, y] = proj(probe, p[0], p[1], p[2])
    x0 = Math.min(x0, x); x1 = Math.max(x1, x)
    y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  const s = Math.max(1, Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0)))
  return { s, ox: w / 2 - s * (x0 + x1) / 2, oy: h / 2 - s * (y0 + y1) / 2 }
}

export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export const rect = (x0: number, y0: number, x1: number, y1: number): P2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** Footprint of a wall segment a→b with thickness t. */
export function slab(a: P2, b: P2, t: number): P2[] {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  const nx = (-dy / l) * t / 2, ny = (dx / l) * t / 2
  return [[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]]
}

/**
 * A wall footprint split into short, slightly overlapping chunks. Long walls
 * sorted by a single centroid paint over neighbours; short chunks keep the
 * painter's algorithm honest.
 */
export function slabChunks(a: P2, b: P2, t: number, max = 1.4): P2[][] {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const n = Math.max(1, Math.ceil(len / max))
  const o = n > 1 ? 0.015 / len : 0
  const out: P2[][] = []
  for (let i = 0; i < n; i++) {
    const u0 = Math.max(0, i / n - o), u1 = Math.min(1, (i + 1) / n + o)
    out.push(slab([a[0] + dx * u0, a[1] + dy * u0], [a[0] + dx * u1, a[1] + dy * u1], t))
  }
  return out
}

const area = (fp: readonly P2[]) => {
  let s = 0
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i], b = fp[(i + 1) % fp.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

export function path(ctx: CanvasRenderingContext2D, pts: readonly (readonly number[])[], close = true) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  if (close) ctx.closePath()
}

export interface Solid {
  fp: readonly P2[]
  z0: number
  z1: number
  top: string
  dark: RGB
  light: RGB
  edge?: string
  alpha?: number
}

export const depthOf = (c: Cam, fp: readonly P2[], z: number) => {
  let x = 0, y = 0
  for (const p of fp) { x += p[0]; y += p[1] }
  return proj(c, x / fp.length, y / fp.length, z)[2]
}

// Light arrives from the viewer's front-left, expressed in camera space.
const LX = -0.62, LY = -0.78

/** Draws a vertical prism: only camera-facing sides (Lambert shaded), then the top. */
export function drawSolid(ctx: CanvasRenderingContext2D, c: Cam, s: Solid) {
  const fp = area(s.fp) >= 0 ? s.fp : [...s.fp].reverse()
  const n = fp.length
  const ca = Math.cos(c.az), sa = Math.sin(c.az)
  const top = fp.map((p) => proj(c, p[0], p[1], s.z1))
  ctx.globalAlpha = s.alpha ?? 1
  ctx.lineWidth = 1
  if (s.z1 - s.z0 > 1e-3) {
    const bot = fp.map((p) => proj(c, p[0], p[1], s.z0))
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const nx = fp[j][1] - fp[i][1], ny = -(fp[j][0] - fp[i][0])
      const nyr = nx * sa + ny * ca
      if (nyr >= -1e-6) continue // faces away from the viewer
      const nxr = nx * ca - ny * sa
      const lam = clamp(0.5 + 0.5 * ((nxr * LX + nyr * LY) / (Math.hypot(nxr, nyr) || 1)))
      path(ctx, [bot[i], bot[j], top[j], top[i]])
      ctx.fillStyle = rgba(mixRGB(s.dark, s.light, lam))
      ctx.fill()
      if (s.edge) { ctx.strokeStyle = s.edge; ctx.stroke() }
    }
  }
  path(ctx, top)
  ctx.fillStyle = s.top
  ctx.fill()
  if (s.edge) { ctx.strokeStyle = s.edge; ctx.stroke() }
  ctx.globalAlpha = 1
}

/** Draws a prism as a ghosted wireframe. */
export function drawWire(ctx: CanvasRenderingContext2D, c: Cam, fp: readonly P2[], z0: number, z1: number, stroke: string) {
  const bot = fp.map((p) => proj(c, p[0], p[1], z0))
  const top = fp.map((p) => proj(c, p[0], p[1], z1))
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  path(ctx, top); ctx.stroke()
  if (z1 - z0 > 1e-3) {
    path(ctx, bot); ctx.stroke()
    ctx.beginPath()
    bot.forEach((b, i) => { ctx.moveTo(b[0], b[1]); ctx.lineTo(top[i][0], top[i][1]) })
    ctx.stroke()
  }
}

/** A flat polygon lying on the plane z. */
export function drawFlat(ctx: CanvasRenderingContext2D, c: Cam, fp: readonly P2[], z: number, fill?: string, stroke?: string) {
  path(ctx, fp.map((p) => proj(c, p[0], p[1], z)))
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke() }
}

/** Architectural dimension line a→b on plane z, with end ticks and a knocked-out label. */
export function dimension(ctx: CanvasRenderingContext2D, c: Cam, a: P2, b: P2, z: number, label: string, color: RGB, alpha: number, bg: string) {
  const A = proj(c, a[0], a[1], z), B = proj(c, b[0], b[1], z)
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
  const n: P2 = [(-dy / l) * 0.22, (dx / l) * 0.22]
  ctx.strokeStyle = rgba(color, 0.7 * alpha)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(A[0], A[1])
  ctx.lineTo(B[0], B[1])
  for (const p of [a, b]) {
    const u = proj(c, p[0] - n[0], p[1] - n[1], z), v = proj(c, p[0] + n[0], p[1] + n[1], z)
    ctx.moveTo(u[0], u[1])
    ctx.lineTo(v[0], v[1])
  }
  ctx.stroke()
  let ang = Math.atan2(B[1] - A[1], B[0] - A[0])
  if (ang > Math.PI / 2) ang -= Math.PI
  if (ang < -Math.PI / 2) ang += Math.PI
  ctx.save()
  ctx.translate((A[0] + B[0]) / 2, (A[1] + B[1]) / 2)
  ctx.rotate(ang)
  ctx.font = '500 11px "DM Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(label).width + 12
  ctx.globalAlpha = alpha
  ctx.fillStyle = bg
  ctx.fillRect(-w / 2, -8, w, 16)
  ctx.fillStyle = rgba(color, 1)
  ctx.fillText(label, 0, 0)
  ctx.restore()
}

/** Sizes a canvas for crisp rendering and returns its 2D context in CSS pixels. */
export function sizeCanvas(cv: HTMLCanvasElement, w: number, h: number, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
  cv.width = Math.round(w * dpr)
  cv.height = Math.round(h * dpr)
  const ctx = cv.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}
