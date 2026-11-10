import { projects, stories } from "../data"

type Report = (fraction: number) => void

/** Load a single image with a hard timeout — on mobile networks images may stall. */
function image(src: string, timeoutMs = 6000) {
  return new Promise<void>((done) => {
    const timer = setTimeout(done, timeoutMs)
    const i = new Image()
    i.onload = i.onerror = () => {
      clearTimeout(timer)
      // Decode so the first paint after the intro has nothing left to do.
      if (i.decode) i.decode().catch(() => {}).finally(done)
      else done()
    }
    i.src = src
  })
}

/**
 * Loads critical assets the site needs: fonts, the hero photograph, project
 * thumbnails, and the lazy 3D scene chunks. Each item resolves independently
 * and reports weighted progress. Failures and timeouts count as "done" so the
 * preloader always finishes.
 */
export function preloadSite(onProgress: Report) {
  const urls = new Set<string>(["/logo-gold-t.png", "/logo-white-t.png"])
  projects.forEach((p) => urls.add(p.img))
  Object.values(stories).forEach((s) => s.gallery.forEach((g) => urls.add(g.src)))
  try { Array.from(document.images).forEach((i) => i.currentSrc && urls.add(i.currentSrc)) } catch {}

  const parts: { weight: number; run: () => Promise<unknown> }[] = [
    // Hero photo is the heaviest single asset.
    { weight: 20, run: () => image("/hero/villa.jpg", 8000) },
    { weight: 6, run: () => Promise.all([image("/hero/villa-mask.png", 6000), image("/hero/villa-depth.png", 6000), image("/hero/structure.jpg", 6000), image("/hero/structure-mask.png", 6000)]) },
    // Fonts — some mobile browsers resolve this instantly, some take a while.
    { weight: 4, run: () => (document.fonts?.ready ?? Promise.resolve()) },
    // 3D scene code-splits — not critical, just nice-to-have.
    { weight: 5, run: () => import("../components/portfolio/VillaScene").catch(() => {}) },
    // All other images (project thumbnails, logos, etc.)
    ...[...urls].map((u) => ({ weight: 46 / Math.max(urls.size, 1), run: () => image(u) })),
  ]

  const sum = parts.reduce((a, p) => a + p.weight, 0)
  const done = parts.map(() => 0)
  const emit = () => onProgress(done.reduce((a, d, k) => a + d * parts[k].weight, 0) / sum)

  return Promise.all(
    parts.map((p, k) =>
      p.run()
        .catch(() => {})
        .finally(() => {
          done[k] = 1
          emit()
        }),
    ),
  )
}
