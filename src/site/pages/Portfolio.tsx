"use client"
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from '@/site/router'
import { AnimatePresence, motion } from "motion/react"
import { Arrow, Eyebrow, LoadImg } from "../components/ui"
import { projects, stories } from "../data"
import { gsap } from "../lib/gsap"
import { lockScroll, scrollToTarget } from "../lib/scroll"
import { clamp, useReducedMotion, useScrollFrame } from "../motion"
import { doorSide, type Rig } from "../components/portfolio/villa"

const VillaScene = lazy(() => import("../components/portfolio/VillaScene"))

const N = projects.length
const covers = projects.map((p) => p.img)
const ease = [0.22, 1, 0.36, 1] as const

/** `?door=<index>` from the Featured Work cards; null when absent or out of range. */
function useDoorParam() {
  const [params] = useSearchParams()
  const k = Number(params.get("door") ?? NaN)
  return Number.isInteger(k) && k >= 0 && k < N ? k : null
}

/**
 * On arrival, jump straight to a door. Runs after layout, then re-checks once
 * the route curtain has lifted in case the scroll reset landed after us.
 */
function useArriveAtDoor(door: number | null, topOf: (k: number) => number | null) {
  useEffect(() => {
    if (door == null) return
    const jump = () => {
      const y = topOf(door)
      if (y != null && Math.abs(window.scrollY - y) > 40) scrollToTarget(y, { immediate: true })
    }
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(jump)))
    const late = setTimeout(jump, 900)
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(late)
    }
    // Arrival only: after this the scroll belongs to the visitor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

