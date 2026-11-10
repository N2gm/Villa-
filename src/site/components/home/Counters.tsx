"use client"
import { useEffect, useId, useRef } from "react"
import { useInView } from "../../hooks"
import { Spring, clamp, useFrame, useReducedMotion, wake } from "../../motion"
import { Cord, G, type Disc } from "./lampCord"

const stats = [
  { to: 126, label: "Success Projects" },
  { to: 13, label: "Years of experience" },
  { to: 72, label: "Satisfied customer" },
  { to: 15, label: "Location" },
]

const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
/** Gap between the lamp's shade and the top of the figures. */
const FIG_TOP = 120

/**
 * Mechanical odometer: one spring drives the value and every wheel derives its
 * position from it, so a wheel only turns while the wheel to its right rolls
 * from 9 over to 0. Spinning wheels blur and lean with their own speed.
 */
function Odometer({
  to,
  delay,
}: {
  to: number
  delay: number
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5)
  const places = String(to).length
  const wheels = useRef<(HTMLSpanElement | null)[]>([])
  const spring = useRef(new Spring(0, 34, 10.5))

  useEffect(() => {
    // Leaving the screen winds the wheels back to zero; returning counts up again.
    const t = setTimeout(() => {
      spring.current.target = inView ? to : 0
      wake()
    }, inView ? delay : 0)
    return () => clearTimeout(t)
  }, [inView, to, delay])

  useFrame((dt) => {
    const s = spring.current
    const moving = s.step(dt)
    const x = Math.max(0, s.x)
    for (let k = 0; k < places; k++) {
      const el = wheels.current[k]
      if (!el) continue
      const place = 10 ** (places - 1 - k)
      const pos =
        (Math.floor(x / place) % 10) + Math.max(0, (x % place) - (place - 1))
      const speed = Math.abs(s.v) / place
      el.style.transform = `translateY(${-pos}em) skewX(${clamp(s.v / place / 14, -1, 1) * -9}deg)`
      el.style.filter =
        speed > 1.5 ? `blur(${Math.min(3.5, speed * 0.05).toFixed(2)}px)` : ""
      // Wheels the count has not reached yet read as ghosted leading zeros.
      el.parentElement!.style.opacity = String(
        k === places - 1 ? 1 : 0.16 + 0.84 * clamp(x - (place - 1)),
      )
    }
    return moving
  }, true)

  return (
    <div ref={ref} className="relative">
      <p className="sr-only">
        {to}+
      </p>
      <div
        aria-hidden="true"
        className="relative flex font-display text-7xl font-extralight leading-none tracking-tight md:text-8xl"
      >
        {Array.from({ length: places }, (_, k) => (
          <span
            key={k}
            className="relative h-[1em] w-[0.6em] overflow-hidden text-center"
          >
            <span
              ref={(el) => {
                wheels.current[k] = el
              }}
              className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
            >
              {CELLS.map((d, i) => (
                <span
                  key={i}
                  className="flex h-[1em] items-center justify-center tabular-nums"
                >
                  {d}
                </span>
              ))}
            </span>
          </span>
        ))}
        <span className="ml-1">+</span>
      </div>
    </div>
  )
}

/* ---------- Pendant lamps ---------- */

// Cord lengths in px: staggered so the four swing at slightly different rates.
const CORDS = [118, 150, 104, 136]
const BEAM = 520 // how far the cone of light reaches
const PTR = 11 // radius of the pointer as an obstacle

