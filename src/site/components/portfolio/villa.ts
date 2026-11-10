/** Shared geometry and camera maths for the portfolio villa walk. */

export const W = 4.2 // corridor width
export const H = 3.4 // ceiling height
export const DOOR_W = 1.3
export const DOOR_H = 2.75
export const SPACING = 6
export const ROOM_D = 6.5 // gallery room depth (along the corridor)
export const PANEL_GAP = 3.6
export const EYE = 1.6

export const doorZ = (k: number) => -4 - k * SPACING
export const doorSide = (k: number) => (k % 2 === 0 ? -1 : 1)
export const roomLength = (n: number) => 2.6 + (n - 1) * PANEL_GAP + 2.6
export const panelX = (i: number) => 2.6 + i * PANEL_GAP

/** Mutable state written by the DOM, read by the scene every frame. */
export type Rig = {
  corridor: number // 0..1 page progress through the corridor
  open: number // 0..1 door-opening sequence
  room: number // 0..n: 0 = entry, i = gallery panel i−1
}

export type Pose = { x: number; y: number; z: number; yaw: number }

const sstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export { sstep }

/** Turns continuous progress into travel-then-hold steps. */
export const stepped = (f: number) => {
  const i = Math.floor(f)
  return i + sstep(0.18, 0.82, f - i)
}

export const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  let d = b.yaw - a.yaw
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    yaw: a.yaw + d * t,
  }
}

/** Room-local → world. Local +x points from the door into the room. */
export function roomToWorld(k: number, p: Pose): Pose {
  const s = doorSide(k)
  const r = s === 1 ? 0 : Math.PI
  const c = Math.cos(r)
  const sn = Math.sin(r)
  return {
    x: (s * W) / 2 + p.x * c + p.z * sn,
    y: p.y,
    z: doorZ(k) - p.x * sn + p.z * c,
    yaw: r + p.yaw,
  }
}

/** Corridor camera for page progress p (0..1) across `n` doors. */
export function corridorPose(p: number, n: number, narrow: boolean) {
  const fe = stepped(Math.min(n - 1, Math.max(-1, p * n - 1)))
  const z = doorZ(0) + 3 - fe * SPACING
  const k = Math.min(n - 1, Math.max(0, Math.round(fe)))
  const hold = fe < -0.5 ? 0 : 1 - Math.min(1, Math.abs(fe - k) * 2)
  const glance = Math.atan2(W / 2, 3) * (narrow ? 0.95 : 0.62)
  const pose: Pose = { x: 0, y: EYE, z, yaw: -doorSide(k) * glance * hold }
  return { pose, near: fe < -0.5 ? -1 : k, hold }
}

export const doorFront = (k: number) => roomToWorld(k, { x: -2.5, y: EYE, z: 0, yaw: -Math.PI / 2 })
