"use client"
import { useRef } from "react"
import PageHero from "../components/PageHero"
import { Button, Eyebrow, Reveal } from "../components/ui"
import { contact, img } from "../data"
import {
  FINE_POINTER,
  clamp,
  useFrame,
  useMedia,
  useReducedMotion,
  wake,
} from "../motion"

const roles = [
  {
    t: "Architects",
    d: "Concept, massing and permit drawings for villas and commercial buildings.",
  },
  {
    t: "Interior designers",
    d: "Residential and office interiors, from mood board to joinery details.",
  },
  {
    t: "3D visualisers",
    d: "Photoreal renders and walkthroughs clients can step into.",
  },
  {
    t: "Site engineers",
    d: "Daily supervision, quality control and clear reporting from site.",
  },
  {
    t: "Finishing supervisors",
    d: "Craft-level oversight of stone, joinery, paint and fit-out.",
  },
]

/** A dark stage where the cursor is a torch; a spring-lagged mask reveals the headline beneath. */
function Spotlight() {
  const fine = useMedia(FINE_POINTER)
  const reduced = useReducedMotion()
  const stage = useRef<HTMLDivElement>(null)
  const lit = useRef<HTMLDivElement>(null)
  const want = useRef({ x: 0.5, y: 0.5, r: 0, on: false })
  const cur = useRef({ x: 0.5, y: 0.5, r: 0 })
  const static_ = reduced

  useFrame((dt) => {
    const el = lit.current
    if (!el || static_) return
    const w = want.current,
      c = cur.current
    // Magnetic: the torch widens as it nears the headline's centre line.
    const near = 1 - clamp(Math.abs(w.y - 0.5) * 2.4)
    const targetR = w.on ? 150 + near * 140 : 0
    const k = 1 - Math.exp(-dt * 7)
    c.x += (w.x - c.x) * k
    c.y += (w.y - c.y) * k
    c.r += (targetR - c.r) * (1 - Math.exp(-dt * 5))
    el.style.setProperty("--x", `${c.x * 100}%`)
    el.style.setProperty("--y", `${c.y * 100}%`)
    el.style.setProperty("--r", `${c.r}px`)
    return (
      Math.abs(w.x - c.x) + Math.abs(w.y - c.y) > 0.0005 ||
      Math.abs(targetR - c.r) > 0.5
    )
  }, !static_)

  const move = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect()
    want.current = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      r: 0,
      on: true,
    }
    wake()
  }
  const headline = "Join the studio."
  const text =
    "font-display text-[17vw] font-extralight leading-[0.9] tracking-tight md:text-[12vw]"

  return (
    <section
      aria-label="Join the studio"
      className="relative overflow-hidden bg-ink text-white"
    >
      <div
        ref={stage}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => {
          want.current.on = false
          wake()
        }}
        className={`relative grid min-h-[80svh] place-items-center px-6 py-24 ${
          static_ || !fine ? "" : "cursor-none"
        }`}
      >
        <h2
          className={`${text} text-center text-transparent [-webkit-text-stroke:1px_rgba(244,239,232,.14)]`}
        >
          {headline}
        </h2>
        <div
          ref={lit}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center px-6"
          style={
            static_
              ? undefined
              : {
                  maskImage:
                    "radial-gradient(circle var(--r,0px) at var(--x,50%) var(--y,50%), #000 35%, transparent 100%)",
                  WebkitMaskImage:
                    "radial-gradient(circle var(--r,0px) at var(--x,50%) var(--y,50%), #000 35%, transparent 100%)",
                }
          }
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--x,50%)_var(--y,50%),rgba(201,166,120,.22),transparent_60%)]" />
          <p className={`${text} relative text-center text-gold`}>
            {headline}
          </p>
        </div>
        <p className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center text-xs text-white/50">
          Architecture · Interiors · Finishing
        </p>
      </div>
    </section>
  )
}

export default function Careers() {
  return (
    <>
      <PageHero
        crumb="Careers"
        title="Careers"
        sub="Join a studio built on disciplined thinking and refined design."
        img={img("photo-1603901622056-0a5bee231395", 2000)}
      />
      <Spotlight />
      <section aria-labelledby="roles-title" className="bg-white py-32">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Eyebrow>We are always looking for</Eyebrow>
            <h2
              id="roles-title"
              className="mt-6 text-5xl font-light leading-[1.05] tracking-tight"
            >
              People who care about{" "}
              <span>the last millimetre.</span>
            </h2>
            <Reveal delay={150}>
              <p className="mt-8 max-w-md leading-relaxed text-mute">
                We don't list fixed vacancies. If your discipline is below, send
                your CV and portfolio and we will keep you in mind for the next
                project that fits.
              </p>
            </Reveal>
            <Reveal delay={250} className="mt-10">
              <Button href="/contact">Get in touch</Button>
            </Reveal>
          </div>
          <ul className="lg:col-span-7">
            {roles.map((r, k) => (
              <Reveal
                key={r.t}
                as="li"
                delay={k * 80}
                className="group border-b border-ink/10"
              >
                <a
                  href={`mailto:${contact.email}?subject=${encodeURIComponent(`Application: ${r.t}`)}`}
                  className="flex items-center gap-6 py-7"
                >
                  <span className="font-display text-sm text-brand">
                    {k + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block text-3xl font-light tracking-tight transition-transform duration-500 group-hover:translate-x-2">
                      {r.t}
                    </span>
                    <span className="mt-2 block text-sm text-mute">{r.d}</span>
                  </span>
                  <span className="text-xs text-brand opacity-0 transition-opacity group-hover:opacity-100">
                    Apply by email
                  </span>
                </a>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
