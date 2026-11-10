"use client"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import {
  DOOR_H,
  DOOR_W,
  EYE,
  H,
  PANEL_GAP,
  ROOM_D,
  SPACING,
  W,
  corridorPose,
  doorFront,
  doorSide,
  doorZ,
  lerpPose,
  panelX,
  roomLength,
  roomToWorld,
  sstep,
  stepped,
  type Pose,
  type Rig,
} from "./villa"

/* ── Procedural surfaces ─────────────────────────────────────────────── */

function canvasTexture(draw: (g: CanvasRenderingContext2D, rnd: () => number) => void, repeat: [number, number], seed = 11) {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  draw(g, rnd)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  return t
}

/** Large-format travertine tiles with fine joints. */
const travertine = (g: CanvasRenderingContext2D, rnd: () => number) => {
  g.fillStyle = "#d8c8ad"
  g.fillRect(0, 0, 512, 512)
  for (let y = 0; y < 512; y += 2) {
    g.fillStyle = `rgba(140,110,78,${rnd() * 0.09})`
    g.fillRect(0, y, 512, 1 + rnd() * 2)
  }
  for (let k = 0; k < 260; k++) {
    g.fillStyle = `rgba(125,98,68,${0.15 + rnd() * 0.3})`
    g.beginPath()
    g.ellipse(rnd() * 512, rnd() * 512, 1 + rnd() * 5, 0.4 + rnd(), 0, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = "rgba(90,70,50,0.35)"
  g.lineWidth = 2
  g.strokeRect(1, 1, 510, 510)
  g.beginPath()
  g.moveTo(256, 0)
  g.lineTo(256, 512)
  g.stroke()
}

/** Rift-cut walnut veneer, vertical grain. */
const walnut = (g: CanvasRenderingContext2D, rnd: () => number) => {
  g.fillStyle = "#4a3324"
  g.fillRect(0, 0, 512, 512)
  for (let x = 0; x < 512; x += 1 + rnd() * 3) {
    g.fillStyle = rnd() > 0.5 ? `rgba(30,18,10,${rnd() * 0.35})` : `rgba(150,105,70,${rnd() * 0.18})`
    g.fillRect(x, 0, 1 + rnd() * 2, 512)
  }
}

/** Dark smoked oak boards for the gallery rooms. */
const oak = (g: CanvasRenderingContext2D, rnd: () => number) => {
  g.fillStyle = "#2a2019"
  g.fillRect(0, 0, 512, 512)
  for (let b = 0; b < 8; b++) {
    const y = b * 64
    g.fillStyle = `rgba(${60 + rnd() * 30},${44 + rnd() * 20},${30 + rnd() * 14},0.6)`
    g.fillRect(0, y, 512, 63)
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(15,10,6,${rnd() * 0.25})`
      g.fillRect(0, y + rnd() * 63, 512, 1)
    }
    g.fillStyle = "rgba(0,0,0,0.6)"
    g.fillRect(0, y + 63, 512, 1)
  }
}

function useMaterials(roomLen: number) {
  return useMemo(() => {
    const corridorLen = 50
    return {
      floor: new THREE.MeshStandardMaterial({ map: canvasTexture(travertine, [W / 2.4, corridorLen / 2.4], 7), roughness: 0.42 }),
      wall: new THREE.MeshStandardMaterial({ color: "#e8e0d3", roughness: 0.92 }),
      ceiling: new THREE.MeshStandardMaterial({ color: "#efe9e0", roughness: 0.95 }),
      bronze: new THREE.MeshStandardMaterial({ color: "#3b2f25", roughness: 0.4, metalness: 0.7 }),
      brass: new THREE.MeshStandardMaterial({ color: "#c9a678", roughness: 0.3, metalness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({ map: canvasTexture(walnut, [1, 1], 3), roughness: 0.55 }),
      glow: new THREE.MeshStandardMaterial({ color: "#fff1dc", emissive: "#ffd9a8", emissiveIntensity: 2.2, toneMapped: false }),
      softGlow: new THREE.MeshStandardMaterial({ color: "#3a2f24", emissive: "#c99a68", emissiveIntensity: 0.55 }),
      roomFloor: new THREE.MeshStandardMaterial({ map: canvasTexture(oak, [roomLen / 3, ROOM_D / 3], 5), roughness: 0.5 }),
      roomWall: new THREE.MeshStandardMaterial({ color: "#3a332d", roughness: 0.95 }),
      roomCeil: new THREE.MeshStandardMaterial({ color: "#211d1a", roughness: 1 }),
      frame: new THREE.MeshStandardMaterial({ color: "#16130f", roughness: 0.5, metalness: 0.3 }),
    }
  }, [roomLen])
}
type Mats = ReturnType<typeof useMaterials>

/** Neutral linen tone shown until (or instead of) a photograph. */
const placeholder = (() => {
  const t = new THREE.DataTexture(new Uint8Array([58, 52, 46, 255]), 1, 1)
  t.needsUpdate = true
  return t
})()
const cache = new Map<string, Promise<THREE.Texture>>()
const loader = new THREE.TextureLoader()
loader.setCrossOrigin("anonymous")
const load = (url: string) => {
  let p = cache.get(url)
  if (!p) {
    p = new Promise((res) =>
      loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = 8
          res(t)
        },
        undefined,
        () => res(placeholder),
      ),
    )
    cache.set(url, p)
  }
  return p
}

/** Non-suspending texture list: a failed photo never takes the scene down. */
function usePhotos(urls: string[]) {
  const key = urls.join("|")
  const [tex, setTex] = useState<THREE.Texture[]>(() => urls.map(() => placeholder))
  useEffect(() => {
    let live = true
    setTex(urls.map(() => placeholder))
    urls.forEach((u, i) =>
      load(u).then((t) => {
        if (live) setTex((prev) => prev.map((x, j) => (j === i ? t : x)))
      }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return tex
}
const aspectOf = (t: THREE.Texture) => {
  const im = t.image as { width?: number; height?: number } | undefined
  return t !== placeholder && im?.width && im?.height ? im.width / im.height : 1.5
}

/* ── Corridor ────────────────────────────────────────────────────────── */

function Corridor({ n, m }: { n: number; m: Mats }) {
  const zStart = 8
  const zEnd = doorZ(n - 1) - SPACING
  const len = zStart - zEnd
  const mid = (zStart + zEnd) / 2

  // Side walls as segments, leaving an opening at each door.
  const walls = useMemo(() => {
    const out: { x: number; y: number; z: number; d: number; h: number }[] = []
    for (const s of [-1, 1]) {
      const holes = Array.from({ length: n }, (_, k) => k)
        .filter((k) => doorSide(k) === s)
        .map((k) => doorZ(k))
        .sort((a, b) => b - a)
      let from = zStart
      for (const z of holes) {
        const a = z + DOOR_W / 2 + 0.08
        out.push({ x: (s * W) / 2, y: H / 2, z: (from + a) / 2, d: from - a, h: H })
        out.push({ x: (s * W) / 2, y: (DOOR_H + 0.08 + H) / 2, z, d: DOOR_W + 0.16, h: H - DOOR_H - 0.08 })
        from = z - DOOR_W / 2 - 0.08
      }
      out.push({ x: (s * W) / 2, y: H / 2, z: (from + zEnd) / 2, d: from - zEnd, h: H })
    }
    return out
  }, [n, zEnd])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, mid]} material={m.floor}>
        <planeGeometry args={[W, len]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, mid]} material={m.ceiling}>
        <planeGeometry args={[W, len]} />
      </mesh>
      {walls.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, w.z]} material={m.wall}>
          <boxGeometry args={[0.2, w.h, w.d]} />
        </mesh>
      ))}
      {/* Cove light lines along the ceiling and bronze skirting */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (W / 2 - 0.35), H - 0.01, mid]} material={m.glow}>
            <boxGeometry args={[0.05, 0.01, len]} />
          </mesh>
          <mesh position={[s * (W / 2 - 0.11), 0.05, mid]} material={m.bronze}>
            <boxGeometry args={[0.02, 0.1, len]} />
          </mesh>
        </group>
      ))}
      {/* End wall: a lit vertical slot draws the eye down the corridor */}
      <mesh position={[0, H / 2, zEnd]} material={m.wall}>
        <boxGeometry args={[W, H, 0.2]} />
      </mesh>
      <mesh position={[0, H / 2, zEnd + 0.11]} material={m.glow}>
        <boxGeometry args={[0.08, H - 0.6, 0.01]} />
      </mesh>
      <pointLight position={[0, 2, zEnd + 1]} intensity={4} distance={8} decay={2} color="#ffd9a8" />
      <mesh position={[0, H / 2, zStart]} rotation-y={Math.PI} material={m.wall}>
        <planeGeometry args={[W, H]} />
      </mesh>
    </group>
  )
}

function Door({
  k,
  cover,
  m,
  rig,
  isActive,
  near,
  onOpen,
}: {
  k: number
  cover: THREE.Texture
  m: Mats
  rig: React.RefObject<Rig>
  isActive: boolean
  near: React.RefObject<number>
  onOpen: (k: number) => void
}) {
  const s = doorSide(k)
  const z = doorZ(k)
  const x = (s * W) / 2
  const leaf = useRef<THREE.Group>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const glow = useRef(0)
  const a = aspectOf(cover)
  const pw = 0.9
  const ph = Math.min(1.25, pw / a)
  const pwFit = ph * a < pw ? ph * a : pw

  useFrame((_, dt) => {
    const open = isActive ? sstep(0.3, 0.7, rig.current?.open ?? 0) : 0
    if (leaf.current) leaf.current.rotation.y = -s * 1.75 * open
    glow.current += ((near.current === k ? 1 : 0) - glow.current) * (1 - Math.exp(-dt * 4))
    if (lamp.current) lamp.current.intensity = 3 + glow.current * 5
  })

  const [hover, setHover] = useState(false)
  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : ""
    return () => {
      document.body.style.cursor = ""
    }
  }, [hover])

  // Leaf hangs from the hinge at z + DOOR_W/2 and swings into the room.
  return (
    <group>
      {/* Bronze frame */}
      <mesh position={[x, DOOR_H + 0.04, z]} material={m.bronze}>
        <boxGeometry args={[0.26, 0.08, DOOR_W + 0.16]} />
      </mesh>
      {[-1, 1].map((e) => (
        <mesh key={e} position={[x, DOOR_H / 2, z + e * (DOOR_W / 2 + 0.04)]} material={m.bronze}>
          <boxGeometry args={[0.26, DOOR_H, 0.08]} />
        </mesh>
      ))}
      <group ref={leaf} position={[x, 0, z + DOOR_W / 2]}>
        <group
          position={[0, 0, -DOOR_W / 2]}
          onClick={(e) => {
            e.stopPropagation()
            if ((rig.current?.open ?? 0) === 0) onOpen(k)
          }}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <mesh position={[0, DOOR_H / 2, 0]} material={m.leaf}>
            <boxGeometry args={[0.06, DOOR_H, DOOR_W]} />
          </mesh>
          {/* The project photograph, framed and hung on the leaf */}
          <group position={[-s * 0.035, 1.62, 0]} rotation-y={-s * (Math.PI / 2)}>
            <mesh position={[0, 0, 0]} material={m.frame}>
              <boxGeometry args={[pwFit + 0.08, ph + 0.08, 0.025]} />
            </mesh>
            <mesh position={[0, 0, 0.014]}>
              <planeGeometry args={[pwFit, ph]} />
              <meshStandardMaterial map={cover} roughness={0.55} emissive="#ffffff" emissiveMap={cover} emissiveIntensity={0.25} />
            </mesh>
            {/* Brass number plaque */}
            <mesh position={[0, -ph / 2 - 0.16, 0]} material={m.brass}>
              <boxGeometry args={[0.22, 0.05, 0.01]} />
            </mesh>
          </group>
          {/* Long brass pull on the free edge */}
          <mesh position={[-s * 0.07, 1.1, -DOOR_W / 2 + 0.12]} material={m.brass}>
            <boxGeometry args={[0.025, 0.9, 0.025]} />
          </mesh>
        </group>
      </group>
      {/* Linear wall light above each door */}
      <mesh position={[x - s * 0.11, DOOR_H + 0.3, z]} material={m.glow}>
        <boxGeometry args={[0.02, 0.03, DOOR_W]} />
      </mesh>
      <pointLight ref={lamp} position={[x - s * 0.7, DOOR_H + 0.2, z]} distance={7} decay={2} color="#ffd6a0" />
    </group>
  )
}

/* ── Gallery room behind the active door ─────────────────────────────── */

/** Camera distance and offset that frame a panel, leaving space for captions. */
function panelView(i: number, w: number, h: number, aspect: number, tanH: number): Pose {
  const wide = aspect >= 1
  const fitW = w / ((wide ? 0.52 : 0.86) * 2 * tanH * aspect)
  const fitH = h / ((wide ? 0.68 : 0.46) * 2 * tanH)
  const dist = Math.min(ROOM_D - 0.5, Math.max(fitW, fitH))
  const xShift = wide ? -0.24 * dist * tanH * aspect : 0
  const yShift = wide ? 0 : -0.32 * dist * tanH
  return { x: panelX(i) + xShift, y: 1.7 + yShift, z: -ROOM_D / 2 + dist, yaw: 0 }
}

export const panelSize = (a: number) => {
  const w = a >= 1 ? 2.6 : 2.0 * a
  return { w, h: w / a }
}

function Room({ k, srcs, m, views }: { k: number; srcs: string[]; m: Mats; views: React.RefObject<{ w: number; h: number }[]> }) {
  const tex = usePhotos(srcs)
  const n = srcs.length
  const L = roomLength(n)
  const s = doorSide(k)
  const sizes = tex.map((t) => panelSize(aspectOf(t)))
  views.current = sizes
  const targets = useMemo(() => sizes.map(() => new THREE.Object3D()), [n])

  return (
    <group position={[(s * W) / 2, 0, doorZ(k)]} rotation-y={s === 1 ? 0 : Math.PI}>
      <mesh rotation-x={-Math.PI / 2} position={[L / 2, 0.001, 0]} material={m.roomFloor}>
        <planeGeometry args={[L, ROOM_D]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[L / 2, H, 0]} material={m.roomCeil}>
        <planeGeometry args={[L, ROOM_D]} />
      </mesh>
      <mesh position={[L / 2, H / 2, -ROOM_D / 2]} material={m.roomWall}>
        <planeGeometry args={[L, H]} />
      </mesh>
      <mesh position={[L / 2, H / 2, ROOM_D / 2]} rotation-y={Math.PI} material={m.roomWall}>
        <planeGeometry args={[L, H]} />
      </mesh>
      <mesh position={[L, H / 2, 0]} rotation-y={-Math.PI / 2} material={m.roomWall}>
        <planeGeometry args={[ROOM_D, H]} />
      </mesh>
      {/* Inner face of the door wall, so the pale corridor never shows inside */}
      {[-1, 1].map((e) => (
        <mesh
          key={e}
          position={[0.11, H / 2, e * (ROOM_D / 4 + DOOR_W / 4 + 0.04)]}
          rotation-y={Math.PI / 2}
          material={m.roomWall}
        >
          <planeGeometry args={[ROOM_D / 2 - DOOR_W / 2 - 0.08, H]} />
        </mesh>
      ))}
      <mesh position={[0.11, (DOOR_H + 0.08 + H) / 2, 0]} rotation-y={Math.PI / 2} material={m.roomWall}>
        <planeGeometry args={[DOOR_W + 0.16, H - DOOR_H - 0.08]} />
      </mesh>
      {/* A soft light slot on the opposite wall, and a bench to pause on */}
      <mesh position={[L / 2, H - 0.25, ROOM_D / 2 - 0.01]} material={m.softGlow}>
        <boxGeometry args={[L - 1.2, 0.02, 0.01]} />
      </mesh>
      <mesh position={[L / 2, 0.22, ROOM_D / 2 - 0.5]} material={m.bronze}>
        <boxGeometry args={[Math.max(2, L - 4), 0.44, 0.5]} />
      </mesh>
      <ambientLight intensity={0.45} color="#ffe8cc" />
      <pointLight position={[1.4, H - 0.3, 0]} intensity={4} distance={7} decay={2} color="#ffd6a0" />
      <pointLight position={[L * 0.6, H - 0.4, ROOM_D / 4]} intensity={5} distance={L} decay={2} color="#ffd6a0" />
      {tex.map((t, i) => {
        const { w, h } = sizes[i]
        const x = panelX(i)
        return (
          <group key={i}>
            <mesh position={[x, 1.7, -ROOM_D / 2 + 0.03]} material={m.frame}>
              <boxGeometry args={[w + 0.14, h + 0.14, 0.05]} />
            </mesh>
            <mesh position={[x, 1.7, -ROOM_D / 2 + 0.058]}>
              <planeGeometry args={[w, h]} />
              <meshStandardMaterial map={t} roughness={0.6} emissive="#ffffff" emissiveMap={t} emissiveIntensity={0.32} />
            </mesh>
            {/* Brass picture light */}
            <mesh position={[x, 1.7 + h / 2 + 0.2, -ROOM_D / 2 + 0.14]} material={m.brass}>
              <boxGeometry args={[Math.min(w * 0.5, 1), 0.04, 0.06]} />
            </mesh>
            <primitive object={targets[i]} position={[x, 1.7, -ROOM_D / 2]} />
            <spotLight
              position={[x, H - 0.05, -ROOM_D / 2 + 1.6]}
              target={targets[i]}
              angle={0.55}
              penumbra={0.8}
              intensity={22}
              distance={7}
              decay={2}
              color="#ffe2bd"
            />
          </group>
        )
      })}
      {/* Gap marker between panels so the walk has rhythm */}
      {sizes.slice(1).map((_, i) => (
        <mesh key={`g${i}`} position={[panelX(i) + PANEL_GAP / 2, 0.06, -ROOM_D / 2 + 0.02]} material={m.bronze}>
          <boxGeometry args={[0.02, 0.12, 0.01]} />
        </mesh>
      ))}
    </group>
  )
}

/* ── Camera rig ──────────────────────────────────────────────────────── */

function CameraRig({
  rig,
  n,
  active,
  views,
  near,
  onNear,
}: {
  rig: React.RefObject<Rig>
  n: number
  active: number
  views: React.RefObject<{ w: number; h: number }[]>
  near: React.RefObject<number>
  onNear: (k: number) => void
}) {
  const { camera, size } = useThree()
  const sm = useRef({ corridor: rig.current?.corridor ?? 0, room: 0 })
  const frozen = useRef<Pose | null>(null)

  useFrame((_, dt) => {
    const r = rig.current
    if (!r) return
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const narrow = aspect < 1
    const fov = narrow ? 68 : 52
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const tanH = Math.tan(((fov / 2) * Math.PI) / 180)
    const ease = 1 - Math.exp(-dt * 5)
    sm.current.corridor += (r.corridor - sm.current.corridor) * ease
    sm.current.room += (r.room - sm.current.room) * ease

    const c = corridorPose(sm.current.corridor, n, narrow)
    if (near.current !== c.near && r.open === 0) {
      near.current = c.near
      onNear(c.near)
    }

    let pose = c.pose
    if (active >= 0 && r.open > 0) {
      // Freeze the corridor view the moment the door is chosen.
      frozen.current ??= c.pose
      const front = doorFront(active)
      const a = sstep(0, 0.38, r.open)
      const b = sstep(0.55, 1, r.open)
      const list = views.current ?? []
      // Enter looking down the room, turned slightly toward the hung photographs.
      const entry: Pose = { x: 1.2, y: EYE, z: 0.6, yaw: -Math.PI / 2 + (narrow ? 0.55 : 0.28) }
      const at = (j: number) =>
        j === 0 || !list[j - 1] ? entry : panelView(j - 1, list[j - 1].w, list[j - 1].h, aspect, tanH)
      const f = stepped(Math.min(list.length, Math.max(0, sm.current.room)))
      const j = Math.floor(f)
      const inRoom = roomToWorld(active, lerpPose(at(j), at(Math.min(list.length, j + 1)), f - j))
      pose = lerpPose(lerpPose(frozen.current, front, a), inRoom, b)
    } else frozen.current = null

    camera.position.set(pose.x, pose.y, pose.z)
    camera.rotation.set(0, pose.yaw, 0, "YXZ")
  })
  return null
}

export default function VillaScene({
  rig,
  covers,
  active,
  gallery,
  running,
  onNear,
  onOpen,
}: {
  rig: React.RefObject<Rig>
  covers: string[]
  active: number
  gallery: string[]
  running: boolean
  onNear: (k: number) => void
  onOpen: (k: number) => void
}) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={running ? "always" : "never"}
      camera={{ fov: 52, near: 0.05, far: 60, position: [0, EYE, 5] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#0b0a09")
        scene.fog = new THREE.Fog("#0b0a09", 9, 34)
      }}
    >
      <Suspense fallback={null}>
        <World rig={rig} covers={covers} active={active} gallery={gallery} onNear={onNear} onOpen={onOpen} />
      </Suspense>
    </Canvas>
  )
}

function World({
  rig,
  covers,
  active,
  gallery,
  onNear,
  onOpen,
}: {
  rig: React.RefObject<Rig>
  covers: string[]
  active: number
  gallery: string[]
  onNear: (k: number) => void
  onOpen: (k: number) => void
}) {
  const tex = usePhotos(covers)
  const m = useMaterials(roomLength(Math.max(1, gallery.length)))
  const near = useRef(-2)
  const views = useRef<{ w: number; h: number }[]>([])
  const n = covers.length
  return (
    <>
      <hemisphereLight args={["#fff4e6", "#5a4a3a", 0.55]} />
      <Corridor n={n} m={m} />
      {tex.map((t, k) => (
        <Door key={k} k={k} cover={t} m={m} rig={rig} isActive={active === k} near={near} onOpen={onOpen} />
      ))}
      {active >= 0 && gallery.length > 0 && (
        <Suspense fallback={null}>
          <Room k={active} srcs={gallery} m={m} views={views} />
        </Suspense>
      )}
      <CameraRig rig={rig} n={n} active={active} views={views} near={near} onNear={onNear} />
    </>
  )
}
