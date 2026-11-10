"use client"
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import PageTransition from "./components/PageTransition"
import { Footer, Header, Preloader, WhatsApp } from "./components/sections"
import SmoothScroll from "./lib/SmoothScroll"
import { scrollToTarget } from "./lib/scroll"
import { ScrollTrigger } from "./lib/gsap"
import { useLocation } from "./router"

const ReadyContext = createContext(false)
/** True once the preloader has finished and the page may play its intro. */
export const useReady = () => useContext(ReadyContext)

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    scrollToTarget(0, { immediate: true })
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [pathname])
  return null
}

/** Site chrome shared by every route; the preloader only overlays it, so pages never remount when it leaves. */
export default function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [preloaderDone, setPreloaderDone] = useState(false)
  const done = useCallback(() => setReady(true), [])
  const preloaderExit = useCallback(() => setPreloaderDone(true), [])

  return (
    <ReadyContext.Provider value={ready}>
      <SmoothScroll />
      <ScrollTop />
      {!preloaderDone && <Preloader onDone={done} onExit={preloaderExit} />}
      <PageTransition>
        <Header ready={ready} />
        <main>{children}</main>
        <Footer />
        <WhatsApp />
      </PageTransition>
    </ReadyContext.Provider>
  )
}
