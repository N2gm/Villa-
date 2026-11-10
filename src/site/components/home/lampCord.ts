/**
 * A hanging lamp as a Verlet cord: a short chain of particles pinned at the ceiling, a heavy shade at the
 * free end, gravity pulling it down and air drag slowing it. Distance constraints keep the chain at its
 * length, so the whole thing swings and settles like a real pendant instead of following a canned spring.
 * A pointer (mouse or fingertip) is a moving disc the particles cannot enter: it pushes the cord aside,
 * carries it for as long as it stays in contact and lets go with exactly the speed it had, so a slow brush
 * barely stirs the lamp and a quick flick sends it swinging.
 */

export const G = 1000 // px/s², tuned so a 120 px cord swings with a period near two seconds

export type Disc = { x: number; y: number; r: number }

export class Cord {
  readonly n: number
  readonly seg: number
  x: Float64Array
  y: Float64Array
  px: Float64Array
  py: Float64Array
  /** inverse mass: 0 for the pinned end, small for the heavy shade */
  private w: Float64Array
  /** collision radius of each particle */
  private rad: Float64Array
  /** whether the pointer was already in contact with a particle on the previous step */
  private touching: Uint8Array
  private vpx = 0
  private vpy = 0

  readonly length: number

  constructor(length: number, n = 9, tipRadius = 26) {
    this.length = length
    this.n = n
    this.seg = length / (n - 1)
    this.x = new Float64Array(n)
    this.y = new Float64Array(n)
    this.px = new Float64Array(n)
    this.py = new Float64Array(n)
    this.w = new Float64Array(n).fill(1)
    this.rad = new Float64Array(n).fill(3)
    this.touching = new Uint8Array(n)
    this.w[0] = 0
    this.w[n - 1] = 0.3
    this.rad[n - 1] = tipRadius
    for (let i = 0; i < n; i++) {
      this.y[i] = this.py[i] = i * this.seg
    }
  }

  /** Total mechanical energy proxy, used to let a calm lamp rest. */
  speed() {
    const i = this.n - 1
    return Math.hypot(this.x[i] - this.px[i], this.y[i] - this.py[i])
  }

  /**
   * Advance by `dt` seconds with gravity (gx, gy) in px/s². `from`/`to` is the pointer disc at the start and end
   * of this step; pass null when nothing is touching the lamp.
   */
  step(dt: number, gx: number, gy: number, from: Disc | null, to: Disc | null) {
    const { n, x, y, px, py, w, rad } = this
    // More substeps while the pointer is quick, so it can never jump clean over the cord.
    const travel = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0
    const sub = Math.min(32, Math.max(4, Math.ceil(travel / 8)))
    const h = dt / sub
    this.vpx = from && to ? (to.x - from.x) / dt : 0
    this.vpy = from && to ? (to.y - from.y) / dt : 0
    if (!from || !to) this.touching.fill(0)
    for (let s = 0; s < sub; s++) {
      // Air drag: a pendulum of this size loses roughly a third of its swing per second.
      const keep = Math.exp(-0.42 * h)
      for (let i = 1; i < n; i++) {
        const vx = (x[i] - px[i]) * keep
        const vy = (y[i] - py[i]) * keep
        px[i] = x[i]
        py[i] = y[i]
        x[i] += vx + gx * h * h
        y[i] += vy + gy * h * h
      }
      for (let it = 0; it < 7; it++) {
        for (let i = 0; i < n - 1; i++) {
          const dx = x[i + 1] - x[i]
          const dy = y[i + 1] - y[i]
          const d = Math.hypot(dx, dy) || 1e-6
          const k = (d - this.seg) / d / (w[i] + w[i + 1])
          x[i] += dx * k * w[i]
          y[i] += dy * k * w[i]
          x[i + 1] -= dx * k * w[i + 1]
          y[i + 1] -= dy * k * w[i + 1]
        }
        if (from && to) this.collide(from, to, (s + 1) / sub, h)
      }
      // The ceiling is solid: nothing in the cord can swing up through it.
      for (let i = 1; i < n; i++) {
        if (y[i] < 0) {
          y[i] = 0
          py[i] = Math.max(py[i], 0)
        }
      }
      // The pinned end never moves.
      x[0] = px[0] = 0
      y[0] = py[0] = 0
    }
  }

  private collide(a: Disc, b: Disc, t: number, hdt: number) {
    const cx = a.x + (b.x - a.x) * t
    const cy = a.y + (b.y - a.y) * t
    for (let i = 1; i < this.n; i++) {
      const R = this.rad[i] + b.r
      const dx = this.x[i] - cx
      const dy = this.y[i] - cy
      const d2 = dx * dx + dy * dy
      if (d2 >= R * R) {
        this.touching[i] = 0
        continue
      }
      const d = Math.sqrt(d2)
      let nx: number
      let ny: number
      if (d > 1e-4) {
        nx = dx / d
        ny = dy / d
      } else {
        // Dead centre: leave the way the disc is travelling.
        const m = Math.hypot(this.vpx, this.vpy) || 1
        nx = this.vpx / m
        ny = this.vpy / m
      }
      // The disc carries the particle out of its way. That shift is positional only: it must not read as speed.
      let sx = cx + nx * R - this.x[i]
      let sy = cy + ny * R - this.y[i]
      // A quick pass slips by faster than the cord can be shoved: it is only nudged a little each substep.
      const sl = Math.hypot(sx, sy)
      if (sl > 2.5) {
        sx *= 2.5 / sl
        sy *= 2.5 / sl
      }
      this.x[i] += sx
      this.y[i] += sy
      this.px[i] += sx
      this.py[i] += sy
      if (!this.touching[i]) {
        // First contact: the pointer hands over momentum along its own direction. It grows with the pointer's speed
        // and saturates, so a slow brush stirs the lamp, a quick pass swings it, and no flick can loop it over the ceiling.
        this.touching[i] = 1
        const sp = Math.hypot(this.vpx, this.vpy)
        if (sp > 1) {
          const dv = 380 * Math.tanh(sp / 700)
          this.px[i] -= (this.vpx / sp) * dv * hdt
          this.py[i] -= (this.vpy / sp) * dv * hdt
        }
      }
    }
  }

  /** Unit vector the shade points along (from the cord into the lamp). */
  dir(): [number, number] {
    const i = this.n - 1
    const j = i - 2
    const dx = this.x[i] - this.x[j]
    const dy = this.y[i] - this.y[j]
    const d = Math.hypot(dx, dy) || 1
    return [dx / d, dy / d]
  }
}
