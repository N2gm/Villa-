"use client"
import { useRef } from "react"
import { Link } from '@/site/router'
import { projects } from "../../data"
import { scrollVelocity } from "../../lib/scroll"
import {
  clamp,
  pinProgress,
  scroll,
  useFrame,
  useReducedMotion,
  useScrollFrame,
} from "../../motion"
import { Arrow, Eyebrow, LoadImg, SplitText } from "../ui"

/**
 * Home: a pinned horizontal reel. Scroll speed bends the cards like film
 * through a gate, and each photograph drifts inside its frame for depth.
 */
export default function Projects() {
  const reduced = useReducedMotion()
  const outer = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLAnchorElement | null)[]>([])
  const pics = useRef<(HTMLImageElement | null)[]>([])
  const skew = useRef(0)

  useScrollFrame(() => {
    const t = track.current
    if (!t) return
    const p = pinProgress(outer.current)
    t.style.transform = `translate3d(${-p * Math.max(0, t.scrollWidth - innerWidth)}px,0,0)`
    if (reduced) return
    pics.current.forEach((img) => {
      const card = img?.parentElement
      if (!img || !card) return
      const r = card.getBoundingClientRect()
      const off = clamp(
        (r.left + r.width / 2 - innerWidth / 2) / innerWidth,
        -1,
        1,
      )
      img.style.transform = `translate3d(${off * -9}%,0,0) scale(1.22)`
    })
  })

  // Ease toward the current velocity so the bend settles smoothly once scrolling stops.
  useFrame((dt) => {
    const v = scrollVelocity() || scroll.velocity / 60
    const target = reduced ? 0 : clamp(v * 0.35, -7, 7)
    skew.current += (target - skew.current) * (1 - Math.exp(-dt * 9))
    if (Math.abs(skew.current) < 0.01 && !target) skew.current = 0
    const s = skew.current
    cards.current.forEach((c) => {
      if (c)
        c.style.transform = s
          ? `skewX(${-s}deg) scale(${1 - Math.abs(s) * 0.006})`
          : ""
    })
    return s !== 0 || target !== 0
  })

  return (
    <section
      id="portfolio"
      ref={outer}
      aria-labelledby="projects-title"
      className="relative bg-white"
      style={{ height: `${projects.length * 70}vh` }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-12 flex w-full max-w-7xl items-end justify-between px-6">
          <div>
            <Eyebrow>Recent Projects</Eyebrow>
            <h2
              id="projects-title"
              className="mt-5 text-5xl font-light tracking-tight md:text-7xl"
            >
              <SplitText text="Featured Work" />
            </h2>
          </div>
        </div>
        <div
          ref={track}
          className="flex gap-8 px-6 will-change-transform md:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]"
        >
          {projects.map((p, k) => (
            <Link
              key={p.t}
              ref={(el) => {
                cards.current[k] = el
              }}
              to={`/portfolio?door=${k}`}
              aria-label={`${p.t}, ${p.c}, ${p.y}`}
              className="group relative h-[60vh] w-[78vw] shrink-0 overflow-hidden rounded-[2rem] will-change-transform md:w-[38vw]"
            >
              <LoadImg
                ref={(el) => {
                  pics.current[k] = el
                }}
                src={p.img}
                alt={p.alt}
                loading="lazy"
                className="h-full w-full scale-[1.22] object-cover grayscale-[30%] transition-[filter,opacity] duration-[1.2s] group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
              <div className="absolute left-6 top-6 rounded-full bg-white/15 px-4 py-1.5 text-xs text-white backdrop-blur">
                {p.c}
              </div>
              <div className="absolute inset-x-6 bottom-6 flex items-end justify-between text-white">
                <div>
                  <div className="text-xs text-white/60">{p.y}</div>
                  <h3 className="mt-2 text-3xl font-light">{p.t}</h3>
                </div>
                <span className="grid h-14 w-14 translate-y-4 place-items-center rounded-full bg-gold text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <Arrow className="h-5 w-5 -rotate-45" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
