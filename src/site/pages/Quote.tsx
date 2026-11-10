"use client"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Link } from '@/site/router'
import { Arrow, Field, Spinner } from "../components/ui"
import { contact } from "../data"
import { useReducedMotion } from "../motion"
import { scrollToTarget } from "../lib/scroll"
import { submitQuote } from "@/lib/actions"
import { quoteOptions } from "@/lib/quote-options"
import { validateContact } from "@/lib/validation"

const steps = [
  { key: "type", label: "Project", q: "What are we designing?", multi: false, options: quoteOptions.type },
  {
    key: "services",
    label: "Services",
    q: "Which services do you need?",
    multi: true,
    options: quoteOptions.services,
  },
  { key: "size", label: "Size", q: "Roughly how large is it?", multi: false, options: quoteOptions.size },
  { key: "when", label: "Timing", q: "When would you like to start?", multi: false, options: quoteOptions.when },
] as const
const CONTACT = steps.length
const TOTAL = steps.length + 1
type Answers = Record<string, string[]>
type Details = { name: string; phone: string; email: string; note: string }
const blank: Details = { name: "", phone: "", email: "", note: "" }
type Errors = Partial<Record<keyof Details, string>>
const ease = [0.7, 0, 0.2, 1] as const
const pad = (n: number) => String(n + 1)
// Motion timing from the style guide, in seconds: enter > change > exit.
const T = { enter: 0.6, change: 0.25, exit: 0.18 }
/** How long a finished card holds its green trace before the next one opens. */
const SEAL_MS = 750

const validate = (d: Details): Errors => validateContact(d)