/** The lamp, drawn from the cord's particles every frame. */
function Lamp({ id, cord, set }: { id: string; cord: number; set: (els: LampEls | null) => void }) {
  return (
    <svg
      ref={(svg) => {
        if (!svg) return set(null)
        set({
          path: svg.querySelector("[data-cord]") as SVGPathElement,
          shade: svg.querySelector("[data-shade]") as SVGGElement,
          beam: svg.querySelector("[data-beam]") as SVGPolygonElement,
          fade: svg.querySelector(`[id$="-fade"]`) as SVGLinearGradientElement,
        })
      }}
      aria-hidden="true"
      width="2"
      height="2"
      className="pointer-events-none absolute left-1/2 top-0 overflow-visible"
    >
      <defs>
        <linearGradient id={`${id}-brass`} x1="0" x2="1">
          <stop offset="0" stopColor="#5e4732" />
          <stop offset=".35" stopColor="#C9A678" />
          <stop offset=".55" stopColor="#f1dcb6" />
          <stop offset="1" stopColor="#6f5440" />
        </linearGradient>
        <radialGradient id={`${id}-bulb`}>
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset=".5" stopColor="#ffe3ad" />
          <stop offset="1" stopColor="#ffe3ad" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={BEAM}>
          <stop offset="0" stopColor="#ffe4b2" stopOpacity=".34" />
          <stop offset=".5" stopColor="#ffd696" stopOpacity=".1" />
          <stop offset="1" stopColor="#ffd696" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon data-beam fill={`url(#${id}-fade)`} style={{ mixBlendMode: "screen", filter: "blur(7px)" }} />
      <path data-cord d={`M0 0 L0 ${cord}`} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.1" strokeLinecap="round" />
      <g data-shade transform={`translate(0 ${cord})`}>
        <g transform="translate(-36 -4)">
          <rect x="33" y="0" width="6" height="7" rx="1.5" fill="#8a6b4e" />
          <path d="M6 32 C6 14 20 6 36 6 C52 6 66 14 66 32 Z" fill={`url(#${id}-brass)`} />
          <ellipse cx="36" cy="32" rx="30" ry="4" fill="#fff1d6" />
          <circle cx="36" cy="33" r="9" fill={`url(#${id}-bulb)`} />
        </g>
        <circle cx="0" cy="30" r="46" fill="rgba(255,226,170,.22)" style={{ mixBlendMode: "screen", filter: "blur(10px)" }} />
      </g>
    </svg>
  )
}
type LampEls = { path: SVGPathElement; shade: SVGGElement; beam: SVGPolygonElement; fade: SVGLinearGradientElement }

