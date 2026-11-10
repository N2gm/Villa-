"use client"
import { useEffect, useRef, useState } from "react"
import { Eyebrow, Field, Reveal, SubmitButton } from "../components/ui"
import { contact } from "../data"
import { submitContact } from "@/lib/actions"
import { validateContact, type ContactInput } from "@/lib/validation"
import {
  useFrame,
  useReducedMotion,
  wake,
} from "../motion"

const LINES = ["Let's talk", "about your space."]

/**
 * Each letter is a particle tied to its home by a spring; the cursor pushes
 * letters away with an inverse-square force, and they tumble back into place.
 */
function RepelHeadline() {
  const reduced = useReducedMotion()
  const live = !reduced
  const root = useRef<HTMLHeadingElement>(null)
  const chars = useRef<HTMLSpanElement[]>([])
  const home = useRef<{ x: number; y: number }[]>([])
  const body = useRef<{ x: number; y: number; vx: number; vy: number }[]>([])
  const ptr = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const measure = () => {
      const r = root.current?.getBoundingClientRect()
      if (!r) return
      home.current = chars.current.map((c) => {
        const b = c.getBoundingClientRect()
        const x = b.left + b.width / 2 - r.left
        return { x, y: b.top + b.height / 2 - r.top }
      })
      body.current = chars.current.map(
        (_, k) => body.current[k] ?? { x: 0, y: 0, vx: 0, vy: 0 },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (root.current) ro.observe(root.current)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [])

  useFrame((dt) => {
    let moving = false
    const p = ptr.current
    body.current.forEach((b, k) => {
      const h = home.current[k]
      if (!h) return
      let fx = -120 * b.x - 14 * b.vx
      let fy = -120 * b.y - 14 * b.vy
      if (p) {
        const dx = h.x + b.x - p.x,
          dy = h.y + b.y - p.y
        const d2 = dx * dx + dy * dy,
          R = 140
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1
          const f = 14000 * (1 - d / R) ** 2
          fx += (dx / d) * f
          fy += (dy / d) * f
        }
      }
      b.vx += fx * dt
      b.vy += fy * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      const el = chars.current[k]
      if (
        Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.vx) + Math.abs(b.vy) >
        0.05
      ) {
        moving = true
        el.style.transform = `translate3d(${b.x.toFixed(2)}px,${b.y.toFixed(2)}px,0) rotate(${(b.vx * 0.04).toFixed(2)}deg)`
      } else if (el.style.transform) {
        b.x = b.y = b.vx = b.vy = 0
        el.style.transform = ""
      }
    })
    return moving || !!p
  }, live)

  // Mouse hover on desktop; a press (or drag) with a finger on touch screens.
  const press = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect()
    ptr.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    wake()
  }

  let n = 0
  return (
    <h1
      ref={root}
      aria-label={LINES.join(" ")}
      onPointerMove={press}
      onPointerDown={press}
      onPointerLeave={() => {
        ptr.current = null
        wake()
      }}
      className="relative select-none py-6 text-6xl font-extralight leading-[0.95] tracking-tight md:text-[9rem]"
    >
      {LINES.map((line, li) => (
        <span
          key={li}
          aria-hidden="true"
          className={`block ${""}`}
        >
          {line.split(" ").map((w, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap">
              {[...w].map((ch) => {
                const k = n++
                return (
                  <span
                    key={k}
                    ref={(el) => {
                      if (el) chars.current[k] = el
                    }}
                    className="inline-block will-change-transform"
                  >
                    {ch}
                  </span>
                )
              })}
              &nbsp;
            </span>
          ))}
        </span>
      ))}
    </h1>
  )
}

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [d, setD] = useState<ContactInput>({ name: "", phone: "", email: "", message: "" })
  // Checked on blur and on submit, never while someone is still typing for the first time.
  const [touched, setTouched] = useState<Partial<Record<keyof ContactInput, boolean>>>({})
  const [serverErrors, setServerErrors] = useState<Partial<Record<string, string>>>({})
  const [failure, setFailure] = useState("")
  const errors = { ...validateContact(d), ...serverErrors } as Partial<Record<keyof ContactInput, string>>
  const shown = (k: keyof ContactInput) => (touched[k] ? errors[k] : undefined)
  const set = (k: keyof ContactInput) => (e: { target: { value: string } }) => {
    setD({ ...d, [k]: e.target.value })
    setServerErrors((x) => ({ ...x, [k]: undefined }))
  }
  const blur = (k: keyof ContactInput) => () => d[k] && setTouched((t) => ({ ...t, [k]: true }))
  const send = async () => {
    setTouched({ name: true, phone: true, email: true })
    setFailure("")
    const bad = (["name", "phone", "email"] as const).find((k) => validateContact(d)[k])
    if (bad) {
      document.getElementById(`c-${bad}`)?.focus()
      return
    }
    setSending(true)
    const res = await submitContact(d).catch(() => ({ ok: false as const, message: "We couldn't send that just now. Please try again." }))
    setSending(false)
    if (res.ok) setSent(true)
    else {
      if ("errors" in res && res.errors) setServerErrors(res.errors)
      if (res.message) setFailure(res.message)
    }
  }
  const msg = (k: keyof ContactInput) =>
    shown(k) ? (
      <p id={`c-${k}-err`} className="flex items-center gap-2 pt-2 text-sm text-error-300">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.8v3.6M8 10.8v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {shown(k)}
      </p>
    ) : null
  const aria = (k: keyof ContactInput) => ({
    id: `c-${k}`,
    value: d[k],
    onChange: set(k),
    onBlur: blur(k),
    "aria-invalid": !!shown(k),
    "aria-describedby": shown(k) ? `c-${k}-err` : undefined,
  })
  const field =
    "field w-full border-b border-white/15 bg-transparent py-3 text-white outline-none transition-colors duration-[var(--dur-change)] placeholder:text-white/45 focus:border-gold"
  return (
    <>
      <section className="relative overflow-hidden bg-ink pb-20 pt-40 text-white">
        <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-7xl px-6">
          <p className="text-xs text-white/50">
            Contact &middot; We reply within one working day
          </p>
          <RepelHeadline />
        </div>
      </section>
      <section className="bg-ink pb-32 text-white">
        <div className="mx-auto grid max-w-7xl gap-20 border-t border-white/10 px-6 pt-20 lg:grid-cols-2">
          <div>
            <Eyebrow light>Reach the studio</Eyebrow>
            <ul className="mt-10 space-y-8 font-display text-2xl font-light">
              <li>
                <div className="text-xs text-white/50">
                  Phone number
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  className="transition hover:text-gold"
                >
                  {contact.phone}
                </a>
              </li>
              <li>
                <div className="text-xs text-white/50">
                  Email address
                </div>
                <a
                  href={`mailto:${contact.email}`}
                  className="transition hover:text-gold"
                >
                  {contact.email}
                </a>
              </li>
              <li>
                <div className="text-xs text-white/50">
                  Studio
                </div>
                {contact.address}
              </li>
              <li>
                <div className="text-xs text-white/50">
                  WhatsApp
                </div>
                <a
                  href={contact.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-gold"
                >
                  Message us
                </a>
              </li>
            </ul>
          </div>
          <Reveal>
            {sent ? (
              <p
                className="font-display text-3xl font-light text-gold"
                role="status"
              >
                Thank you. We will be in touch shortly.
              </p>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!sending) send()
                }}
                className="space-y-6"
              >
                <Field label="Full name" htmlFor="c-name">
                  <input {...aria("name")} autoComplete="name" className={field} />
                  {msg("name")}
                </Field>
                <Field label="Phone number" htmlFor="c-phone">
                  <input {...aria("phone")} autoComplete="tel" type="tel" placeholder="+20" className={field} />
                  {msg("phone")}
                </Field>
                <Field label="Email" htmlFor="c-email">
                  <input {...aria("email")} autoComplete="email" type="email" placeholder="name@example.com" className={field} />
                  {msg("email")}
                </Field>
                <Field label="Tell us about your space" htmlFor="c-message">
                  <textarea {...aria("message")} rows={4} placeholder="Rooms, size, style, timeline" className={field} />
                  {msg("message")}
                </Field>
                {failure && (
                  <p role="alert" className="text-sm text-error-300">
                    {failure}
                  </p>
                )}
                <SubmitButton loading={sending}>Send message</SubmitButton>
              </form>
            )}
          </Reveal>
        </div>
      </section>
    </>
  )
}