function supportsWebGL() {
  try {
    const c = document.createElement("canvas")
    return !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

/** Portfolio: walk the Bonyan villa. Every door holds a project; open one to walk its gallery. */
export default function Portfolio() {
  const reduced = useReducedMotion()
  const [gl, setGl] = useState(false)
  const [ready, setReady] = useState(false)

  // Check WebGL support only on the client, after hydration.
  useEffect(() => {
    setGl(supportsWebGL())
    setReady(true)
  }, [])

  // Before the client check runs, render the static version (matches the server).
  if (!ready) return <StaticPortfolio />

  return reduced || !gl ? <StaticPortfolio /> : <VillaWalk />
}

type Phase = "corridor" | "opening" | "room" | "closing"

function VillaWalk() {
  const section = useRef<HTMLElement>(null)
  const intro = useRef<HTMLDivElement>(null)
  const rig = useRef<Rig>({ corridor: 0, open: 0, room: 0 })
  const [near, setNear] = useState(-1)
  const [active, setActive] = useState(-1)
  const [phase, setPhase] = useState<Phase>("corridor")
  const [running, setRunning] = useState(true)
  const openBtn = useRef<HTMLButtonElement>(null)

  useScrollFrame(() => {
    const el = section.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    const p = clamp(-r.top / Math.max(1, r.height - vh))
    if (rig.current.open === 0) rig.current.corridor = p
    const vis = r.bottom > -50 && r.top < vh + 50
    setRunning((v) => (v === vis ? v : vis))
    if (intro.current) {
      const o = clamp(1 - p * N * 1.8)
      intro.current.style.opacity = String(o)
      intro.current.style.transform = `translateY(${(1 - o) * -40}px)`
      intro.current.style.visibility = o < 0.01 ? "hidden" : "visible"
    }
  })

  const open = useCallback((k: number) => {
    if (rig.current.open > 0) return
    setActive(k)
    setPhase("opening")
    lockScroll("villa", true)
    rig.current.room = 0
    gsap.to(rig.current, {
      open: 1,
      duration: 2.8,
      ease: "power2.inOut",
      onComplete: () => setPhase("room"),
    })
  }, [])

  const close = useCallback((then?: () => void) => {
    setPhase("closing")
    gsap
      .timeline({
        onComplete: () => {
          setActive(-1)
          setPhase("corridor")
          lockScroll("villa", false)
          requestAnimationFrame(() => openBtn.current?.focus({ preventScroll: true }))
          then?.()
        },
      })
      .to(rig.current, { room: 0, duration: rig.current.room > 0.05 ? 0.9 : 0, ease: "power2.inOut" })
      .to(rig.current, { open: 0, duration: 2, ease: "power2.inOut" })
  }, [])

  // Site chrome steps aside while the visitor is inside the villa.
  useEffect(() => {
    document.documentElement.classList.toggle("in-villa-room", phase !== "corridor")
  }, [phase])

  useEffect(
    () => () => {
      gsap.killTweensOf(rig.current)
      lockScroll("villa", false)
      document.documentElement.classList.remove("in-villa-room")
    },
    [],
  )

  const doorTop = (k: number) => {
    const el = section.current
    if (!el) return null
    const top = el.getBoundingClientRect().top + window.scrollY
    const len = el.offsetHeight - window.innerHeight
    return top + ((k + 1) / N) * len + 2
  }
  const goToDoor = (k: number) => {
    const y = doorTop(k)
    if (y != null) scrollToTarget(y)
  }
  useArriveAtDoor(useDoorParam(), doorTop)

  const p = near >= 0 ? projects[near] : null
  const cardRight = near >= 0 && doorSide(near) === -1

  return (
    <>
      <section
        ref={section}
        aria-label="Portfolio: a walk through the Bonyan villa"
        className="relative bg-[#0b0a09] text-white"
        style={{ height: `${(N + 1) * 100}svh` }}
      >
        <div className="sticky top-0 h-svh overflow-hidden">
          <Suspense fallback={<div className="skeleton skeleton-dark absolute inset-0" />}>
            <div className="absolute inset-0" aria-hidden>
              <VillaScene
                rig={rig}
                covers={covers}
                active={active}
                gallery={active >= 0 ? stories[projects[active].t].gallery.map((g) => g.src) : []}
                running={running}
                onNear={setNear}
                onOpen={open}
              />
            </div>
          </Suspense>

          {/* Vignette keeps overlay text legible on any frame */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(11,10,9,0.55))]" />

          {/* Intro */}
          <div ref={intro} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0b0a09]/80 via-[#0b0a09]/40 to-transparent" />
            <div className="relative">
              <Eyebrow light>Portfolio · The Bonyan villa</Eyebrow>
              <h1 className="mt-6 font-display text-5xl font-light leading-[1.02] tracking-tight sm:text-6xl md:text-8xl">
                Every door,
                <br />
                <span>a project.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-white/65 md:text-base">
                Walk the corridor. Behind each door is a space we designed and
                built, with its story on the walls.
              </p>
            </div>
          </div>

          {/* The project behind the nearest door */}
          <AnimatePresence mode="wait">
            {p && phase === "corridor" && (
              <motion.div
                key={p.t}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.55, ease }}
                className={`absolute inset-x-4 bottom-[5.5rem] sm:inset-x-6 sm:bottom-8 md:inset-x-auto md:bottom-12 md:w-[25rem] ${cardRight ? "md:right-24 lg:right-32" : "md:left-10 lg:left-16"}`}
              >
                <div className="rounded-[1.5rem] border border-white/10 bg-[#0b0a09]/70 p-5 backdrop-blur-xl sm:p-7">
                  <div className="text-xs">
                    <span className="text-gold">
                      {p.c} · {p.y}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-light tracking-tight sm:text-4xl">{p.t}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/65 sm:line-clamp-none">{stories[p.t].story}</p>
                  <button
                    ref={openBtn}
                    type="button"
                    onClick={() => open(near)}
                    className="group mt-5 flex w-full items-center justify-between rounded-full bg-brand py-3 pl-6 pr-2 text-sm font-medium text-white transition hover:bg-white hover:text-ink sm:mt-6"
                  >
                    Open the door
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-gold transition group-hover:translate-x-0.5">
                      <Arrow className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {active >= 0 && (phase === "room" || phase === "closing") && (
        <RoomTour
          k={active}
          rig={rig}
          leaving={phase === "closing"}
          onClose={() => close()}
          onNext={
            active < N - 1
              ? () => {
                  const next = active + 1
                  close(() => goToDoor(next))
                }
              : undefined
          }
        />
      )}
    </>
  )
}

/** The room overlay: its own native scroll walks the camera panel to panel. */
function RoomTour({
  k,
  rig,
  leaving,
  onClose,
  onNext,
}: {
  k: number
  rig: React.RefObject<Rig>
  leaving: boolean
  onClose: () => void
  onNext?: () => void
}) {
  const proj = projects[k]
  const { story, gallery } = stories[proj.t]
  const n = gallery.length
  const box = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const fill = useRef<HTMLDivElement>(null)

  useEffect(() => {
    box.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const onScroll = () => {
    const el = box.current
    if (!el || leaving) return
    const u = el.scrollTop / el.clientHeight
    rig.current.room = clamp(u, 0, n)
    setIdx(Math.min(n + 1, Math.round(u)))
    if (fill.current) fill.current.style.transform = `scaleX(${clamp(u / (n + 1))})`
  }

  const shot = idx >= 1 && idx <= n ? gallery[idx - 1] : null

  return (
    <motion.div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={`${proj.t} gallery`}
      tabIndex={-1}
      data-lenis-prevent
      onScroll={onScroll}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.4 }}
      className={`fixed inset-0 z-[80] overflow-y-auto overscroll-contain text-white outline-none ${leaving ? "pointer-events-none" : ""}`}
    >
      {/* Scroll length: intro, one screen per photo, and an ending */}
      <div aria-hidden style={{ height: `${(n + 2) * 100}svh` }} />

      {/* Top bar */}
      <div className="fixed inset-x-0 top-0 z-10 bg-gradient-to-b from-[#0b0a09]/85 to-transparent px-4 pb-10 pt-4 sm:px-8 sm:pt-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gold">
              {proj.c}
            </div>
            <div className="truncate font-display text-lg font-light sm:text-xl">{proj.t}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-[#0b0a09]/50 py-2 pl-3 pr-4 text-xs backdrop-blur transition hover:border-gold hover:text-gold sm:text-sm"
          >
            <Arrow className="h-3.5 w-3.5 rotate-180" />
            Back to corridor
          </button>
        </div>
      </div>

      {/* Caption: bottom sheet on phones and tablets, left column on desktop */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#0b0a09] via-[#0b0a09]/80 to-transparent px-4 pb-6 pt-16 sm:px-8 sm:pb-8 lg:inset-y-0 lg:left-0 lg:right-auto lg:flex lg:w-[38%] lg:items-center lg:bg-gradient-to-r lg:from-[#0b0a09]/90 lg:via-[#0b0a09]/60 lg:pt-0 xl:pl-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease }}
            className="pointer-events-auto mx-auto max-w-xl lg:mx-0 lg:max-w-sm"
            aria-live="polite"
          >
            {idx === 0 && (
              <>
                <Eyebrow light>
                  {proj.c} · {proj.y}
                </Eyebrow>
                <h2 className="mt-4 font-display text-4xl font-light leading-tight tracking-tight sm:text-5xl">{proj.t}</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">{story}</p>
              </>
            )}
            {shot && (
              <>
                <h3 className="font-display text-2xl font-light tracking-tight sm:mt-4 sm:text-4xl">{shot.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70 sm:mt-3 sm:text-base">{shot.d}</p>
                <span className="sr-only">{shot.alt}</span>
              </>
            )}
            {idx === n + 1 && (
              <>
                <Eyebrow light>{proj.t}</Eyebrow>
                <h3 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight sm:text-4xl">
                  Imagine this <span>in your space.</span>
                </h3>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <Link
                    to="/get-a-quote"
                    className="flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-ink"
                  >
                    Start a similar project <Arrow className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={onNext ?? onClose}
                    className="rounded-full border border-white/25 px-6 py-3 text-sm transition hover:border-gold hover:text-gold"
                  >
                    {onNext ? `Next door: ${projects[k + 1].t}` : "Back to corridor"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/** Reduced motion or no WebGL: the same stories as a calm, readable list. */
function StaticPortfolio() {
  useArriveAtDoor(useDoorParam(), (k) => {
    const el = document.getElementById(`door-${k}`)
    return el ? el.getBoundingClientRect().top + window.scrollY - 112 : null
  })
  return (
    <section aria-labelledby="pf-title" className="bg-[#0b0a09] pb-28 pt-40 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <Eyebrow light>Portfolio</Eyebrow>
        <h1 id="pf-title" className="mt-6 font-display text-5xl font-light tracking-tight md:text-7xl">
          Every door, <span>a project.</span>
        </h1>
        <div className="mt-20 space-y-24">
          {projects.map((p, k) => {
            const s = stories[p.t]
            return (
              <article key={p.t} id={`door-${k}`} aria-labelledby={`pf-${k}`} className="scroll-mt-28">
                <div className="grid gap-6 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <div className="text-sm font-medium text-gold">
                      {p.c} · {p.y}
                    </div>
                    <h2 id={`pf-${k}`} className="mt-3 font-display text-3xl font-light">{p.t}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/65">{s.story}</p>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-2 md:col-span-8">
                    {s.gallery.map((g) => (
                      <li key={g.src}>
                        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                          <LoadImg dark src={g.src} alt={g.alt} loading="lazy" className="h-full w-full object-cover" />
                        </div>
                        <div className="mt-3 text-sm">{g.t}</div>
                        <div className="text-xs leading-relaxed text-white/50">{g.d}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
