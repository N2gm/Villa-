"use client"
import { useRef } from "react"
import { img } from "../../data"
import { clamp, useReducedMotion, useScrollFrame } from "../../motion"
import { LoadImg, Reveal, SplitText } from "../ui"

const items = [
  {
    t: "Our Mission",
    d: "To deliver intelligent, beautifully crafted spaces that serve the people who inhabit them, on time, within budget, and beyond expectation.",
    img: img("photo-1757924461488-ef9ad0670978", 2000),
  },
  {
    t: "Our Vision",
    d: "To be the premier destination for design excellence in Egypt and the wider region, recognized not just for what we build, but for the experience we create along the way.",
    img: img("photo-1613490493576-7fde63acd811", 2000),
  },
  {
    t: "Our Approach",
    d: "One team from first sketch to handover: architecture, interiors and 3D visualisation working from the same drawings, with daily site supervision and transparent costs.",
    img: img("photo-1503387837-b154d5074bd2", 2000),
  },
]

/**
 * About: Mission, Vision and Approach as cards in a deck. Each new panel slides
 * over the last, which tips back, shrinks and dims into the depth of the stack.
 */
export default function DepthStack() {
  const reduced = useReducedMotion()
  const panels = useRef<(HTMLDivElement | null)[]>([])
  const cards = useRef<(HTMLDivElement | null)[]>([])

  useScrollFrame(() => {
    cards.current.forEach((c, k) => {
      if (!c) return
      const next = panels.current[k + 1]
      const p =
        reduced || !next
          ? 0
          : clamp(1 - next.getBoundingClientRect().top / innerHeight)
      c.style.transform = p
        ? `translate3d(0,${-p * 3}%,0) scale(${1 - p * 0.1}) rotateX(${p * 7}deg)`
        : ""
      c.style.filter = p ? `brightness(${1 - p * 0.65}) blur(${p * 2}px)` : ""
      c.style.borderRadius = `${p * 2.5}rem`
    })
  })

  return (
    <section
      aria-label="Mission, vision and approach"
      className="relative bg-ink"
      style={{ perspective: "1600px" }}
    >
      {items.map((it, k) => (
        <div
          key={it.t}
          ref={(el) => {
            panels.current[k] = el
          }}
          className="sticky top-0 h-screen"
        >
          <div
            ref={(el) => {
              cards.current[k] = el
            }}
            className="relative h-full origin-top overflow-hidden bg-ink will-change-transform"
          >
            <LoadImg
              dark
              src={it.img}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
            <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-6 text-white">
              <h3 className="text-6xl font-extralight tracking-tight md:text-8xl">
                <SplitText text={it.t} />
              </h3>
              <Reveal delay={200}>
                <p className="mt-8 max-w-2xl font-display text-2xl font-light leading-snug text-white/80 md:text-3xl">
                  {it.d}
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
