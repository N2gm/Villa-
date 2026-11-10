"use client"
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from '@/site/router'
import { clamp, useInView, useScrollFrame } from '../hooks'
import { lockScroll, scrollToTarget } from '../lib/scroll'
import { preloadSite } from '../lib/preload'
import { Arrow, Button, Eyebrow, LoadImg, Reveal, SplitText } from './ui'

import { img } from '../data'
export const nav = [
  { n: 'Home', to: '/' },
  { n: 'About Us', to: '/about' },
  { n: 'Services', to: '/services' },
  { n: 'Portfolio', to: '/portfolio' },
  { n: 'Careers', to: '/careers' },
  { n: 'Contact', to: '/contact' },
  { n: 'Client Area', to: '/client-area' },
]

export function Preloader({ onDone, onExit }: { onDone: () => void; onExit: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const [logoOut, setLogoOut] = useState(false)
  const [curtainOut, setCurtainOut] = useState(false)
  const [shown, setShown] = useState(0)
  const target = useRef(0)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true

    const id = setTimeout(() => {
      if (!alive) return
      preloadSite((f) => { target.current = Math.max(target.current, f) })
        .then(() => { target.current = 1 })
        .catch(() => { target.current = 1 })
    }, 50)

    const cap = setTimeout(() => { target.current = 1 }, 10000)

    let raf = 0, last = performance.now(), v = 0
    const step = (now: number) => {
      if (!alive) return
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      v = Math.min(target.current, v + Math.max((target.current - v) * (1 - Math.exp(-dt * 6)), 0), v + dt * 1.2)
      if (target.current >= 1 && 1 - v < 0.002) v = 1
      setShown(v)
      if (v < 1) raf = requestAnimationFrame(step)
      else setTimeout(() => alive && setRevealed(true), 250)
    }
    raf = requestAnimationFrame(step)
    return () => { alive = false; clearTimeout(id); cancelAnimationFrame(raf); clearTimeout(cap) }
  }, [])

  useEffect(() => {
    if (!revealed) return
    const t1 = setTimeout(() => setLogoOut(true), 500)
    const t2 = setTimeout(() => { onDone(); setCurtainOut(true) }, 1300)
    const t3 = setTimeout(() => {
      lockScroll('preloader', false)
      onExit()
    }, 2500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [revealed, onDone, onExit])

  // Lock scroll while the preloader is active
  useEffect(() => {
    lockScroll('preloader', true)
    return () => lockScroll('preloader', false)
  }, [])

  // Block touch scrolling on mobile — the overlay intercepts all touch events
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const block = (e: Event) => e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false } as EventListenerOptions)
    el.addEventListener('wheel', block, { passive: false } as EventListenerOptions)
    return () => {
      el.removeEventListener('touchmove', block)
      el.removeEventListener('wheel', block)
    }
  }, [])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[90]"
      style={{ pointerEvents: curtainOut ? 'none' : 'auto', touchAction: 'none' }}
    >
      {/* Left curtain */}
      <div
        className="absolute inset-y-0 left-0 w-1/2 bg-black transition-transform duration-[1000ms] ease-[cubic-bezier(.7,0,.2,1)]"
        style={{ transform: curtainOut ? 'translateX(-100%)' : 'translateX(0)' }}
      />
      {/* Right curtain */}
      <div
        className="absolute inset-y-0 right-0 w-1/2 bg-black transition-transform duration-[1000ms] ease-[cubic-bezier(.7,0,.2,1)]"
        style={{ transform: curtainOut ? 'translateX(100%)' : 'translateX(0)' }}
      />
      {/* Logo container */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-[800ms] ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          opacity: logoOut ? 0 : 1,
          transform: logoOut ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <div className="relative w-[min(80vw,520px)]">
          <img
            src="/logo-white.png"
            alt="Bonyan Design Studio"
            className="block w-full h-auto"
            draggable={false}
          />
          <img
            src="/logo-gold.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ clipPath: `inset(${(1 - shown) * 100}% 0 0 0)` }}
          />
          <p
            className="absolute inset-x-0 top-full mt-8 text-center font-display text-sm font-light tracking-[0.2em] text-gold tabular-nums"
            role="progressbar"
            aria-label="Loading the site"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown * 100)}
          >
            {Math.round(shown * 100)}%
          </p>
        </div>
      </div>
    </div>
  )
}

