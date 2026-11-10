/**
 * "Living photograph": the hero villa photo drawn by a tiny WebGL shader.
 * A mask texture marks sky (R), pool water (G) and plants (B); a blurred depth
 * map drives look-around parallax and a dolly push toward the glass doors.
 * The same shader draws two layers: the full photo behind the title, and the
 * photo with its sky keyed out in front, so the villa stands before the name.
 */

export const HERO_IMG = "/hero/villa.jpg"
export const HERO_MASK = "/hero/villa-mask.png"
export const HERO_DEPTH = "/hero/villa-depth.png"
/** The same view as a bare concrete frame, pre-aligned to the photo, with a mask of where it may show (G). */
export const HERO_STRUCT = "/hero/structure.jpg"
export const HERO_STRUCT_MASK = "/hero/structure-mask.png"
export const IMG_W = 1450
export const IMG_H = 917

export type Frame = {
  time: number
  /** Image point at the centre of the screen (0..1, y down). */
  center: [number, number]
  /** Image span visible across the screen. */
  span: [number, number]
  /** Where the walk heads; zoom is anchored here. */
  focus: [number, number]
  zoom: number
  ptr: [number, number]
  /** 0 freezes water and plants (reduced motion). */
  live: number
  /** 0..1 soft blur on the final steps through the door. */
  blur: number
  /** 1 lets the pointer trail reveal the structure; 0 disables it. */
  reveal: number
}

const VERT = `
attribute vec2 p;
varying vec2 vUv;
void main() { vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImg, uMask, uDepth, uStruct, uSMask, uTrail;
uniform vec2 uCenter, uSpan, uFocus, uPtr;
uniform float uTime, uZoom, uLive, uFront, uBlur, uReveal;
const vec2 SIZE = vec2(${IMG_W}., ${IMG_H}.);

void main() {
  vec2 base = uCenter + (vUv - .5) * uSpan;
  float d = texture2D(uDepth, base).r;
  // Dolly: nearer ground grows faster than the house as we walk in.
  float z = 1. + (uZoom - 1.) * (1. + 1.2 * max(0., d - .55));
  vec2 uv = uFocus + (base - uFocus) / z;
  uv -= uPtr * (d - .3) * vec2(.014, .008);

  vec3 m = texture2D(uMask, uv).rgb;
  vec2 q = uv * SIZE;
  float t = uTime;

  // Pool: ripples tighten with distance across the water.
  float near = smoothstep(.68, 1., uv.y);
  float f = mix(1.7, .75, near);
  float w1 = sin(q.y * .34 * f + t * 1.6 + sin(q.x * .045 * f + t * .55) * 2.2);
  float w2 = sin(q.x * .055 * f - q.y * .2 * f - t * 1.2);
  vec2 off = vec2(w1 * .6 + w2 * .4, w2 * .7 - w1 * .3) * mix(1.1, 2.4, near) * m.g;

  // Breeze through the garden, in slow gusts.
  float gust = .55 + .45 * sin(t * .33 + uv.x * 3.1);
  off.x += (sin(t * 1.25 + q.x * .02 + q.y * .035) * 1.3 + sin(t * 2.6 + q.y * .09) * .45) * gust * m.b * 1.5;
  off.y += sin(t * 1.8 + q.x * .05) * .5 * gust * m.b;

  vec2 suv = uv + off * uLive / SIZE;
  vec3 c = texture2D(uImg, suv).rgb;
  if (uBlur > 0.) {
    vec2 r = uBlur * 6. / SIZE;
    c = (c * 2. + texture2D(uImg, suv + vec2(r.x, 0.)).rgb + texture2D(uImg, suv - vec2(r.x, 0.)).rgb
      + texture2D(uImg, suv + vec2(0., r.y)).rgb + texture2D(uImg, suv - vec2(0., r.y)).rgb) / 6.;
  }

  // Sun glints dancing on the water.
  float g = pow(max(0., w1 * w2), 7.);
  c += vec3(1., .96, .86) * g * .26 * m.g * uLive;

  float a = uFront > .5 ? 1. - smoothstep(.25, .75, m.r) : 1.;

  // Structure reveal: where the pointer has passed, the finished villa gives way to the same
  // view as a bare concrete frame (aligned to the photo). It only applies to the main villa and
  // the planting in front of it (mask G): never the sky, the trees or the neighbouring house.
  float rev = uReveal * smoothstep(.1, .9, 1. - texture2D(uTrail, vUv).r);
  if (rev > .001) {
    float k = rev * texture2D(uSMask, uv).g;
    vec3 sc = texture2D(uStruct, uv).rgb;
    // A thin warm line travels along the edge of the reveal.
    float rim = k * (1. - rev) * 4.;
    c = mix(c, sc, k) + vec3(.95, .78, .5) * rim * .18;
  }
  gl_FragColor = vec4(c, a);
}`

type TexSource = HTMLImageElement | HTMLCanvasElement

export type Layer = { draw(f: Frame): void; setTrail(data: Uint8Array, w: number, h: number): void; resize(w: number, h: number, dpr: number): void; dispose(): void }

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image()
    i.decoding = "async"
    i.onload = () => ok(i)
    i.onerror = fail
    i.src = src
  })
}

export function createLayer(canvas: HTMLCanvasElement, imgs: TexSource[], front: boolean): Layer | null {
  const gl = canvas.getContext("webgl", { alpha: front, premultipliedAlpha: false, antialias: false, depth: false })
  if (!gl) return null

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, "p")
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const textures = imgs.map((img, k) => {
    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + k)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
    return tex
  })

  // Pointer trail: a tiny luminance texture replaced every frame (255 = nothing revealed).
  gl.activeTexture(gl.TEXTURE0 + 5)
  const trailTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, trailTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([255]))

  const u = (n: string) => gl.getUniformLocation(prog, n)
  ;["uImg", "uMask", "uDepth", "uStruct", "uSMask", "uTrail"].forEach((n, k) => gl.uniform1i(u(n), k))
  gl.uniform1f(u("uFront"), front ? 1 : 0)
  const U = {
    center: u("uCenter"), span: u("uSpan"), focus: u("uFocus"), ptr: u("uPtr"),
    time: u("uTime"), zoom: u("uZoom"), live: u("uLive"), blur: u("uBlur"), reveal: u("uReveal"),
  }

  return {
    draw(f) {
      gl.uniform2f(U.center, f.center[0], f.center[1])
      gl.uniform2f(U.span, f.span[0], f.span[1])
      gl.uniform2f(U.focus, f.focus[0], f.focus[1])
      gl.uniform2f(U.ptr, f.ptr[0], f.ptr[1])
      gl.uniform1f(U.time, f.time)
      gl.uniform1f(U.zoom, f.zoom)
      gl.uniform1f(U.live, f.live)
      gl.uniform1f(U.blur, f.blur)
      gl.uniform1f(U.reveal, f.reveal)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    setTrail(data, w, h) {
      gl.activeTexture(gl.TEXTURE0 + 5)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data)
    },
    resize(w, h, dpr) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    },
    dispose() {
      textures.forEach((t) => gl.deleteTexture(t))
      gl.deleteTexture(trailTex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    },
  }
}
