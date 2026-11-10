import { useEffect, useRef, useState } from 'react'

export { clamp, useScrollFrame } from './motion'

/** Tracks visibility both ways by default, so reveals reverse when scrolled back out. */
export function useInView<T extends Element>(threshold = 0.2, once = false) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (once) io.disconnect() }
      else if (!once) setInView(false)
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, once])
  return [ref, inView] as const
}