export function Header({ ready = true }: { ready?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  // On Home the navbar waits for the hero clip; everywhere else it arrives with the page.
  const [heroNav, setHeroNav] = useState(() => typeof document !== 'undefined' && 'heroNav' in document.documentElement.dataset)
  useEffect(() => {
    const on = () => setHeroNav(true)
    addEventListener('hero-nav', on)
    return () => removeEventListener('hero-nav', on)
  }, [])
  const shown = ready && (loc.pathname !== '/' || heroNav)
  useEffect(() => setOpen(false), [loc.pathname])
  // While the menu is open: the page behind holds still and Escape closes it.
  useEffect(() => {
    if (!open) return
    lockScroll('menu', true)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('keydown', key)
    return () => { lockScroll('menu', false); removeEventListener('keydown', key) }
  }, [open])
  // On Home the logo stays out of the hero and the founder's section; it arrives with About Us.
  const [inIntro, setInIntro] = useState(false)
  const measureIntro = () => {
    const el = document.getElementById('home-intro')
    setInIntro(!!el && el.getBoundingClientRect().bottom > 90)
  }
  useScrollFrame(() => { setScrolled(scrollY > 60); measureIntro() })
  useEffect(() => { const id = requestAnimationFrame(measureIntro); return () => cancelAnimationFrame(id) }, [loc.pathname])
  const logoOn = scrolled && !inIntro
  const look = logoOn // the glass bar and logo wait for the end of the intro
  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ${look ? 'py-3' : 'py-6'} ${shown ? 'header-in' : 'pointer-events-none opacity-0'}`} inert={!shown}>
        {/* Same side gutters as the footer: max-w-7xl with 24px of padding, at every width. */}
        <div className="mx-auto max-w-7xl px-6">
        <div className={`relative isolate flex items-center justify-between rounded-full py-3 transition-[padding] duration-500 ${look ? 'px-5' : 'px-0'}`}>
          {/* The glass lives on its own layer: only its opacity ever animates, and the blur stays modest. A big blur on a layer that also resizes is what tore the bar into stripes while scrolling. */}
          <span aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-ink/55 to-ink/35 ring-1 ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-1px_0_rgba(255,255,255,.06),0_14px_34px_-14px_rgba(8,10,11,.4)] backdrop-blur-[10px] backdrop-saturate-[1.4] transition-opacity duration-500 ${look ? 'opacity-100' : 'opacity-0'}`} />
          <Link to="/" tabIndex={logoOn ? 0 : -1} aria-hidden={!logoOn} className={`flex items-center gap-3 transition-all duration-500 ${logoOn ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-3 opacity-0'}`}>
            <img src="/logo-gold-t.png" alt="BONYAN" className="h-10 w-auto object-contain" />
          </Link>
          <nav className="hidden items-center gap-7 xl:flex">
            {nav.map(({ n, to }) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `group relative overflow-hidden text-sm transition-[text-shadow] duration-500 ${look ? '[text-shadow:none]' : isActive ? '[text-shadow:0_1px_2px_rgba(255,255,255,.35),0_2px_12px_rgba(255,255,255,.3)]' : '[text-shadow:0_1px_2px_rgba(8,10,11,.5),0_3px_12px_rgba(8,10,11,.35)]'} ${isActive ? 'text-gold' : 'text-white/80'}`}>
                <span className="block transition-transform duration-500 group-hover:-translate-y-full">{n}</span>
                <span className="absolute inset-0 translate-y-full text-gold transition-transform duration-500 group-hover:translate-y-0">{n}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden md:block"><Button href="/get-a-quote">Get a Quote</Button></div>
            <button aria-label="Open menu" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(true)} className="grid h-12 w-12 place-items-center rounded-full border border-white/20 text-white transition hover:border-gold xl:hidden">
              <span className="space-y-1.5"><span className="block h-px w-5 bg-current" /><span className="block h-px w-3 bg-current" /></span>
            </button>
          </div>
        </div>
      </div>
      </header>
      <div id="site-menu" role="dialog" aria-modal="true" aria-label="Site menu" inert={!open} className={`fixed inset-0 z-[60] overflow-y-auto bg-ink text-white transition-[clip-path] duration-700 ease-[cubic-bezier(.8,0,.2,1)] ${open ? '[clip-path:circle(150%_at_100%_0)]' : '[clip-path:circle(0%_at_100%_0)]'}`}>
        <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-6 top-6 grid h-12 w-12 place-items-center rounded-full border border-white/20 text-2xl transition hover:border-gold hover:text-gold">&times;</button>
        <nav className="flex min-h-full flex-col justify-center gap-3 px-8 py-24 sm:px-12">
          {nav.map(({ n, to }, i) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              // Tapping the page you are on still closes the menu.
              onClick={() => setOpen(false)}
              className={({ isActive }) => `group flex items-center gap-4 font-display text-4xl font-light transition-all duration-700 sm:text-5xl ${isActive ? 'text-gold' : 'text-white/80 hover:pl-3 hover:text-white'}`}
              style={{ transitionDelay: open ? `${200 + i * 60}ms` : '0ms', opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(30px)' }}
            >
              {({ isActive }) => (
                <>
                                    {n}
                </>
              )}
            </NavLink>
          ))}
          <div className="mt-8 transition-all duration-700 md:hidden" style={{ transitionDelay: open ? `${200 + nav.length * 60}ms` : '0ms', opacity: open ? 1 : 0 }}>
            <Button href="/get-a-quote">Get a Quote</Button>
          </div>
        </nav>
      </div>
    </>
  )
}

