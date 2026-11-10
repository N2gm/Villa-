
import { quoteOptions } from "@/lib/quote-options"
import { validateContact, type FieldErrors } from "@/lib/validation"

export type SubmitResult =
  | { ok: true }
  | { ok: false; errors?: FieldErrors<string>; message?: string }

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const FAILED = "We couldn't send that just now. Please try again, or call us on 01028993311."

export async function submitContact(input: unknown): Promise<SubmitResult> {
  const raw = (input ?? {}) as Record<string, unknown>
  const data = { name: str(raw.name, 120), phone: str(raw.phone, 30), email: str(raw.email, 200), message: str(raw.message, 4000) }
  const errors = validateContact(data)
  if (Object.keys(errors).length) return { ok: false, errors }
  try {
    // TODO: wire to your preferred backend (e.g. email API, database, etc.)
    console.log("[Contact form]", data)
    return { ok: true }
  } catch (err) {
    console.error("submitContact failed", err)
    return { ok: false, message: FAILED }
  }
}

const one = (v: unknown, allowed: readonly string[]) => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === "string" && allowed.includes(x) ? x : null
}

export async function submitQuote(input: unknown): Promise<SubmitResult> {
  const raw = (input ?? {}) as Record<string, unknown>
  const answers = (raw.answers ?? {}) as Record<string, unknown>
  const details = (raw.details ?? {}) as Record<string, unknown>
  const projectType = one(answers.type, quoteOptions.type)
  const size = one(answers.size, quoteOptions.size)
  const timing = one(answers.when, quoteOptions.when)
  const services = Array.isArray(answers.services)
    ? [...new Set(answers.services.filter((s): s is (typeof quoteOptions.services)[number] => quoteOptions.services.includes(s)))]
    : []
  if (!projectType || !size || !timing || !services.length) {
    return { ok: false, message: "Some answers are missing. Go back through the brief and try again." }
  }
  const d = { name: str(details.name, 120), phone: str(details.phone, 30), email: str(details.email, 200), note: str(details.note, 4000) }
  const errors = validateContact(d)
  if (Object.keys(errors).length) return { ok: false, errors }
  try {
    // TODO: wire to your preferred backend (e.g. email API, database, etc.)
    console.log("[Quote request]", { projectType, size, timing, services, ...d })
    return { ok: true }
  } catch (err) {
    console.error("submitQuote failed", err)
    return { ok: false, message: FAILED }
  }
}
