"use client"
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { clamp, pinProgress, useFrame, useReducedMotion, useScrollFrame } from "../../motion"
import { createLayer, HERO_DEPTH, HERO_IMG, HERO_MASK, HERO_STRUCT, HERO_STRUCT_MASK, IMG_H, IMG_W, loadImage, type Layer } from "./livingImage"
import { RevealTrail } from "./revealTrail"
import { Button, LoadImg } from "../ui"

/** Tells the navbar it may arrive (it waits for the hero on Home). */
const showNav = () => {
  document.documentElement.dataset.heroNav = ""
  window.dispatchEvent(new Event("hero-nav"))
}

/** Anchor point for the (unzoomed) view. */
const DOOR: [number, number] = [0.655, 0.6]
/** Framing bias when the screen crops the photo: wide screens favour the villa, tall ones the open sky. */
const frameX = (aspect: number) => (aspect < 1 ? 0.4 : 0.6)

const ease = (t: number) => t * t * (3 - 2 * t)
/** Scroll phases, as fractions of the pinned scene (hero, then the founder). */
const VILLA = [0.04, 0.46] as const // the villa tips back in 3D and rises away; the name stays put
const PORTRAIT = [0.34, 0.58] as const // the founder turns into view
const TEXT_AT = 0.46 // the founder's words arrive
const span01 = (v: number, [a, b]: readonly [number, number]) => clamp((v - a) / (b - a))


/** A few swallows crossing the sky, each with its own height, speed and wingbeat. */
const BIRDS = [
  { y: 16, s: 1.15, v: 0.018, o: 0.05, flap: 0.42 },
  { y: 19, s: 0.8, v: 0.016, o: 0.11, flap: 0.5 },
  { y: 13, s: 0.7, v: 0.017, o: 0.16, flap: 0.46 },
  { y: 27, s: 0.55, v: 0.011, o: 0.52, flap: 0.58 },
  { y: 30, s: 0.45, v: 0.012, o: 0.6, flap: 0.55 },
  { y: 9, s: 0.6, v: 0.022, o: 0.78, flap: 0.4 },
]

/**
 * Home hero: the studio's villa photograph, alive. Water ripples and glints,
 * the garden moves in the breeze, birds cross the sky behind the name, and the
 * pointer looks around in depth. The studio's name stays fixed behind the villa;
 * scrolling tips the villa back in 3D and lifts it away, uncovering the name as
 * the title of the founder's section, which shares the same pinned stage.
 */
