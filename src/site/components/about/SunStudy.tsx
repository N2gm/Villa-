"use client"
import { Hairline } from "../../hairline/Hairline"
import { sunEngine } from "../../hairline/sun"
import { FINE_POINTER, useMedia } from "../../motion"
import { Eyebrow, Reveal, SplitText } from "../ui"

const notes = [
  {
    k: "30.04° N",
    t: "Cairo, measured",
    d: "Every layout is checked against the real path of the sun over Cairo, from the June high to the low December arc.",
  },
  {
    k: "West & south",
    t: "Shade where it counts",
    d: "Deep reveals, pergolas and planting are placed where the afternoon sun is harshest, so rooms stay cool without closing the curtains.",
  },
  {
    k: "Morning light",
    t: "Rooms in the right order",
    d: "Bedrooms and kitchens face the gentle east light; living spaces get the long, warm hours of the day.",
  },
]

/** About: an interactive Cairo sun study. Pointer x scrubs the time of day, pointer y the season. */
export default function SunStudy() {
  const fine = useMedia(FINE_POINTER)
  return (
    <section
      aria-labelledby="sun-title"
      className="relative overflow-hidden bg-white py-32 md:py-44"
    >
      <div className="blueprint-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow>Designed around light</Eyebrow>
          <h2
            id="sun-title"
            className="mt-6 text-5xl font-light leading-[1.05] tracking-tight md:text-6xl"
          >
            <SplitText text="We draw the sun" />{" "}
            <SplitText
              text="before the walls."
              delay={250}
            />
          </h2>
          <Reveal delay={150}>
            <p className="mt-8 max-w-md leading-relaxed text-mute">
              In Cairo, light is a gift and heat is a design problem. Before a
              plan is final we study where every shadow will fall, through every
              hour and season.
            </p>
          </Reveal>
          <ul className="mt-10">
            {notes.map((n, k) => (
              <Reveal
                key={n.t}
                delay={200 + k * 100}
                as="li"
                className="grid grid-cols-[7.5rem_1fr] gap-6 border-t border-ink/10 py-5"
              >
                <span className="font-display text-xs text-brand">
                  {n.k}
                </span>
                <span>
                  <span className="block text-lg font-light">{n.t}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-mute">
                    {n.d}
                  </span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-7">
          <Hairline
            engine={sunEngine}
            play
            label="Interactive sun study of a courtyard house in Cairo. The sun moves across the sky through the day and the building's shadows turn with it. Move the pointer sideways to change the time and up or down to change the season; hold and drag to turn the model and see it from every side."
            className="mx-auto max-w-[640px]"
            caption={(t) => (
              <>
                <span className="pointer-events-none absolute left-0 top-0 font-display text-xs text-brand tabular-nums">
                  {t}
                </span>
              </>
            )}
          />
        </div>
      </div>
    </section>
  )
}
