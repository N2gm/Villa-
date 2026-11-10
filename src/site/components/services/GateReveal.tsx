"use client"
import { useRef, useState } from "react"
import { Link } from "@/site/router"
import { clamp, pinProgress, smoothstep, useReducedMotion, useScrollFrame } from "../../motion"
import { Arrow, Eyebrow } from "../ui"

const steps = [
  { t: "Brief", d: "We listen, measure the site and agree the scope and the budget before anything is drawn." },
  { t: "Concept", d: "Precise 2D plans and photoreal 3D, so you walk through the space before a single wall is built." },
  { t: "Build", d: "Execution with daily site updates, live monitoring and complete financial transparency." },
  { t: "Handover", d: "Finishes, furniture and styling close the story, and support carries on long after the keys." },
]

const OPEN = [0.1, 0.46] as const // doors swing
const ease = (t: number) => t * t * (3 - 2 * t)

/** A pair of slatted timber leaves with brass studs, a band and a ring pull. */
function Leaf({ side }: { side: "l" | "r" }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: "#3b2a1e",
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px 22px), linear-gradient(180deg, rgba(8,10,11,.35), transparent 30%, transparent 70%, rgba(8,10,11,.5))",
        boxShadow: side === "l" ? "inset -18px 0 40px -18px rgba(0,0,0,.7)" : "inset 18px 0 40px -18px rgba(0,0,0,.7)",
      }}
    >
      {/* Brass bands */}
      {["22%", "78%"].map((top) => (
        <span key={top} aria-hidden="true" className="absolute inset-x-0 h-[3.2%] bg-gradient-to-b from-[#e8cc98] via-[#C9A678] to-[#7a5d43] opacity-90" style={{ top }} />
      ))}
      {/* Studs along the seam */}
      <div className={`absolute inset-y-[8%] flex flex-col justify-between ${side === "l" ? "right-[7%]" : "left-[7%]"}`}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} aria-hidden="true" className="h-2 w-2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#f1dcb6,#8a6b4e)] md:h-2.5 md:w-2.5" />
        ))}
      </div>
      {/* Ring pull */}
      <span
        aria-hidden="true"
        className={`absolute top-1/2 h-[min(14vw,4.5rem)] w-[min(14vw,4.5rem)] -translate-y-1/2 rounded-full border-[3px] border-[#C9A678] shadow-[0_6px_14px_rgba(0,0,0,.5)] ${side === "l" ? "right-[14%]" : "left-[14%]"}`}
      />
    </div>
  )
}

/**
 * "Step through": a villa gate stands closed across the screen. Scrolling swings both leaves open into
 * the dark, a warm corridor of arches is revealed, and the walk through it is how a project unfolds.
 */