export default function Hero({ ready }: { ready: boolean }) {
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const back = useRef<HTMLCanvasElement>(null)
  const front = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const nameA = useRef<HTMLSpanElement>(null)
  const fallback = useRef<HTMLImageElement>(null)
  const portraits = useRef<HTMLDivElement[]>([])
  const reg = (el: HTMLDivElement | null) => {
    if (el && !portraits.current.includes(el)) portraits.current.push(el)
  }
  const grid = useRef<HTMLDivElement>(null)
  const founderOn = useRef(false)
  const [textOn, setTextOn] = useState(false)
  const birds = useRef<HTMLDivElement>(null)
  const layers = useRef<Layer[]>([])
  const st = useRef({ x: 0, y: 0, sx: 0, sy: 0, scroll: 0, intro: 0, w: 0, h: 0, cx: 0, cy: 0, ptr: false })
  const trail = useRef<RevealTrail | null>(null)
  const [active, setActive] = useState(true)
  const [live, setLive] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!ready) return
    const r = requestAnimationFrame(() => setShown(true))
    const t = window.setTimeout(showNav, reduced ? 0 : 1400)
    return () => {
      cancelAnimationFrame(r)
      clearTimeout(t)
    }
  }, [ready, reduced])

  // Build both photo layers once the photo and its maps are decoded.
  useEffect(() => {
    let gone = false
    // The structure images are an extra: if they fail, the photograph still lives without the reveal.
    const blank = () => {
      const c = document.createElement("canvas")
      c.width = c.height = 1
      return c
    }
    const extra = (src: string) => loadImage(src).catch(blank)
    Promise.all([...[HERO_IMG, HERO_MASK, HERO_DEPTH].map(loadImage), extra(HERO_STRUCT), extra(HERO_STRUCT_MASK)])
      .then((imgs) => {
        if (gone || !back.current || !front.current) return
        const made = [createLayer(back.current, imgs, false), createLayer(front.current, imgs, true)]
        if (made.some((l) => !l)) return made.forEach((l) => l?.dispose())
        layers.current = made as Layer[]
        st.current.w = 0 // force a resize on the next frame
        setLive(true)
      })
      .catch(() => {})
    return () => {
      gone = true
      layers.current.forEach((l) => l.dispose())
      layers.current = []
    }
  }, [])

  // Only animate while the hero is on screen.
  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "100px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      st.current.x = (e.clientX / innerWidth) * 2 - 1
      st.current.y = (e.clientY / innerHeight) * 2 - 1
      st.current.cx = e.clientX
      st.current.cy = e.clientY
      st.current.ptr = true
    }
    const leave = () => (st.current.ptr = false)
    addEventListener("pointermove", move, { passive: true })
    addEventListener("pointerdown", move, { passive: true })
    document.documentElement.addEventListener("pointerleave", leave)
    return () => {
      removeEventListener("pointermove", move)
      removeEventListener("pointerdown", move)
      document.documentElement.removeEventListener("pointerleave", leave)
    }
  }, [])

  useScrollFrame(() => {
    st.current.scroll = pinProgress(section.current)
  })

  useFrame((dt, now) => {
    const s = st.current
    const k = 1 - Math.exp(-dt * 3)
    s.sx += ((reduced ? 0 : s.x) - s.sx) * k
    s.sy += ((reduced ? 0 : s.y) - s.sy) * k
    if (shown) s.intro = reduced ? 1 : Math.min(1, s.intro + dt / 2.6)
    const sc = s.scroll

    // The name never moves, apart from a slight parallax; it clears its soft lower fade once the villa has gone.
    const p = ease(span01(sc, VILLA))
    if (nameA.current) {
      nameA.current.style.transform = `translate3d(${s.sx * -14 * (1 - p)}px, ${s.sy * -6 * (1 - p)}px, 0)`
      nameA.current.style.setProperty("--m", String(p))
    }
    // The villa scrolls away at its full size; the stage behind it turns from sky to ink.
    const lift = `translate3d(0, ${-p * 100}%, 0)`
    for (const el of [fallback.current, back.current, front.current, birds.current]) {
      if (!el) continue
      el.style.transform = p ? lift : ""
    }
    if (shade.current) shade.current.style.opacity = String(1 - p)
    if (frame.current) frame.current.style.backgroundColor = `color-mix(in srgb, #3E8BD6 ${clamp(1 - p * 1.8) * 100}%, #080A0B)`
    if (birds.current) {
      birds.current.style.opacity = String(1 - clamp(sc / 0.2))
      const t = now / 1000
      Array.from(birds.current.children).forEach((b, i) => {
        const d = BIRDS[i]
        // They cross the open sky to the left of the roof, then loop round.
        const x = ((reduced ? d.o : d.o + t * d.v) % 1) * 85 - 12
        const y = d.y + Math.sin(t * 0.7 + i * 1.9) * 1.4
        ;(b as HTMLElement).style.transform = `translate3d(${x}vw, ${y}vh, 0) scale(${d.s})`
      })
    }
    // The founder: the portrait turns into view, then the words follow.
    const u = ease(span01(sc, PORTRAIT))
    for (const el of portraits.current) {
      el.style.opacity = String(u)
      el.style.transform = `translate3d(0, ${(1 - u) * 14}px, 0) rotateY(${(1 - u) * -38}deg) rotateX(${(1 - u) * 14}deg) scale(${0.8 + 0.2 * u})`
    }
    if (grid.current) grid.current.style.opacity = String(0.7 * u)
    const on = sc > TEXT_AT
    if (on !== founderOn.current) {
      founderOn.current = on
      setTextOn(on)
    }

    const ls = layers.current
    if (ls.length && back.current) {
      const c = back.current
      const w = c.clientWidth
      const h = c.clientHeight
      if (w !== s.w || h !== s.h) {
        s.w = w
        s.h = h
        const dpr = Math.min(devicePixelRatio || 1, 1.5)
        ls.forEach((l) => l.resize(w, h, dpr))
      }
      // Cover-fit the photo with a little overscan for parallax, settling in on arrival.
      const ia = IMG_W / IMG_H
      const sa = w / Math.max(1, h)
      const settle = 1 + 0.1 * (1 - ease(s.intro))
      const over = 0.965 / settle
      const span: [number, number] = sa > ia ? [over, (ia / sa) * over] : [(sa / ia) * over, over]
      const cx = clamp(frameX(sa), span[0] / 2, 1 - span[0] / 2)
      const cy = clamp(0.5, span[1] / 2, 1 - span[1] / 2)
      const frame = {
        time: reduced ? 0 : now / 1000,
        center: [cx, cy] as [number, number],
        span,
        focus: DOOR,
        zoom: 1,
        ptr: [s.sx, s.sy] as [number, number],
        live: reduced ? 0 : 1,
        blur: 0,
        reveal: reduced ? 0 : 1,
      }
      // Pointer trail (screen space) feeds the structure reveal.
      if (!reduced) {
        const tr = (trail.current ??= new RevealTrail())
        tr.resize(w / Math.max(1, h))
        // A fingertip is blunt and phone screens are narrow, so the stroke grows there.
        tr.radius = w < 640 ? 0.42 : w < 1100 ? 0.3 : 0.17
        const rc = c.getBoundingClientRect()
        const nx = (s.cx - rc.left) / Math.max(1, rc.width)
        const ny = (s.cy - rc.top) / Math.max(1, rc.height)
        const on = s.ptr && shown && nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1
        tr.update(dt, on ? nx : null, on ? ny : null)
        ls.forEach((l) => l.setTrail(tr.bytes, tr.w, tr.h))
      }
      ls.forEach((l) => l.draw(frame))
    }
    return !reduced || Math.abs(s.x - s.sx) + Math.abs(s.y - s.sy) > 0.001 || s.intro < 1
  }, active)

  return (
    <section ref={section} id="home-intro" aria-labelledby="hero-title" className="relative h-[300svh] bg-ink">
      <div ref={frame} className="sticky top-0 h-svh min-h-[34rem] w-full overflow-hidden bg-[#3E8BD6] [--edge:8svh] md:[--edge:5svh]">
        {/* The photograph (also the fallback where WebGL isn't available). */}
        <img
          ref={fallback}
          src={HERO_IMG}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover object-[40%_50%] md:object-[60%_50%] transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`}
        />
        <div className={`absolute inset-0 transition-opacity duration-[1600ms] ${shown ? "opacity-100" : "opacity-0"}`}>
          <canvas ref={back} className="absolute inset-0 h-full w-full" />

          {/* Birds in the sky, behind the name and the house. */}
          <div ref={birds} aria-hidden="true" className="pointer-events-none absolute inset-0">
            {BIRDS.map((b, i) => (
              <span key={i} className="absolute left-0 top-0 block will-change-transform">
                <svg width="26" height="12" viewBox="0 0 26 12" className="block origin-center" style={{ animation: reduced ? "none" : `bird-flap ${b.flap}s ease-in-out ${i * -0.13}s infinite alternate` }}>
                  <path d="M1 3 Q7 1 13 8 Q19 1 25 3 Q19 4 13 10 Q7 4 1 3Z" fill="#1f2b38" fillOpacity=".75" />
                </svg>
              </span>
            ))}
          </div>

          {/* The name, set in the sky; the villa stands in front of it. */}
          <div className="pointer-events-none absolute inset-x-0 top-[var(--edge)] [perspective:1100px]">
            <div className="mx-auto max-w-7xl px-6">
            <h1 id="hero-title" className="m-0">
              <span ref={nameA} className="block will-change-transform">
                <NameImg
                  alt="Bonyan, Architecture and Interior Design"
                  style={{
                    transform: shown ? "none" : "translateY(18%)",
                    opacity: shown ? 1 : 0,
                    transitionDuration: reduced ? "0ms" : "1600ms",
                    transitionDelay: reduced ? "0ms" : "300ms",
                  }}
                />
              </span>
            </h1>
            </div>
          </div>

          <canvas ref={front} className="absolute inset-0 h-full w-full" />
        </div>

        {/* A soft lens vignette; it leaves with the photograph. */}
        <div ref={shade} className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_45%,transparent_62%,rgba(8,10,11,.3)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        {/* The founder. */}
        <div className={`absolute inset-0 z-20 flex flex-col ${textOn ? "" : "pointer-events-none"}`}>
          <div ref={grid} className="blueprint-grid pointer-events-none absolute inset-0 opacity-0" />
          {/* The portrait sits at the right, centred on the screen's height. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
            <div className="mx-auto flex h-full max-w-7xl items-center justify-end px-6">
              <div className="aspect-square w-[min(34vw,30rem,64svh)] [perspective:1200px]">
                <Portrait reg={reg} className="h-full w-full" />
              </div>
            </div>
          </div>
          {/* Room for the name, which stays where the hero set it. */}
          <div aria-hidden="true" className="relative shrink-0 h-[calc(min(78vw,44rem)*.3086+var(--edge)+1rem)] md:h-[calc(min(46vw,44rem)*.3086+var(--edge)+1rem)]" />
          <div className="relative flex min-h-0 flex-1 items-end pb-[var(--edge)]">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 text-white lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-5 lg:block">
                <div className="shrink-0 [perspective:1200px] lg:hidden">
                  <Portrait reg={reg} alt="Muhamed Halim Tohamy, founder of Bonyan" className="aspect-square w-24 sm:w-32 md:w-44" />
                </div>
                <div>
                  <Rise on={textOn} i={0}>
                    <p className="text-sm font-medium text-gold">Meet the founder</p>
                  </Rise>
                  <Rise on={textOn} i={1}>
                    <h2 className="mt-3 text-3xl font-extralight leading-[1.05] tracking-tight sm:text-4xl md:text-6xl">Muhamed Halim Tohamy</h2>
                  </Rise>
                  <Rise on={textOn} i={2}>
                    <p className="mt-3 text-sm text-white/55 sm:text-base">Founder, Bonyan Design Studio</p>
                  </Rise>
                </div>
              </div>
              <Rise on={textOn} i={3}>
                <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/65 sm:text-[0.95rem] md:text-lg lg:mt-8">
                  Muhamed founded Bonyan in Cairo in 2012 to bring architecture, interior design and 3D visualisation under one roof. Over more than 13 years he has guided the studio&rsquo;s work from first concept to final handover, across residential, commercial and administrative spaces.
                </p>
              </Rise>
              <Rise on={textOn} i={4}>
                <div className="mt-7 flex flex-wrap items-center gap-x-10 gap-y-5 lg:mt-10">
                  <div className="hidden sm:block">
                    <div className="font-display text-4xl font-extralight text-gold">13+</div>
                    <div className="mt-1 text-xs text-white/50">Years of experience</div>
                  </div>
                  <Button href="/about" variant="outline" className="text-white">Read our story</Button>
                </div>
              </Rise>
            </div>

          </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The studio name, as the hero draws it; the founder section reuses it as its title. */
function NameImg({ alt = "", style }: { alt?: string; style?: CSSProperties }) {
  const fade = "linear-gradient(to bottom, #000 calc(40% + var(--m, 0) * 60%), transparent 100%)"
  return (
    <img
      src="/hero/bonyan-logo.png"
      alt={alt}
      width={1400}
      height={432}
      draggable={false}
      className="block h-auto w-[78vw] max-w-[44rem] select-none transition-[transform,opacity] ease-[cubic-bezier(.2,.7,.2,1)] md:w-[46vw]"
      style={{ ...style, maskImage: fade, WebkitMaskImage: fade }}
    />
  )
}

/** One line of the founder's text, rising in after the title lands. */
function Rise({ on, i, children }: { on: boolean; i: number; children: ReactNode }) {
  return (
    <div className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)] ${on ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`} style={{ transitionDelay: on ? `${i * 110}ms` : "0ms" }}>
      {children}
    </div>
  )
}

/** The founder's portrait in a thin gold ring; the stage turns it into view as you scroll. */
function Portrait({ reg, className, alt = "" }: { reg: (el: HTMLDivElement | null) => void; className: string; alt?: string }) {
  return (
    <div ref={reg} className={`will-change-transform ${className}`} style={{ opacity: 0 }}>
      <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-gold/40 ring-offset-4 ring-offset-ink">
        <LoadImg dark src="/hero/founder.jpg" alt={alt} width={987} height={1000} draggable={false} className="h-full w-full scale-[1.06] object-cover" />
      </div>
    </div>
  )
}
