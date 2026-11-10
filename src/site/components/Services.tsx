"use client"
import { useEffect, useRef, useState } from 'react'
import { Link } from '@/site/router'
import { clamp, useScrollFrame } from '../hooks'
import { prefersReducedMotion } from '../motion'
import { services as steps } from '../data'
import { Eyebrow, SplitText, Arrow, LoadImg } from './ui'

export default function Services() {
  const section = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const anchors = useRef<(HTMLSpanElement | null)[]>([])
  const pathRef = useRef<SVGPathElement>(null)
  const head = useRef<SVGCircleElement>(null)
  const [d, setD] = useState('')
  const [size, setSize] = useState({ w: 1, h: 1 })
  const [active, setActive] = useState(-1)
  const lenRef = useRef(1)
  const [len, setLen] = useState(1)

  // Build an S-curve through each card's inner edge, from the top of the section to the bottom.
  useEffect(() => {
    const build = () => {
      const s = section.current
      if (!s) return
      const sr = s.getBoundingClientRect()
      const w = sr.width, h = sr.height
      const pts = anchors.current.map((a) => {
        const r = a!.getBoundingClientRect()
        return { x: r.left - sr.left, y: r.top - sr.top }
      })
      const all = [{ x: w / 2, y: 0 }, ...pts, { x: w / 2, y: h }]
      let p = `M ${all[0].x} ${all[0].y}`
      for (let i = 1; i < all.length; i++) {
        const a = all[i - 1], b = all[i], dy = (b.y - a.y) * 0.55
        p += ` C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`
      }
      setSize({ w, h }); setD(p)
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(section.current!)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { if (pathRef.current) { lenRef.current = pathRef.current.getTotalLength(); setLen(lenRef.current) } }, [d])

  useScrollFrame(() => {
    const s = section.current, path = pathRef.current
    if (!s || !path) return
    const vh = innerHeight
    const r = s.getBoundingClientRect()
    const progress = clamp((vh * 0.6 - r.top) / r.height)
    const len = lenRef.current
    if (!len || len <= 0) return
    s.style.setProperty('--draw', String(len * (1 - progress)))
    const pt = path.getPointAtLength(len * progress)
    head.current?.setAttribute('cx', String(pt.x)); head.current?.setAttribute('cy', String(pt.y))

    let act = -1
    const still = prefersReducedMotion()
    cards.current.forEach((c, i) => {
      if (!c) return
      const cr = c.getBoundingClientRect()
      const dist = (cr.top + cr.height / 2 - vh / 2) / (vh / 2) // -1 above center, +1 below
      const o = clamp(1.25 - Math.abs(dist) * 1.1)
      // Reduced motion: cards stay put; only the line keeps drawing.
      c.style.opacity = still ? '' : String(o)
      c.style.transform = still ? '' : `translateY(${dist * 70}px) scale(${0.9 + o * 0.1}) rotateX(${dist * -8}deg)`
      c.style.filter = still ? '' : `blur(${(1 - o) * 6}px)`
      if (pt.y >= anchors.current[i]!.getBoundingClientRect().top - r.top - 4) act = i
    })
    setActive(act)
  })

  return (
    <section id="services" className="relative overflow-hidden bg-sand py-32">

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <div className="flex justify-center"><Eyebrow>Services We Do</Eyebrow></div>
        <h2 className="mx-auto mt-6 max-w-3xl text-5xl font-light leading-[1.05] tracking-tight md:text-7xl">
          <SplitText text="We Are Experts In" /> <SplitText text="Every Layer." delay={250} />
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-mute">Four disciplines, one continuous journey.</p>
      </div>

      <div ref={section} className="relative mx-auto mt-24 max-w-6xl px-6" style={{ perspective: '1200px' }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${size.w} ${size.h}`}>
          <defs>
            <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F3D9A4" />
              <stop offset=".45" stopColor="#C9A678" />
              <stop offset="1" stopColor="#906E50" />
            </linearGradient>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
            <radialGradient id="glow"><stop offset="0" stopColor="#FFE7B5" /><stop offset=".4" stopColor="#C9A678" stopOpacity=".6" /><stop offset="1" stopColor="#C9A678" stopOpacity="0" /></radialGradient>
          </defs>
          {/* track */}
          <path d={d} fill="none" stroke="#906E50" strokeOpacity=".18" strokeWidth="1.5" strokeDasharray="4 10" />
          {/* 3D ribbon: shadow, body, highlight */}
          <g style={{ strokeDasharray: len, strokeDashoffset: 'var(--draw)' } as React.CSSProperties}>
            <path d={d} fill="none" stroke="#5a4330" strokeOpacity=".35" strokeWidth="12" strokeLinecap="round" transform="translate(6 12)" filter="url(#soft)" style={{ strokeDasharray: 'inherit', strokeDashoffset: 'inherit' }} />
            <path d={d} fill="none" stroke="#7a5b41" strokeWidth="10" strokeLinecap="round" transform="translate(2 4)" style={{ strokeDasharray: 'inherit', strokeDashoffset: 'inherit' }} />
            <path ref={pathRef} d={d} fill="none" stroke="url(#gold)" strokeWidth="9" strokeLinecap="round" style={{ strokeDasharray: 'inherit', strokeDashoffset: 'inherit' }} />
            <path d={d} fill="none" stroke="#FFF4DC" strokeOpacity=".85" strokeWidth="2" strokeLinecap="round" transform="translate(-2 -2)" style={{ strokeDasharray: 'inherit', strokeDashoffset: 'inherit' }} />
          </g>
          <circle ref={head} r="34" fill="url(#glow)" />
        </svg>

        {steps.map((s, i) => {
          const right = i % 2 === 1
          const on = active >= i
          return (
            <div key={s.n} className={`relative flex min-h-[85vh] items-center ${right ? 'justify-end' : 'justify-start'}`}>
              <div className="relative w-full max-w-md">
                <span ref={(el) => { anchors.current[i] = el }} className={`absolute top-1/2 ${right ? 'left-0' : 'right-0'}`} />
                {/* node where the line meets the card */}
                <span className={`absolute top-1/2 z-10 -translate-y-1/2 ${right ? '-left-3' : '-right-3'} grid h-6 w-6 place-items-center rounded-full transition-all duration-500 ${on ? 'scale-100 bg-brand shadow-[0_0_0_8px_rgba(201,166,120,.25)]' : 'scale-75 bg-white ring-1 ring-brand/30'}`}>
                  <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-brand/40'}`} />
                </span>
                <div ref={(el) => { cards.current[i] = el }} className="will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
                <article className="group overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_-30px_rgba(8,10,11,.35)] transition-shadow duration-500 hover:shadow-[0_40px_100px_-30px_rgba(144,110,80,.55)]">
                  <div className="relative h-56 overflow-hidden">
                    <LoadImg src={s.img} alt={s.title} className="h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                    <span className="absolute left-6 top-5 font-display text-xs text-white/80">Step {s.n}</span>
                    <span className="absolute bottom-2 right-5 font-display text-8xl font-extralight leading-none text-white/90 transition-transform duration-700 group-hover:-translate-y-2">{s.n}</span>
                  </div>
                  <div className="p-8">
                    <h3 className="text-3xl font-normal tracking-tight">{s.title}</h3>
                    <p className="mt-3 leading-relaxed text-mute">{s.text}</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {s.tags.map((t) => <span key={t} className="rounded-full border border-brand/25 px-3 py-1 text-xs text-brand transition-colors hover:bg-brand hover:text-white">{t}</span>)}
                    </div>
                    <Link to="/get-a-quote" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-brand after:transition-transform after:duration-500 group-hover:after:origin-left group-hover:after:scale-x-100">Start this step</span>
                      <Arrow className="h-4 w-4 text-brand transition-transform duration-500 group-hover:translate-x-1.5" />
                    </Link>
                  </div>
                </article>
                </div>
              </div>
            </div>
          )
        })}
        <div className="h-40" />
      </div>
    </section>
  )
}
