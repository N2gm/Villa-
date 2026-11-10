"use client"
import { useRef } from "react"
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react"
import { useReducedMotion } from "../../motion"
import { Eyebrow } from "../ui"

// Replace with real partner logos once supplied.
const partners = [
  "Residential",
  "Commercial",
  "Administrative",
  "Luxurious Finishing",
  "3D Visualisation",
  "Turnkey Delivery",
]

const wrap = (min: number, max: number, v: number) => {
  const r = max - min
  return ((((v - min) % r) + r) % r) + min
}

/** A marquee whose speed and direction follow the visitor's scroll; hover pauses it. */
function Row({ base, reverse = false }: { base: number; reverse?: boolean }) {
  const x = useMotionValue(0)
  const { scrollY } = useScroll()
  const vel = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 })
  const factor = useTransform(vel, [-1500, 0, 1500], [-4, 0, 4], {
    clamp: false,
  })
  const skew = useTransform(vel, [-2500, 0, 2500], [8, 0, -8])
  const dir = useRef(reverse ? -1 : 1)
  const paused = useRef(false)
  const pos = useTransform(x, (v) => `${wrap(-50, 0, v)}%`)

  useAnimationFrame((_, dt) => {
    if (paused.current) return
    const f = factor.get()
    if (f < 0) dir.current = reverse ? 1 : -1
    else if (f > 0) dir.current = reverse ? -1 : 1
    x.set(x.get() - dir.current * base * (dt / 1000) * (1 + Math.abs(f)))
  })

  return (
    <motion.div
      style={{ x: pos, skewX: skew }}
      onHoverStart={() => (paused.current = true)}
      onHoverEnd={() => (paused.current = false)}
      className="flex w-max"
    >
      {[...partners, ...partners].map((p, k) => (
        <span
          key={k}
          aria-hidden={k >= partners.length}
          className="mx-10 flex items-center gap-10 whitespace-nowrap font-display text-4xl font-light text-ink/20 transition-colors duration-300 hover:text-brand md:text-6xl"
        >
          {p}
          <span className="h-2 w-2 rounded-full bg-gold" />
        </span>
      ))}
    </motion.div>
  )
}

export default function Partners() {
  const reduced = useReducedMotion()
  return (
    <section
      aria-label="What we deliver"
      className="overflow-hidden border-b border-ink/5 bg-white py-20"
    >
      <div className="mb-10 flex justify-center">
        <Eyebrow>Trusted by homeowners &amp; businesses</Eyebrow>
      </div>
      {reduced ? (
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-4 px-6 font-display text-3xl font-light text-ink/30">
          {partners.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <div className="space-y-6">
          <Row base={3} />
          <Row base={2} reverse />
        </div>
      )}
    </section>
  )
}
