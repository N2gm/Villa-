"use client"
import { useEffect, useRef, useState, type ReactNode, type ElementType, type ImgHTMLAttributes, type Ref, type SyntheticEvent } from 'react'
import { Link, useLocation } from '@/site/router'
import { useInView } from '../hooks'

export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: ElementType }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15)
  return <Tag ref={ref} className={`reveal ${inView ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>
}

export function SplitText({ text, className = '', delay = 0, stagger = 60, play }: { text: string; className?: string; delay?: number; stagger?: number; play?: boolean }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.3)
  const want = play ?? inView
  const [on, setOn] = useState(false)
  // Wait two frames after mount so the transition runs even when play is true immediately.
  useEffect(() => {
    if (!want) { setOn(false); return }
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [want])
  return (
    <span ref={ref} className={`${on ? 'in' : ''} ${className}`}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="mask-word">
          <span style={{ transitionDelay: `${delay + i * stagger}ms` }}>{w}&nbsp;</span>
        </span>
      ))}
    </span>
  )
}

/** Section label: a short phrase in the accent colour, set like body text. No rule, no capitals. */
export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <Reveal className={`text-sm font-medium ${light ? 'text-gold' : 'text-brand'}`}>{children}</Reveal>
}

/** Fills per variant while a request is in flight (a step past hover, never the pressed look). */
type ButtonVariant = 'solid' | 'outline' | 'light'
const idle: Record<ButtonVariant, string> = {
  solid: 'bg-brand text-white hover:bg-brand-700 active:bg-brand-800 active:scale-[.98]',
  light: 'bg-white text-ink hover:bg-sand active:bg-sand-200 active:scale-[.98]',
  outline: 'border border-current text-current hover:bg-current/10 active:scale-[.98]',
}
const busy: Record<ButtonVariant, string> = {
  solid: 'cursor-progress bg-brand-700 text-white/80',
  light: 'cursor-progress bg-sand text-ink/60',
  outline: 'cursor-progress border border-current bg-current/10 text-current/60',
}
const buttonBase = 'group inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 text-sm font-medium transition-[background-color,color,transform] duration-[var(--dur-change)] ease-[var(--ease-standard)]'

/**
 * Pill link button. Hover darkens the fill, press sinks it slightly; the arrow nudges forward.
 * Loading (all three variants): the label swaps for a turning arc and a verb, the width holds.
 * A link button enters it by itself while the page transition carries the visitor away.
 */
export function Button({ children, href = '#', variant = 'solid', className = '', loading = false, loadingLabel = 'Loading' }: { children: ReactNode; href?: string; variant?: ButtonVariant; className?: string; loading?: boolean; loadingLabel?: string }) {
  const { pathname } = useLocation()
  const [leaving, setLeaving] = useState(false)
  // PageTransition announces the link it intercepted; this button shows it is the one in flight.
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail === href) setLeaving(true) }
    addEventListener('bonyan:navigating', on)
    return () => removeEventListener('bonyan:navigating', on)
  }, [href])
  useEffect(() => setLeaving(false), [pathname])
  const wait = loading || leaving
  // The width it had at rest is held while it waits, so the label swap never shifts the layout.
  const el = useRef<HTMLAnchorElement>(null)
  const rest = useRef(0)
  if (!wait && el.current) rest.current = el.current.offsetWidth
  return (
    <Link
      to={href}
      ref={el}
      style={wait && rest.current ? { minWidth: rest.current } : undefined}
      aria-busy={wait || undefined}
      aria-disabled={wait || undefined}
      tabIndex={wait ? -1 : undefined}
      className={`${buttonBase} ${wait ? `pointer-events-none ${busy[variant]}` : idle[variant]} ${className}`}
    >
      {wait ? (
        <>
          <Spinner />
          {loadingLabel}
        </>
      ) : (
        <>
          {children}
          <Arrow className="h-4 w-4 transition-transform duration-[var(--dur-change)] group-hover:translate-x-1" />
        </>
      )}
    </Link>
  )
}

export function Arrow({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 16 16" fill="none" className={className}><path d="M2 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}


/** onLoad for `.img-load` media: fades it in and lets the parent `.skeleton` stop. */
export const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.loaded = ''
}

/** In-flight indicator: a quarter arc on a faint track, in the current text colour. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`spinner ${className}`}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.5" />
      <path d="M8 1.75A6.25 6.25 0 0 1 14.25 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Form submit button with a loading state. The label swaps for a spinner and
 * a progressive verb; the width holds so nothing shifts around it.
 */
export function SubmitButton({ children, loading = false, loadingLabel = 'Sending', variant = 'solid', className = '' }: { children: ReactNode; loading?: boolean; loadingLabel?: string; variant?: ButtonVariant; className?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className={`${buttonBase} min-w-44 ${loading ? busy[variant] : idle[variant]} ${className}`}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel}
        </>
      ) : (
        <>
          {children}
          <Arrow className="h-4 w-4 transition-transform duration-[var(--dur-change)] group-hover:translate-x-1" />
        </>
      )}
    </button>
  )
}

/**
 * Content image with a real skeleton: a sheen sits over the parent (which must be
 * positioned) until the browser reports the file decoded, then the photograph fades in.
 * Cached images are caught too, and a failed file leaves a still block, never a broken icon.
 */
export function LoadImg({ dark = false, ref, onLoad, className = '', style, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { dark?: boolean; ref?: Ref<HTMLImageElement> }) {
  const el = useRef<HTMLImageElement | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    setState('loading')
    const i = el.current
    if (i?.complete) setState(i.naturalWidth ? 'ready' : 'error')
  }, [rest.src])
  const ready = state === 'ready'
  return (
    <>
      <img
        {...rest}
        ref={(n) => {
          el.current = n
          if (typeof ref === 'function') ref(n)
          else if (ref) ref.current = n
        }}
        onLoad={(e) => { setState('ready'); onLoad?.(e) }}
        onError={() => setState('error')}
        className={`${className} ${ready ? 'img-in' : ''}`}
        style={ready ? style : { ...style, opacity: 0 }}
      />
      <span aria-hidden="true" data-ready={ready ? '' : undefined} data-error={state === 'error' ? '' : undefined} className={`skeleton ${dark ? 'skeleton-dark' : ''} pointer-events-none absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-0' : ''}`} />
    </>
  )
}


/**
 * A text field with a label that is always visible above it (never only a placeholder).
 * The label warms to gold while the field has focus. Pair `htmlFor` with the control's id.
 */
export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="group/field">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-white/60 transition-colors duration-[var(--dur-change)] group-focus-within/field:text-gold">
        {label}
      </label>
      {children}
    </div>
  )
}
