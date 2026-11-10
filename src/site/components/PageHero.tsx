"use client"
import { useRef } from 'react'
import { Link } from '@/site/router'
import { clamp, useScrollFrame } from '../hooks'
import { LoadImg, SplitText } from './ui'

export default function PageHero({ title, sub, img, crumb }: { title: string; sub: string; img: string; crumb: string }) {
  const bg = useRef<HTMLImageElement>(null)
  useScrollFrame(() => {
    const p = clamp(scrollY / innerHeight)
    if (bg.current) bg.current.style.transform = `translateY(${p * 25}%) scale(${1.1 + p * 0.1})`
  })
  return (
    <section className="relative flex h-[75svh] min-h-[520px] items-end overflow-hidden bg-ink text-white">
      <LoadImg dark ref={bg} src={img} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
      <div className="relative mx-auto w-full max-w-7xl px-6 pb-20">
        <p className="mb-6 text-xs text-white/60"><Link to="/" className="hover:text-gold">Home</Link> <span className="mx-2 text-gold">/</span> {crumb}</p>
        <h1 className="text-6xl font-extralight leading-[0.95] tracking-tight md:text-9xl"><SplitText text={title} play stagger={90} /></h1>
        <p className="mt-8 max-w-xl text-lg text-white/70"><SplitText text={sub} play delay={400} stagger={25} /></p>
      </div>
    </section>
  )
}
