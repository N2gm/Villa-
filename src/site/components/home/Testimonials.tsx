"use client"
import { useRef, useState } from "react"
import { clamp, pinProgress, useReducedMotion, useScrollFrame } from "../../motion"
import { Eyebrow, SplitText } from "../ui"

const quotes = [
  {
    q: "Bonyan turned an empty shell into the home we had imagined for years. The daily site updates meant we never had to worry.",
    n: "Ahmed & Nour",
    r: "Family apartment, New Cairo",
  },
  {
    q: "Precise, transparent and calm under pressure. Our headquarters was delivered on time and beyond our expectations.",
    n: "Operations Director",
    r: "Administrative project, Nasr City",
  },
  {
    q: "The 3D renders were so accurate that walking into the finished villa felt like déjà vu. Exceptional craftsmanship.",
    n: "Villa owner",
    r: "Residential project, Sheikh Zayed",
  },
]

/** One drawing sheet: corner registration marks, a sheet number and the quote. */
function Sheet({ k, q }: { k: number; q: (typeof quotes)[number] }) {
  return (
    <figure className="relative h-full overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_40px_90px_-40px_rgba(8,10,11,.45)] ring-1 ring-ink/10 md:p-14">
      {[
        "left-5 top-5 border-l border-t",
        "right-5 top-5 border-r border-t",
        "bottom-5 left-5 border-b border-l",
        "bottom-5 right-5 border-b border-r",
      ].map((c) => (
        <span key={c} aria-hidden="true" className={`absolute h-4 w-4 border-brand/50 ${c}`} />
      ))}
      <div className="flex items-baseline justify-between text-xs text-mute">
        <span className="font-display text-brand">Sheet A-0{k + 1}</span>
        <span>
          {k + 1} / {quotes.length}
        </span>
      </div>
      <blockquote className="mt-8 font-display text-2xl font-light leading-snug tracking-tight sm:text-3xl md:mt-12 md:text-4xl">
        &ldquo;{q.q}&rdquo;
      </blockquote>
      <figcaption className="mt-8 text-sm md:mt-12">
        <span className="font-medium">{q.n}</span> <span className="text-mute">&middot; {q.r}</span>
      </figcaption>
    </figure>
  )
}

/**
 * "What people say": the quotes are drawing sheets stacked on a desk. Scrolling lifts the top sheet
 * away, tipping it off the pile, and the next one settles into its place.
 */
export default function Testimonials() {
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const sheets = useRef<(HTMLDivElement | null)[]>([])
  const bar = useRef<HTMLSpanElement>(null)
  const [now, setNow] = useState(0)
  const N = quotes.length

  useScrollFrame(() => {
    if (reduced) return
    const p = pinProgress(section.current)
    // Hold on the first and last sheet a moment, travel in between.
    const t = clamp((p - 0.08) / 0.84) * (N - 1)
    sheets.current.forEach((el, k) => {
      if (!el) return
      const d = k - t
      if (d <= 0) {
        // Lifted off the pile.
        const e = clamp(-d)
        const ease = e * e * (3 - 2 * e)
        el.style.transform = `translate3d(${ease * -18}%, ${ease * -62}%, ${ease * 160}px) rotateX(${ease * 24}deg) rotateZ(${ease * -9}deg)`
        el.style.opacity = String(1 - ease * 1.15)
      } else {
        // Waiting below, a little smaller and lower with every sheet.
        el.style.transform = `translate3d(0, ${d * 22}px, ${-d * 70}px) scale(${1 - d * 0.045})`
        el.style.opacity = String(Math.max(0.35, 1 - d * 0.28))
      }
      el.style.zIndex = String(N - k)
    })
    if (bar.current) bar.current.style.transform = `scaleX(${clamp(t / (N - 1))})`
    setNow(Math.round(t))
  })

  return (
    <section
      ref={section}
      aria-labelledby="say-title"
      className={`relative bg-sand ${reduced ? "py-32" : "h-[300svh]"}`}
    >
      <div className="blueprint-grid pointer-events-none absolute inset-0" />
      <div className={reduced ? "relative" : "sticky top-0 flex h-svh min-h-[34rem] items-center overflow-hidden"}>
        <div className="relative mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
            <div className="lg:col-span-5">
              <Eyebrow>Testimonials</Eyebrow>
              <h2 id="say-title" className="mt-6 text-5xl font-extralight leading-[1.02] tracking-tight md:text-7xl">
                <SplitText text="What people" /> <SplitText text="say" delay={200} />
              </h2>
              <div className="mt-8 hidden items-center gap-4 lg:flex" aria-hidden="true">
                <span className="font-display text-sm text-brand">0{now + 1}</span>
                <span className="relative h-px w-40 bg-ink/15">
                  <span ref={bar} className="absolute inset-0 origin-left bg-brand" style={{ transform: "scaleX(0)" }} />
                </span>
                <span className="font-display text-sm text-mute">0{N}</span>
              </div>
            </div>

            {reduced ? (
              <div className="grid gap-6 lg:col-span-7">
                {quotes.map((q, k) => (
                  <Sheet key={q.n} k={k} q={q} />
                ))}
              </div>
            ) : (
              <div className="relative lg:col-span-7" style={{ perspective: "1400px" }}>
                {/* Every sheet stacks in the same cell, so the pile keeps the height of the tallest. */}
                <div className="grid [transform-style:preserve-3d]">
                  {quotes.map((q, k) => (
                    <div
                      key={q.n}
                      ref={(el) => {
                        sheets.current[k] = el
                      }}
                      aria-hidden={k !== now}
                      className="[grid-area:1/1] will-change-transform"
                      style={{ transformOrigin: "50% 100%" }}
                    >
                      <Sheet k={k} q={q} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
