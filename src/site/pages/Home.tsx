"use client"
import Services from "../components/Services"
import { About as AboutTeaser, Why } from "../components/sections"
import Hero from "../components/home/Hero"
import Counters from "../components/home/Counters"
import Projects from "../components/home/Projects"
import Partners from "../components/home/Partners"
import Testimonials from "../components/home/Testimonials"
import { useReady } from "../AppShell"

export default function Home() {
  const ready = useReady()
  return (
    <>
      <Hero ready={ready} />
      <AboutTeaser />
      <Services />
      <Counters />
      <Projects />
      <Why />
      <Partners />
      <Testimonials />
    </>
  )
}
