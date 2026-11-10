"use client"
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Figure, HairlineOptions } from '@lucasmarkes/hairline'
import type { FigureEls } from './kernel'

export type Engine<F extends Figure> = (els: FigureEls, options: HairlineOptions) => F

type Props<F extends Figure> = HairlineOptions & {
  /** A module-level engine; a new function identity rebuilds the figure. */
  engine: Engine<F>
  onFigure?: (figure: F | null) => void
  className?: string
  /** Renders the live caption inside the stage. */
  caption?: (text: string) => ReactNode
}

/** Mounts a line figure in a 5:4 stage, the way Hairline's own React wrapper does. */
export function Hairline<F extends Figure>({ engine, onFigure, className = '', caption, intensity, theme = 'auto', label, onRead, play }: Props<F>) {
  const stage = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const figure = useRef<F | null>(null)
  const cbs = useRef({ onFigure, onRead })
  cbs.current = { onFigure, onRead }
  const [text, setText] = useState('')
  const opts = useRef<HairlineOptions>({ intensity, play })
  opts.current = { intensity, play }

  useEffect(() => {
    const f = engine({ stage: stage.current!, svg: svg.current!, read: (t) => { setText(t); cbs.current.onRead?.(t) } }, opts.current)
    figure.current = f
    cbs.current.onFigure?.(f)
    return () => {
      cbs.current.onFigure?.(null)
      figure.current = null
      f.destroy()
    }
  }, [engine])

  useEffect(() => { figure.current?.update({ intensity, play }) }, [intensity, play])

  return (
    <div ref={stage} data-hl={theme} role="img" aria-label={label} className={`relative aspect-[5/4] w-full touch-pan-y select-none ${className}`}>
      <svg ref={svg} viewBox="0 0 400 320" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full overflow-visible" />
      {caption?.(text)}
    </div>
  )
}
