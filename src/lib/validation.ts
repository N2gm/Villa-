/** Validation shared by the browser (instant feedback) and the server (the source of truth). */
export type ContactInput = { name: string; phone: string; email: string; message: string }
export type FieldErrors<K extends string> = Partial<Record<K, string>>

export const normPhone = (p: string) => p.replace(/[\s-]/g, "")
export const isEgyptMobile = (p: string) => /^(\+?20|0)?1[0125]\d{8}$/.test(normPhone(p))
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

export function validateContact(d: { name: string; phone: string; email: string }) {
  const e: FieldErrors<"name" | "phone" | "email"> = {}
  if (d.name.trim().length < 2) e.name = "Enter your full name."
  if (!normPhone(d.phone)) e.phone = "Enter a phone number we can call."
  else if (!isEgyptMobile(d.phone)) e.phone = "Use an Egyptian mobile number, like 010 1234 5678."
  if (d.email.trim() && !isEmail(d.email)) e.email = "Check the email address."
  return e
}