export default function Counters() {
  // Values match the live site: 126 projects, 13 years, 72 clients, 15 locations.
  const section = useRef<HTMLElement>(null)
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const lit = useRef<(HTMLDivElement | null)[]>([])
  const els = useRef<(LampEls | null)[]>([])
  const cords = useRef<Cord[]>(CORDS.map((c) => new Cord(c)))
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, "")

  useEffect(() => {
    const root = section.current
    if (!root) return
    // Gravity as the screen sees it. A phone held upright pulls straight down; tilt it and the lamps lean with it.
    const grav = { x: 0, y: G }
    const want = { x: 0, y: G }
    const shove = { x: 0, y: 0 } // the device accelerating under the lamps
    const angle = () => (screen.orientation?.angle ?? 0) * (Math.PI / 180)
    const rotate = (x: number, y: number) => {
      const a = angle()
      return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)] as const
    }
    const tilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      const g = (e.gamma * Math.PI) / 180
      const b = (e.beta * Math.PI) / 180
      // How much of gravity lies in the screen's plane: all of it upright, little when the device lies flat.
      const inPlane = Math.max(0.3, Math.abs(Math.sin(b)))
      const [x, y] = rotate(Math.sin(g) * G, Math.cos(g) * inPlane * G)
      want.x = x
      want.y = y
    }
    const motion = (e: DeviceMotionEvent) => {
      const a = e.acceleration
      if (!a || a.x == null || a.y == null) return
      // A device that speeds up one way leaves the lamps behind, so they swing the other way.
      const [x, y] = rotate(-a.x, a.y)
      shove.x = Math.max(-1800, Math.min(1800, x * 220))
      shove.y = Math.max(-1800, Math.min(1800, y * 220))
    }
    addEventListener("deviceorientation", tilt)
    addEventListener("devicemotion", motion)

    // Pointer (mouse hover or a finger on the glass), in client coordinates.
    const ptr = { x: 0, y: 0, ax: 0, ay: 0, on: false }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.buttons === 0 && e.type !== "pointerdown") return
      if (!ptr.on || e.type === "pointerdown") {
        ptr.ax = ptr.x = e.clientX
        ptr.ay = ptr.y = e.clientY
      }
      ptr.x = e.clientX
      ptr.y = e.clientY
      ptr.on = true
    }
    const leave = () => (ptr.on = false)
    root.addEventListener("pointermove", move, { passive: true })
    root.addEventListener("pointerdown", move, { passive: true })
    root.addEventListener("pointerleave", leave)
    root.addEventListener("pointerup", leave)
    root.addEventListener("pointercancel", leave)

    let raf = 0
    let last = performance.now()
    let visible = false
    const frame = (now: number) => {
      const dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000))
      last = now
      // Gravity eases toward the device's tilt, so a sudden turn is a swing and not a snap.
      const k = 1 - Math.exp(-dt * 6)
      grav.x += (want.x - grav.x) * k
      grav.y += (want.y - grav.y) * k
      shove.x *= Math.exp(-dt * 7)
      shove.y *= Math.exp(-dt * 7)
      cords.current.forEach((c, i) => {
        const cell = cells.current[i]
        const r = cell?.getBoundingClientRect()
        let a: Disc | null = null
        let b: Disc | null = null
        if (ptr.on && r) {
          // Cell-local coordinates, with the ceiling hook at the top centre.
          const ox = r.left + r.width / 2
          a = { x: ptr.ax - ox, y: ptr.ay - r.top, r: PTR }
          b = { x: ptr.x - ox, y: ptr.y - r.top, r: PTR }
        }
        c.step(dt, grav.x + shove.x, grav.y + shove.y, a, b)
        draw(i, c)
      })
      ptr.ax = ptr.x
      ptr.ay = ptr.y
      if (visible) raf = requestAnimationFrame(frame)
    }
    const draw = (i: number, c: Cord) => {
      const e = els.current[i]
      if (!e) return
      let d = `M0 0`
      for (let p = 1; p < c.n; p++) d += ` L${c.x[p].toFixed(1)} ${c.y[p].toFixed(1)}`
      e.path.setAttribute("d", d)
      const t = c.n - 1
      const [dx, dy] = c.dir()
      const rot = (Math.atan2(-dx, dy) * 180) / Math.PI
      e.shade.setAttribute("transform", `translate(${c.x[t].toFixed(1)} ${c.y[t].toFixed(1)}) rotate(${rot.toFixed(2)})`)
      // The beam: a cone opening from the shade along the way it points.
      const half = 0.42
      const cs = Math.cos(half)
      const sn = Math.sin(half)
      const lx = dx * cs - dy * sn
      const ly = dx * sn + dy * cs
      const rx = dx * cs + dy * sn
      const ry = -dx * sn + dy * cs
      const tx = c.x[t] + dx * 26
      const ty = c.y[t] + dy * 26
      e.beam.setAttribute("points", `${tx.toFixed(1)},${ty.toFixed(1)} ${(tx + lx * BEAM).toFixed(1)},${(ty + ly * BEAM).toFixed(1)} ${(tx + rx * BEAM).toFixed(1)},${(ty + ry * BEAM).toFixed(1)}`)
      e.fade.setAttribute("x1", tx.toFixed(1))
      e.fade.setAttribute("y1", ty.toFixed(1))
      e.fade.setAttribute("x2", (tx + dx * BEAM).toFixed(1))
      e.fade.setAttribute("y2", (ty + dy * BEAM).toFixed(1))
      // Where the beam lands on the figures: follow its axis down to the figures' height.
      const el = lit.current[i]
      const cell = cells.current[i]
      if (el && cell) {
        const mid = CORDS[i] + FIG_TOP + 52 // the figures' centre line below the ceiling
        const hit = dy > 0.2 ? tx + (dx / dy) * Math.max(0, mid - ty) : tx + dx * 400
        el.style.setProperty("--lx", `${(cell.clientWidth / 2 + hit).toFixed(1)}px`)
        el.style.setProperty("--lit", String(Math.max(0.25, Math.min(1, 0.55 + dy * 0.45)).toFixed(3)))
      }
    }
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting
      cancelAnimationFrame(raf)
      if (visible) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(root)
    if (reduced) {
      // Still lamps: settle once, no loop.
      cords.current.forEach((c, i) => {
        for (let f = 0; f < 30; f++) c.step(1 / 60, 0, G, null, null)
        draw(i, c)
      })
    }
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      removeEventListener("deviceorientation", tilt)
      removeEventListener("devicemotion", motion)
      root.removeEventListener("pointermove", move)
      root.removeEventListener("pointerdown", move)
      root.removeEventListener("pointerleave", leave)
      root.removeEventListener("pointerup", leave)
      root.removeEventListener("pointercancel", leave)
    }
  }, [reduced])

  // iOS only shares motion after a tap asks for it.
  const askMotion = () => {
    const D = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
    const O = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    D.requestPermission?.().catch(() => {})
    O.requestPermission?.().catch(() => {})
  }

  return (
    <section
      ref={section}
      aria-label="Bonyan in numbers"
      onTouchStart={askMotion}
      onClick={askMotion}
      className="relative overflow-hidden bg-ink pb-24 text-white"
    >
      <div className="mx-auto grid max-w-7xl gap-x-12 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, k) => (
          <div
            key={s.label}
            ref={(el) => {
              cells.current[k] = el
            }}
            className="relative"
          >
            <Lamp id={`${uid}${k}`} cord={CORDS[k]} set={(e) => (els.current[k] = e)} />
            {/* The figures are black on black: only what a lamp lights can be read. */}
            <div
              ref={(el) => {
                lit.current[k] = el
              }}
              className="lit-by-lamp flex flex-col items-center text-center"
              style={{ paddingTop: CORDS[k] + FIG_TOP, paddingBottom: 28, ["--ly" as string]: `${CORDS[k] + FIG_TOP + 70}px` }}
            >
              <Odometer to={s.to} delay={k * 140} />
              <p className="mt-4 text-sm tracking-wide">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