/** Get a Quote: the brief as a stack of cards. Answered cards fold into a summary; the open one takes the stage. */
export default function Quote() {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const [a, setA] = useState<Answers>({})
  const [d, setD] = useState<Details>(blank)
  const [done, setDone] = useState(false)
  // The card being confirmed: it traces a green outline, then hands over to the next one.
  const [sealing, setSealing] = useState<number | null>(null)
  const [touched, setTouched] = useState<Partial<Record<keyof Details, boolean>>>({})
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState("")
  const timer = useRef(0)
  const cards = useRef<(HTMLElement | null)[]>([])
  const moved = useRef(false)

  const has = (k: number) => k < CONTACT && (a[steps[k].key] ?? []).length > 0
  const firstOpen = () => {
    const k = steps.findIndex((_, n) => !has(n))
    return k < 0 ? CONTACT : k
  }
  // A card can be opened once it has an answer, or when it is the next one waiting.
  const reachable = (k: number) => has(k) || k === firstOpen()
  const answered = steps.filter((_, n) => has(n)).length + (done ? 1 : 0)

  const go = (n: number) => {
    clearTimeout(timer.current)
    setSealing(null)
    setSending(false)
    moved.current = true
    setI(n)
  }
  const confirm = (k: number, next: Answers) => {
    clearTimeout(timer.current)
    setSealing(k)
    timer.current = window.setTimeout(() => advance(k, next), reduced ? 0 : SEAL_MS)
  }
  // After an answer, move to the next unanswered card, or to the details once everything is in.
  const advance = (from: number, next: Answers) => {
    const k = steps.findIndex((s, n) => n > from && !(next[s.key] ?? []).length)
    go(k < 0 ? CONTACT : k)
  }

  const pick = (k: number, o: string) => {
    const s = steps[k]
    const cur = a[s.key] ?? []
    const next = { ...a, [s.key]: s.multi ? (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]) : [o] }
    setA(next)
    if (!s.multi) confirm(k, next)
  }
  const setAll = (k: number, on: boolean) => setA({ ...a, [steps[k].key]: on ? [...steps[k].options] : [] })
  const reset = () => {
    clearTimeout(timer.current)
    setA({})
    setD(blank)
    setTouched({})
    setDone(false)
    go(0)
  }

  useEffect(() => () => clearTimeout(timer.current), [])
  // Keep the open card in view and give it focus after any move (not on first load).
  useEffect(() => {
    if (!moved.current) return
    const el = done ? cards.current[TOTAL] : cards.current[i]
    if (!el) return
    const t = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      if (r.top < 110 || r.top > innerHeight * 0.6) scrollToTarget(el, { offset: -130, immediate: reduced })
      el.focus({ preventScroll: true })
    }, reduced ? 0 : 380)
    return () => clearTimeout(t)
  }, [i, done, reduced])

  const spring = reduced ? { duration: 0 } : { duration: T.enter, ease }
  const errors = validate(d)
  const shown = (k: keyof Details) => (touched[k] ? errors[k] : undefined)
  const submit = () => {
    setTouched({ name: true, phone: true, email: true })
    const bad = (Object.keys(errors) as (keyof Details)[])[0]
    if (bad) {
      document.getElementById(`q-${bad}`)?.focus()
      return
    }
    clearTimeout(timer.current)
    setSending(true)
    setFailure("")
    submitQuote({ answers: a, details: d })
      .catch(() => ({ ok: false as const, message: "We couldn't send your brief just now. Please try again." }))
      .then((res) => {
        setSending(false)
        if (!res.ok) {
          if ("errors" in res && res.errors) {
            setTouched({ name: true, phone: true, email: true })
            const bad = Object.keys(res.errors)[0]
            if (bad) document.getElementById(`q-${bad}`)?.focus()
          }
          setFailure(res.message ?? "Check the highlighted details.")
          return
        }
        // On success the card seals green, then the thank-you arrives.
        setSealing(CONTACT)
        timer.current = window.setTimeout(() => {
          setSealing(null)
          moved.current = true
          setDone(true)
        }, reduced ? 0 : SEAL_MS)
      })
  }
  const input = (k: keyof Details, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const err = shown(k)
    return (
      <Field label={label} htmlFor={`q-${k}`}>
        <input
          id={`q-${k}`}
          value={d[k]}
          aria-invalid={!!err}
          aria-describedby={err ? `q-${k}-err` : undefined}
          onChange={(e) => setD({ ...d, [k]: e.target.value })}
          onBlur={() => d[k] && setTouched((t) => ({ ...t, [k]: true }))}
          className={`${field} ${touched[k] && !err && d[k] ? "border-success/60" : ""}`}
          {...extra}
        />
        <AnimatePresence initial={false}>
          {err && (
            <motion.p
              id={`q-${k}-err`}
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: { duration: T.change } }}
              exit={reduced ? undefined : { opacity: 0, height: 0, transition: { duration: T.exit } }}
              className="flex items-center gap-2 overflow-hidden pt-2 text-sm text-error-300"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 4.8v3.6M8 10.8v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {err}
            </motion.p>
          )}
        </AnimatePresence>
      </Field>
    )
  }
  const field =
    "field w-full border-b border-white/15 bg-transparent py-3 text-white outline-none transition-colors duration-[var(--dur-change)] placeholder:text-white/45 focus:border-gold"

  return (
    <section className="min-h-[100svh] bg-ink pt-32 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-24 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <p className="text-sm font-medium text-gold">Get a Quote</p>
            <h1 className="mt-5 font-display text-5xl font-extralight leading-[1.02] tracking-tight md:text-6xl">
              Tell us about <span>your space.</span>
            </h1>
            <p className="mt-5 max-w-sm leading-relaxed text-white/60">
              We read every brief ourselves and call you back within one working day.
            </p>
            <div className="mt-10 flex min-h-5 items-center justify-between text-sm">
              <span className="text-white/50" aria-live="polite">
                {done ? "Brief sent" : ""}
              </span>
              <AnimatePresence>
                {(answered > 0 || i > 0) && (
                  <motion.button
                    type="button"
                    onClick={reset}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="text-white/60 underline-offset-4 transition hover:text-white hover:underline"
                  >
                    Start over
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-8">
          <AnimatePresence mode="popLayout" initial={false}>
            {done ? (
              <motion.div
                key="done"
                ref={(el) => {
                  cards.current[TOTAL] = el
                }}
                tabIndex={-1}
                role="status"
                initial={reduced ? false : { opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0, y: -20 }}
                transition={spring}
                className="rounded-[2rem] bg-white/[0.04] p-8 outline-none ring-1 ring-white/10 md:p-12"
              >
                <p className="text-sm font-medium text-success-300">Brief received</p>
                <h2 className="mt-6 text-4xl font-light leading-tight tracking-tight md:text-6xl">
                  Thank you{d.name ? `, ${d.name.split(" ")[0]}` : ""}.{" "}
                  <span>We&rsquo;ll call you within one working day.</span>
                </h2>
                <dl className="mt-10 grid gap-x-8 gap-y-5 border-t border-white/10 pt-8 sm:grid-cols-2">
                  {steps.map((s) => (
                    <div key={s.key}>
                      <dt className="text-xs text-white/50">{s.label}</dt>
                      <dd className="mt-1 text-white">{(a[s.key] ?? []).join(", ")}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-8 text-white/60">
                  Can&rsquo;t wait? Call us on{" "}
                  <a href={`tel:${contact.phone}`} className="text-gold">
                    {contact.phone}
                  </a>
                  .
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                  <Link to="/portfolio" className="inline-flex items-center gap-3 rounded-full bg-brand px-7 py-3.5 text-sm font-medium text-white transition hover:bg-white hover:text-ink">
                    See our work <Arrow className="h-4 w-4" />
                  </Link>
                  <button type="button" onClick={() => { setDone(false); go(CONTACT) }} className="text-sm text-white/60 transition hover:text-white">
                    Edit my brief
                  </button>
                  <button type="button" onClick={reset} className="text-sm text-white/60 transition hover:text-white">
                    Start a new brief
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.ol key="stack" className="space-y-3" exit={reduced ? undefined : { opacity: 0, y: -20 }} transition={spring}>
                {[...steps, null].map((s, k) => {
                  const open = k === i
                  const ok = k < CONTACT ? has(k) : false
                  const can = reachable(k) && !open
                  const picked = s ? a[s.key] ?? [] : []
                  return (
                    <motion.li
                      key={k}
                      ref={(el) => {
                        cards.current[k] = el
                      }}
                      tabIndex={-1}
                      layout={!reduced}
                      transition={spring}
                      className={`relative overflow-hidden rounded-[1.75rem] outline-none ring-1 transition-colors duration-[var(--dur-change)] ${
                        sealing === k ? "saved-surface ring-success/40" : open ? "bg-white/[0.06] ring-white/15" : ok ? "bg-white/[0.03] ring-white/10" : "bg-transparent ring-white/[0.06]"
                      } ${sealing === k ? "pointer-events-none" : ""}`}
                    >
                      {sealing === k && (
                        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true">
                          <motion.rect
                            x="1"
                            y="1"
                            rx="27"
                            style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
                            fill="none"
                            stroke="var(--color-success)"
                            strokeWidth="2"
                            initial={reduced ? false : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: SEAL_MS / 1000 - 0.1, ease: "easeInOut" }}
                          />
                        </svg>
                      )}
                      {/* Header row: the summary when folded, the title bar when open. */}
                      <motion.button
                        layout={!reduced ? "position" : false}
                        type="button"
                        disabled={!can}
                        onClick={() => go(k)}
                        aria-expanded={open}
                        className={`flex w-full items-center gap-5 px-6 py-5 text-left md:px-8 ${can ? "group cursor-pointer" : "cursor-default"}`}
                      >
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-xs tabular-nums transition-colors duration-500 ${
                            sealing === k ? "bg-success-300 text-success-900" : ok && !open ? "bg-success text-ink" : open ? "bg-white text-ink" : "text-white/40 ring-1 ring-white/15"
                          }`}
                        >
                          {ok && !open && sealing !== k ? (
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                              <motion.path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
                            </svg>
                          ) : (
                            pad(k)
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm ${sealing === k ? "text-success-300" : open ? "text-gold" : ok ? "text-white/60" : "text-white/45"}`}>
                            {s ? s.label : "Your details"}
                          </span>
                          {!open && (
                            <span className="mt-1.5 flex min-h-6 flex-wrap gap-1.5">
                              <AnimatePresence mode="popLayout" initial={false}>
                                {picked.length ? (
                                  picked.map((o) => (
                                    <motion.span
                                      key={o}
                                      layout={!reduced}
                                      initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={reduced ? undefined : { opacity: 0, scale: 0.8 }}
                                      transition={{ duration: 0.3 }}
                                      className="rounded-full bg-white/10 px-3 py-0.5 text-sm text-white"
                                    >
                                      {o}
                                    </motion.span>
                                  ))
                                ) : (
                                  <motion.span key="none" initial={false} className={`text-sm ${can ? "text-white/60" : "text-white/35"}`}>
                                    {s ? s.q : "Name and phone number"}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </span>
                          )}
                        </span>
                        {sealing === k && <span className="shrink-0 text-sm font-medium text-success-300">Saved</span>}
                        {can && (
                          <span className="shrink-0 text-sm text-white/50 transition group-hover:text-gold">{ok ? "Edit" : "Open"}</span>
                        )}
                        {!can && !open && (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-white/25" aria-label="Locked">
                            <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" />
                            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" />
                          </svg>
                        )}
                      </motion.button>

                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            key="body"
                            tabIndex={-1}
                            initial={reduced ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={reduced ? undefined : { opacity: 0, height: 0 }}
                            transition={spring}
                            className="outline-none"
                          >
                            <div className="px-6 pb-7 md:px-8 md:pb-9">
                              {s ? (
                                <>
                                  <h2 className="text-3xl font-light tracking-tight md:text-5xl">{s.q}</h2>
                                  {s.multi && (
                                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                                      <span className="text-white/60">Choose all that apply</span>
                                      <span className="text-white/50 tabular-nums" aria-live="polite">
                                        {picked.length} selected
                                      </span>
                                      <span className="ml-auto flex gap-4">
                                        <button type="button" disabled={picked.length === s.options.length} onClick={() => setAll(k, true)} className="text-white/70 transition hover:text-gold disabled:text-white/30">
                                          Select all
                                        </button>
                                        <button type="button" disabled={!picked.length} onClick={() => setAll(k, false)} className="text-white/70 transition hover:text-gold disabled:text-white/30">
                                          Clear
                                        </button>
                                      </span>
                                    </div>
                                  )}
                                  <div role={s.multi ? "group" : "radiogroup"} aria-label={s.q} className="mt-7 grid gap-2 sm:grid-cols-2">
                                    {s.options.map((o, n) => {
                                      const on = picked.includes(o)
                                      return (
                                        <motion.button
                                          key={o}
                                          type="button"
                                          role={s.multi ? "checkbox" : "radio"}
                                          aria-checked={on}
                                          onClick={() => pick(k, o)}
                                          initial={reduced ? false : { opacity: 0, y: 12 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: reduced ? 0 : 0.15 + n * 0.05, duration: 0.4, ease }}
                                          whileTap={reduced ? undefined : { scale: 0.98 }}
                                          className={`relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 text-left text-lg font-light transition-colors duration-300 ${
                                            on ? "text-white ring-1 ring-gold" : "text-white/80 ring-1 ring-white/10 hover:text-white hover:ring-white/30"
                                          }`}
                                        >
                                          {/* The fill sweeps in from the indicator, staggered when several change at once. */}
                                          <motion.span
                                            aria-hidden="true"
                                            className="absolute inset-0 origin-left bg-gold/[0.14]"
                                            initial={false}
                                            animate={{ scaleX: on ? 1 : 0 }}
                                            transition={{ duration: reduced ? 0 : T.change + 0.1, ease, delay: reduced ? 0 : n * 0.04 }}
                                          />
                                          <span className={`relative grid h-6 w-6 shrink-0 place-items-center border transition-colors duration-300 ${s.multi ? "rounded-md" : "rounded-full"} ${on ? "border-gold bg-gold text-ink" : "border-white/30"}`}>
                                            <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                                              <motion.path
                                                d="M3 8.5l3 3 7-7"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                initial={false}
                                                animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                                                transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : n * 0.04 + 0.1 }}
                                              />
                                            </svg>
                                          </span>
                                          <span className="relative">{o}</span>
                                        </motion.button>
                                      )
                                    })}
                                  </div>
                                  <div className="mt-8 flex items-center gap-6">
                                    {k > 0 && (
                                      <button type="button" onClick={() => go(k - 1)} className="text-sm text-white/60 transition hover:text-white">
                                        Back
                                      </button>
                                    )}
                                    {(s.multi || has(k)) && (
                                      <button
                                        type="button"
                                        disabled={!picked.length}
                                        onClick={() => confirm(k, a)}
                                        className="ml-auto inline-flex items-center gap-3 rounded-full bg-brand px-7 py-3.5 text-sm font-medium text-white transition hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                                      >
                                        Continue <Arrow className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <form
                                  noValidate
                                  onSubmit={(e) => {
                                    e.preventDefault()
                                    submit()
                                  }}
                                  className="space-y-5"
                                >
                                  <h2 className="text-3xl font-light tracking-tight md:text-5xl">Where can we reach you?</h2>
                                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                                    {input("name", "Full name", { autoComplete: "name", required: true })}
                                    {input("phone", "Phone number", { autoComplete: "tel", inputMode: "tel", type: "tel", required: true })}
                                  </div>
                                  {input("email", "Email (optional)", { autoComplete: "email", type: "email", placeholder: "name@example.com" })}
                                  <Field label="Anything else we should know?" htmlFor="q-note"><textarea id="q-note" rows={3} placeholder="Access, deadlines, references" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} className={`${field} resize-none`} /></Field>
                                  {failure && (
                                    <p role="alert" className="text-sm text-error-300">
                                      {failure}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-6 pt-3">
                                    <button type="button" onClick={() => go(CONTACT - 1)} className="text-sm text-white/60 transition hover:text-white">
                                      Back
                                    </button>
                                    <button
                                      disabled={sending || sealing === CONTACT}
                                      aria-busy={sending}
                                      className={`ml-auto inline-flex min-w-44 items-center justify-center gap-3 rounded-full px-7 py-3.5 text-sm font-medium transition-[background-color,color,transform] duration-[var(--dur-change)] active:scale-[.98] ${
                                        sealing === CONTACT ? "bg-success text-ink" : sending ? "bg-brand-700 text-white/80" : "bg-brand text-white hover:bg-brand-700 active:bg-brand-800"
                                      }`}
                                    >
                                      {sealing === CONTACT ? (
                                        <>
                                          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                                            <motion.path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: T.change + 0.1 }} />
                                          </svg>
                                          Sent
                                        </>
                                      ) : sending ? (
                                        <>
                                          <Spinner />
                                          Sending
                                        </>
                                      ) : (
                                        <>
                                          Send my brief <Arrow className="h-4 w-4" />
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  )
                })}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