export default function GateReveal() {
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const left = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const [step, setStep] = useState(reduced ? 0 : -1)

  useScrollFrame(() => {
    if (reduced) return
    const p = pinProgress(section.current)
    const o = ease(clamp((p - OPEN[0]) / (OPEN[1] - OPEN[0])))
    // A heavy leaf: it starts slowly, then swings wide.
    const a = o * 96
    // Once a leaf stands edge-on it has nothing left to show, so it is let go.
    const vis = String(1 - smoothstep(0.82, 1, o))
    if (left.current) { left.current.style.transform = `rotateY(${a}deg)`; left.current.style.opacity = vis }
    if (right.current) { right.current.style.transform = `rotateY(${-a}deg)`; right.current.style.opacity = vis }
    // Past the threshold the camera walks forward through the arches.
    const walk = clamp((p - OPEN[0]) / 0.9)
    if (scene.current) scene.current.style.transform = `scale(${1.5 - o * 0.5 + walk * 0.55})`
    if (glow.current) glow.current.style.opacity = String(0.15 + o * 0.85)
    if (hint.current) hint.current.style.opacity = String(1 - smoothstep(0.02, 0.12, p))
    const w = clamp((p - 0.5) / 0.46)
    if (bar.current) bar.current.style.transform = `scaleX(${w})`
    const s = p < 0.5 ? -1 : Math.min(steps.length - 1, Math.floor(w * steps.length))
    setStep(s)
  })

  const cur = steps[Math.max(0, step)]
  return (
    <section ref={section} aria-labelledby="gate-title" className={`relative bg-ink text-white ${reduced ? "" : "h-[420svh]"}`}>
      <div className={reduced ? "relative overflow-hidden py-28" : "sticky top-0 h-svh min-h-[34rem] overflow-hidden"}>
        {/* Beyond the gate: a corridor of arches lit from deep inside. */}
        <div ref={scene} className="absolute inset-0 origin-[50%_62%] will-change-transform" style={{ transform: reduced ? "none" : "scale(1.5)" }}>
          <div ref={glow} className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_58%,rgba(255,214,150,.38),rgba(201,166,120,.12)_45%,transparent_75%)]" style={{ opacity: reduced ? 1 : 0.15 }} />
          <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#C9A678" stopOpacity=".5" />
                <stop offset="1" stopColor="#C9A678" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: 7 }, (_, i) => {
              const k = 1 - i * 0.14 // each arch is smaller than the one before, further away
              const w = 150 * k
              const top = 175 - 120 * k
              const base = 205 - 30 * (1 - k)
              return (
                <path
                  key={i}
                  d={`M${200 - w} ${base} V${top + w} A${w} ${w} 0 0 1 ${200 + w} ${top + w} V${base}`}
                  fill={i === 6 ? "rgba(255,226,170,.55)" : "none"}
                  stroke="#C9A678"
                  strokeOpacity={0.9 - i * 0.1}
                  strokeWidth={1.1 - i * 0.1}
                />
              )
            })}
            <path d="M0 300 L200 205 L400 300 Z" fill="url(#floor)" />
            {Array.from({ length: 7 }, (_, i) => (
              <line key={i} x1={200 + (i - 3) * 8} y1="205" x2={200 + (i - 3) * 110} y2="300" stroke="#C9A678" strokeOpacity=".22" strokeWidth=".6" />
            ))}
          </svg>
        </div>

        {/* The way through: the four chapters of a project. */}
        <div className="pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(90deg,rgba(8,10,11,.88),rgba(8,10,11,.55)_35%,transparent_62%)] max-md:bg-[linear-gradient(0deg,rgba(8,10,11,.9),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-6 pb-10 pt-32 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:pb-0 md:pt-0">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-md" style={{ opacity: reduced || step >= 0 ? 1 : 0, transition: "opacity .7s" }}>
              <Eyebrow light>A project, step by step</Eyebrow>
              <h2 id="gate-title" className="mt-4 text-4xl font-extralight leading-[1.02] tracking-tight md:text-6xl">
                Step through.
              </h2>
              {reduced ? (
                <ol className="mt-8 space-y-6">
                  {steps.map((x, i) => (
                    <li key={x.t} className="border-t border-white/10 pt-4">
                      <span className="font-display text-xs text-gold">0{i + 1}</span>
                      <p className="mt-1 text-2xl font-light">{x.t}</p>
                      <p className="mt-2 text-sm leading-relaxed text-white/60">{x.d}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-6 min-h-[9.5rem]" aria-live="polite">
                  <p key={step} className="panel-in">
                    <span className="font-display text-xs text-gold">0{Math.max(0, step) + 1} / 0{steps.length}</span>
                    <span className="mt-2 block text-3xl font-light md:text-4xl">{cur.t}</span>
                    <span className="mt-3 block text-sm leading-relaxed text-white/65 md:text-base">{cur.d}</span>
                  </p>
                  <span className="relative mt-6 block h-px w-48 bg-white/15">
                    <span ref={bar} className="absolute inset-0 origin-left bg-gold" style={{ transform: "scaleX(0)" }} />
                  </span>
                </div>
              )}
              <Link to="/get-a-quote" className="group pointer-events-auto mt-6 inline-flex items-center gap-3 text-sm font-medium text-gold">
                <span className="border-b border-gold/40 pb-1 transition-colors group-hover:border-gold">Start with a brief</span>
                <Arrow className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* The gate itself. */}
        {!reduced && (
          <div className="pointer-events-none absolute inset-0 z-20" style={{ perspective: "1700px" }} aria-hidden="true">
            <div ref={left} className="absolute inset-y-0 left-0 w-1/2 [backface-visibility:hidden]" style={{ transformOrigin: "0% 50%" }}>
              <Leaf side="l" />
            </div>
            <div ref={right} className="absolute inset-y-0 right-0 w-1/2 [backface-visibility:hidden]" style={{ transformOrigin: "100% 50%" }}>
              <Leaf side="r" />
            </div>
            <div ref={hint} className="absolute inset-x-0 bottom-10 grid place-items-center text-center">
              <p className="rounded-full border border-gold/50 bg-ink/70 px-5 py-2 text-xs text-gold">Scroll to open the gate</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