export function About() {
  const statement = 'Exceptional spaces are created through disciplined thinking, refined design and meticulous execution.'
  const ref = useRef<HTMLParagraphElement>(null)
  const imgRef = useRef<HTMLDivElement>(null)
  useScrollFrame(() => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.4))
    const words = el.children
    for (let k = 0; k < words.length; k++) (words[k] as HTMLElement).style.opacity = String(0.12 + clamp(p * words.length - k) * 0.88)
    const ir = imgRef.current!.getBoundingClientRect()
    const ip = clamp(1 - ir.top / innerHeight)
    imgRef.current!.style.clipPath = `inset(${(1 - ip) * 20}% ${(1 - ip) * 12}% round 2rem)`
  })
  return (
    <section id="about" className="relative bg-white py-32 md:py-44">
      <div className="mx-auto max-w-7xl px-6">
        <Eyebrow>About Us</Eyebrow>
        <p ref={ref} className="mt-10 max-w-6xl font-display text-4xl font-light leading-[1.15] tracking-tight md:text-6xl">
          {statement.split(' ').map((w, k) => <span key={k} className="transition-opacity duration-200">{w} </span>)}
        </p>
        <div className="mt-24 grid gap-16 md:grid-cols-12">
          <div ref={imgRef} className="relative h-[28rem] overflow-hidden md:col-span-7 md:h-[36rem]">
            <LoadImg src={img('photo-1541194577687-8c63bf9e7ee3')} alt="Bonyan interior" className="h-full w-full object-cover" />
            <div className="absolute bottom-6 left-6 rounded-2xl bg-white/90 px-6 py-4 backdrop-blur">
              <div className="font-display text-4xl text-brand">13+</div>
              <div className="text-xs text-mute">Years of experience</div>
            </div>
          </div>
          <div className="flex flex-col justify-center md:col-span-5">
            <Reveal><h2 className="text-4xl font-light leading-tight tracking-tight">Bonyan Delivers Spaces That <span>Define Excellence</span></h2></Reveal>
            <Reveal delay={100}><p className="mt-6 leading-relaxed text-mute">With more than 13 years of experience, Bonyan transforms your vision into environments that inspire, function beautifully and stand the test of time.</p></Reveal>
            <Reveal delay={200}><p className="mt-4 leading-relaxed text-mute">By bringing architecture, interior design and 3D visualisation under one roof, we deliver a seamless design journey from concept to completion, across residential, commercial and administrative spaces.</p></Reveal>
            <Reveal delay={300} className="mt-10"><Button href="/about" variant="outline" className="text-ink">Read our story</Button></Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

const why = [
  { t: 'Premium Design & Execution', d: 'Premium design, flawless execution and bespoke furnishing solutions, crafted to deliver luxury, functionality and exceptional quality.' },
  { t: 'Transparent Project Monitoring', d: 'Track every stage of your project with real-time updates, live site monitoring and complete financial transparency.' },
  { t: 'Post-Handover Support & Maintenance', d: 'Ongoing support and reliable maintenance keep your space flawless long after project completion.' },
]

export function Why() {
  const [open, setOpen] = useState(0)
  return (
    <section className="bg-ink py-32 text-white">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2">
        <div>
          <Eyebrow light>Why Choose Us</Eyebrow>
          <h2 className="mt-6 text-5xl font-light leading-[1.05] tracking-tight md:text-6xl"><SplitText text="Perfection, with complete" /> <SplitText text="peace of mind." delay={300} /></h2>
          <Reveal delay={200} className="relative mt-12 h-80 overflow-hidden rounded-[2rem]">
            <LoadImg dark src={img('photo-1603901622056-0a5bee231395')} alt="Blueprints" className="h-full w-full object-cover opacity-80" />
          </Reveal>
        </div>
        <div className="flex flex-col justify-center">
          {why.map((w, k) => (
            <button key={k} onMouseEnter={() => setOpen(k)} onClick={() => setOpen(k)} className="group border-b border-white/10 py-8 text-left">
              <div className="flex items-center gap-6">
                <span className={`font-display text-sm transition-colors ${open === k ? 'text-gold' : 'text-white/30'}`}>{k + 1}</span>
                <h3 className={`flex-1 text-2xl font-light transition-all duration-500 md:text-3xl ${open === k ? 'translate-x-2 text-white' : 'text-white/50'}`}>{w.t}</h3>
                <span className={`grid h-10 w-10 place-items-center rounded-full border transition-all duration-500 ${open === k ? 'rotate-45 border-gold bg-gold text-ink' : 'border-white/20'}`}>+</span>
              </div>
              <div className={`grid transition-all duration-500 ${open === k ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <p className="overflow-hidden pl-12 pt-4 leading-relaxed text-white/60">{w.d}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink pt-32 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <Eyebrow light>Let's build together</Eyebrow>
        <h2 className="mt-8 text-6xl font-extralight leading-[0.95] tracking-tight md:text-9xl"><SplitText text="Have a space" /><br /><SplitText text="in mind?" delay={250} /></h2>
        <div className="mt-12"><Button href="/get-a-quote">Get a Quote</Button></div>
        <div className="mt-24 grid gap-12 border-t border-white/10 py-16 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="inline-block">
              <img src="/logo-white-t.png" alt="BONYAN" className="h-10 w-auto object-contain" />
            </Link>
            <p className="mt-4 max-w-sm text-white/50">Architecture, interior design and luxury finishing studio. Cairo, since 2012.</p>
          </div>
          <div>
            <h6 className="text-sm font-medium text-gold">Studio</h6>
            <ul className="mt-6 space-y-3 text-white/70">
              {nav.slice(1).map(({ n, to }) => <li key={to}><Link to={to} className="transition hover:pl-2 hover:text-gold">{n}</Link></li>)}
            </ul>
          </div>
          <div>
            <h6 className="text-sm font-medium text-gold">Contact</h6>
            <ul className="mt-6 space-y-3 text-white/70">
              <li><a href="tel:01028993311" className="hover:text-gold">01028993311</a></li>
              <li><a href="mailto:info@bonyan.com.eg" className="hover:text-gold">info@bonyan.com.eg</a></li>
              <li>20 Ibn Hani El Andalusi, Al Manteqa Al Oula, Nasr City, Cairo</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-white/10 py-8 text-sm text-white/50 md:flex-row">
          <span>&copy; {new Date().getFullYear()} Bonyan Design Studio. All rights reserved.</span>
          <button onClick={() => scrollToTarget(0)} className="hover:text-gold">Back to top &uarr;</button>
        </div>
      </div>
      {/* Studio location; fills the band the old wordmark took, never shorter than a usable map. */}
      <div className="mx-auto max-w-7xl px-6 pb-6">
      {/* The embed is filtered to greyscale, which would grey Google's pin too, so the
          map is a fixed, unmarked view and the red pin sits on its exact centre. */}
      <a
        href="https://maps.app.goo.gl/exoLAZWnTmWpDYgA9"
        target="_blank"
        rel="noreferrer"
        aria-label="Open Bonyan Design Studio in Google Maps"
        className="group relative block h-[16.5vw] min-h-[260px] w-full overflow-hidden rounded-2xl"
      >
        <iframe
          title="Bonyan Design Studio on Google Maps"
          src="https://maps.google.com/maps?ll=30.0629556,31.3290564&z=16&t=m&output=embed"
          loading="lazy"
          tabIndex={-1}
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none h-full w-full border-0 [filter:grayscale(1)_invert(.9)_contrast(.9)]"
        />
        <svg viewBox="0 0 24 34" aria-hidden="true" className="absolute left-1/2 top-1/2 h-10 w-7 -translate-x-1/2 -translate-y-full drop-shadow-[0_4px_6px_rgba(0,0,0,.5)] transition-transform group-hover:-translate-y-[110%]">
          <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 34 12 34s12-13.2 12-22.1C24 5.3 18.6 0 12 0z" fill="#E53935" />
          <circle cx="12" cy="12" r="4.2" fill="#fff" />
        </svg>
        <span className="absolute bottom-4 right-4 rounded-full bg-ink/80 px-4 py-2 text-xs text-white/80 backdrop-blur transition-colors group-hover:text-gold">Open in Google Maps &nearr;</span>
      </a>
      </div>
    </footer>
  )
}

export function WhatsApp() {
  return (
    <a href="https://api.whatsapp.com/send?phone=201028993311" target="_blank" rel="noreferrer" aria-label="WhatsApp" className="group fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-2xl transition hover:scale-110">
      <svg viewBox="0 0 24 24" className="relative h-6 w-6" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" /></svg>
    </a>
  )
}
