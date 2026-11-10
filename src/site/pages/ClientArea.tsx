"use client"
import { useState } from "react"
import { Field, SubmitButton } from "../components/ui"
import { Vault } from "@lucasmarkes/hairline/react"
import { contact } from "../data"
import { useReducedMotion } from "../motion"

// What a signed-in client finds behind the door.
const inside = [
  { t: "Site photos", d: "Fresh shots from the engineer, every visit." },
  { t: "Stage reports", d: "What was done, what's next, and when." },
  { t: "Cost ledger", d: "Every payment and invoice, line by line." },
] as const

/** Client Area: sign-in on one side, a live-tracker preview on the other with layered cursor parallax. */
export default function ClientArea() {
  const reduced = useReducedMotion()
  const [error, setError] = useState("")
  const [signing, setSigning] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [dial, setDial] = useState("")

  const field =
    "field w-full border-b border-white/15 bg-transparent py-3 text-white outline-none transition-colors duration-[var(--dur-change)] placeholder:text-white/45 focus:border-gold"
  return (
    <section className="grid min-h-[100svh] lg:grid-cols-2">
      <div className="flex items-center bg-ink px-6 text-white pb-20 pt-36 lg:px-16">
        <div className="w-full max-w-md">
          <p className="text-sm font-medium text-gold">
            Client Area
          </p>
          <h1 className="mt-6 text-5xl font-extralight leading-[1] tracking-tight md:text-7xl">
            Your project, <span>live.</span>
          </h1>
          <p className="mt-6 leading-relaxed text-white/60">
            Follow every stage with site photos, engineer reports and a
            transparent cost ledger.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (signing) return
              setSigning(true)
              setError("")
              try {
                // TODO: wire to your authentication backend
                console.log("[Client login]", { email })
                setError("Client login is not yet configured. Contact your project manager.")
              } catch {
                setError("We couldn't reach the studio. Check your connection and try again.")
              }
              setSigning(false)
            }}
            className="mt-10 space-y-6"
          >
            <Field label="Email" htmlFor="client-email">
              <input
                id="client-email"
                required
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                className={field}
              />
            </Field>
            <Field label="Password" htmlFor="client-password">
              <input
                id="client-password"
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                className={field}
              />
            </Field>
            <SubmitButton loading={signing} loadingLabel="Signing in" className="w-full">Sign in</SubmitButton>
          </form>
          {error && (
            <p role="alert" className="panel-in mt-6 flex items-center gap-2 text-sm text-error-300">
              {error}
            </p>
          )}
          <p className="mt-6 text-sm text-white/60">
            Client accounts are issued by your project manager. Need access? Call{" "}
            <a href={`tel:${contact.phone}`} className="text-gold">
              {contact.phone}
            </a>
            .
          </p>
        </div>
      </div>

      <div className="relative flex items-center overflow-hidden bg-[#0f1214] px-6 pb-20 pt-16 text-white lg:border-l lg:border-white/10 lg:px-16 lg:pt-36">
        <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto w-full max-w-lg">
          <p className="text-sm font-medium text-gold">Private by design</p>
          <h2 className="mt-4 text-3xl font-light leading-tight md:text-4xl">
            Your project sits <span>behind one door.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Only you and your project team hold the combination.{" "}
            {reduced ? "" : "Turn the dial to try it."}
          </p>

          {/* Hairline's vault: the pointer turns the dial and the bolts draw back on the combination. */}
          <div
            className="relative mt-6"
            style={{
              ["--hairline-plate" as string]: "#0f1214",
              ["--hairline-hi" as string]: "var(--color-gold)",
              ["--hairline-edge" as string]: "rgba(244,239,232,.85)",
              ["--hairline-mid" as string]: "rgba(244,239,232,.45)",
              ["--hairline-lo" as string]: "rgba(244,239,232,.18)",
            }}
          >
            <Vault theme="dark" intensity={0.6} play={!reduced} onRead={(t) => setDial(/\d/.test(t) ? t : "")} aria-label="A vault door with a combination dial and three bolts" />
            {dial && (
              <span aria-hidden="true" className="absolute bottom-2 right-2 font-display text-xs tabular-nums text-white/50">
                {dial}
              </span>
            )}
          </div>

          <ul className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
            {inside.map((x) => (
              <li key={x.t} className="bg-[#0f1214] p-4">
                <span className="block text-sm text-white">{x.t}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/50">{x.d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
