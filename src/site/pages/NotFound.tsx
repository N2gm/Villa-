"use client"
import { useRef } from "react"
import { Button } from "../components/ui"
import { gsap, useGSAP } from "../lib/gsap"
import { useReducedMotion } from "../motion"

/** 404: a floor plan draws itself, except one room that was never built. */
export default function NotFound() {
  const reduced = useReducedMotion()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (reduced) return
      const q = gsap.utils.selector(root)
      gsap
        .timeline({ defaults: { ease: "power2.inOut" } })
        .from(q("[data-wall]"), { drawSVG: "0%", duration: 1.4, stagger: 0.08 })
        .from(
          q("[data-door]"),
          { drawSVG: "0%", duration: 0.6, stagger: 0.1 },
          "-=0.6",
        )
        .from(
          q("[data-ghost]"),
          {
            opacity: 0,
            duration: 1.2,
            repeat: 1,
            yoyo: true,
            ease: "sine.inOut",
          },
          "-=0.2",
        )
        .from(
          q("[data-label]"),
          { opacity: 0, y: 6, duration: 0.6, stagger: 0.08 },
          "-=0.6",
        )
        .from(
          q("[data-copy]"),
          {
            opacity: 0,
            y: 24,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
          },
          "-=0.8",
        )
    },
    { scope: root, dependencies: [reduced] },
  )

  return (
    <section
      ref={root}
      className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-ink px-6 pb-20 pt-32 text-white"
    >
      <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
        <svg
          viewBox="0 0 400 300"
          className="w-full"
          role="img"
          aria-label="A floor plan with one room drawn only as a dashed outline"
        >
          <g
            fill="none"
            stroke="rgba(244,239,232,.85)"
            strokeWidth="2.5"
            strokeLinecap="square"
          >
            <path data-wall d="M20 20H250V140" />
            <path data-wall d="M20 20V280H250" />
            <path data-wall d="M130 20V110M130 150V280" />
            <path data-wall d="M20 170H95M115 170H130" />
            <path data-wall d="M130 140H190M215 140H250" />
          </g>
          <g fill="none" stroke="#C9A678" strokeWidth="1.2">
            <path data-door d="M95 170A20 20 0 0 1 115 150" />
            <path data-door d="M130 110A40 40 0 0 1 170 150" />
            <path data-door d="M190 140A25 25 0 0 0 215 115" />
          </g>
          <path
            data-ghost
            d="M250 140H380V280H250"
            fill="none"
            stroke="#C9A678"
            strokeWidth="1.5"
            strokeDasharray="5 6"
          />
          <g
            className="font-display"
            fontSize="9"
            letterSpacing="2"
            fill="rgba(244,239,232,.45)"
          >
            <text data-label x="40" y="80">
              LIVING
            </text>
            <text data-label x="150" y="80">
              KITCHEN
            </text>
            <text data-label x="40" y="230">
              BEDROOM
            </text>
            <text data-label x="160" y="220">
              BATH
            </text>
            <text data-label x="285" y="214" fill="#C9A678">
              404
            </text>
          </g>
        </svg>
        <div>
          <p data-copy className="text-sm font-medium text-gold">
            Error 404
          </p>
          <h1
            data-copy
            className="mt-6 text-5xl font-extralight leading-[1] tracking-tight md:text-7xl"
          >
            This room hasn't{" "}
            <span>been built yet.</span>
          </h1>
          <p data-copy className="mt-6 max-w-md text-white/60">
            The page you are looking for isn't on the plan. Let's take you
            somewhere finished.
          </p>
          <div data-copy className="mt-10 flex flex-wrap gap-4">
            <Button href="/" variant="light">
              Back to home
            </Button>
            <Button href="/portfolio" variant="outline">
              See our work
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
