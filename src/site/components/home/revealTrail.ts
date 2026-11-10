/**
 * Pointer "flood" mask for the hero's structure reveal.
 *
 * A small grid holds 1 where nothing has been revealed and 0 where the pointer
 * just passed. Each step the pointer drags a soft round stroke into the grid,
 * the darkest values spread outwards through a noisy field (so the edge flows
 * like ink rather than a circle), and everything slowly drifts back to 1.
 * The grid is uploaded to the hero shader as a low-resolution texture; the
 * GPU's linear filtering smooths it at screen size.
 */

const STEP = 1 / 60
const FADE = 0.015
const RADIUS = 0.17 // stroke radius, as a fraction of the screen width
const SPREAD_EVERY = 2 // steps between spreading passes

export class RevealTrail {
  readonly w = 160
  /** Stroke radius as a fraction of the screen width; the hero widens it on touch and small screens. */
  radius = RADIUS
  h = 90
  /** 0..255, 255 = nothing revealed. Row 0 is the top of the screen. */
  bytes = new Uint8Array(this.w * this.h).fill(255)
  private val = new Float32Array(this.w * this.h).fill(1)
  private tmp = new Float32Array(this.w * this.h)
  private ox = new Uint8Array(this.w * this.h)
  private oy = new Uint8Array(this.w * this.h)
  private cx = 0
  private cy = 0
  private px = 0
  private py = 0
  private started = false
  private opacity = 0
  private acc = 0
  private n = 0

  constructor() {
    this.resize(16 / 9)
  }

  /** Re-fit the grid to the screen's aspect ratio (clears the mask). */
  resize(aspect: number) {
    const h = Math.max(24, Math.round(this.w / Math.max(0.2, aspect)))
    if (h === this.h && this.n > 0) return
    this.h = h
    const len = this.w * h
    this.bytes = new Uint8Array(len).fill(255)
    this.val = new Float32Array(len).fill(1)
    this.tmp = new Float32Array(len)
    this.ox = new Uint8Array(len)
    this.oy = new Uint8Array(len)
    // Smooth, static noise decides which cells pull from their neighbours, so the flood spreads unevenly.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < this.w; x++) {
        const a = Math.sin(x * 0.21 + y * 0.13) + Math.sin(x * 0.07 - y * 0.19 + 1.7) + Math.sin(x * 0.13 + y * 0.31 + 4.1)
        const b = Math.sin(x * 0.17 - y * 0.23 + 2.3) + Math.sin(x * 0.29 + y * 0.09 + 0.6) + Math.sin(x * 0.05 + y * 0.17 + 3.4)
        this.ox[y * this.w + x] = a > 0.55 ? (a > 1.9 ? 2 : 1) : 0
        this.oy[y * this.w + x] = b > 0.55 ? (b > 1.9 ? 2 : 1) : 0
      }
    }
    this.n++
  }

  /** Advance by `dt` seconds. `x`/`y` are the pointer in 0..1 screen space, or null when it is away. */
  update(dt: number, x: number | null, y: number | null) {
    this.acc = Math.min(this.acc + dt, STEP * 4)
    let dirty = false
    while (this.acc >= STEP) {
      this.acc -= STEP
      this.step(x, y)
      dirty = true
    }
    if (dirty) {
      const v = this.val
      for (let i = 0; i < v.length; i++) this.bytes[i] = Math.round(v[i] * 255)
    }
    return dirty
  }

  private step(x: number | null, y: number | null) {
    const { w, h, val } = this
    let moving = false
    if (x != null && y != null) {
      const tx = x * w
      const ty = y * h
      if (!this.started) {
        this.started = true
        this.cx = this.px = tx
        this.cy = this.py = ty
      } else {
        this.px = this.cx
        this.py = this.cy
        this.cx += (tx - this.cx) * 0.075
        this.cy += (ty - this.cy) * 0.075
        moving = Math.hypot(this.cx - this.px, this.cy - this.py) > 0.02
      }
    }
    this.opacity = moving ? Math.min(1, this.opacity + 0.1) : Math.max(0, this.opacity - 0.1)
    if (this.started && this.opacity > 0.01) this.stamp()

    if (++this.steps % SPREAD_EVERY === 0) this.spread()
    for (let i = 0; i < val.length; i++) {
      const f = val[i] + FADE
      val[i] = f > 1 ? 1 : f
    }
  }
  private steps = 0

  /** Soft round stroke from the last to the current pointer position. */
  private stamp() {
    const { w, h, val } = this
    const r = this.radius * w
    const x0 = Math.max(0, Math.floor(Math.min(this.px, this.cx) - r))
    const x1 = Math.min(w - 1, Math.ceil(Math.max(this.px, this.cx) + r))
    const y0 = Math.max(0, Math.floor(Math.min(this.py, this.cy) - r))
    const y1 = Math.min(h - 1, Math.ceil(Math.max(this.py, this.cy) + r))
    const dx = this.cx - this.px
    const dy = this.cy - this.py
    const len2 = dx * dx + dy * dy
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let t = len2 > 0 ? ((x - this.px) * dx + (y - this.py) * dy) / len2 : 0
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const d = Math.hypot(x - (this.px + dx * t), y - (this.py + dy * t)) / r
        if (d >= 1) continue
        const s = 1 - d * d * (3 - 2 * d) // smoothstep falloff
        const v = 1 - this.opacity * s
        const i = y * w + x
        if (v < val[i]) val[i] = v
      }
    }
  }

  /** Each cell takes the darkest value among itself and neighbours at its noise offset. */
  private spread() {
    const { w, h, val, tmp, ox, oy } = this
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const a = ox[i]
        const b = oy[i]
        let m = val[i]
        if (a) {
          const l = val[y * w + Math.max(0, x - a)]
          const r = val[y * w + Math.min(w - 1, x + a)]
          if (l < m) m = l
          if (r < m) m = r
        }
        if (b) {
          const u = val[Math.max(0, y - b) * w + x]
          const d = val[Math.min(h - 1, y + b) * w + x]
          if (u < m) m = u
          if (d < m) m = d
        }
        tmp[i] = m
      }
    }
    val.set(tmp)
  }
}
