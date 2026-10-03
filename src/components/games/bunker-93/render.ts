/**
 * Render three.js: el mundo es UNA malla fusionada (muros+suelo+techo) con un
 * atlas y luz horneada por vértice; todos los sprites (enemigos, objetos,
 * partículas, calcomanías) son UNA malla instanciada con billboard en GPU.
 * Resultado: 2 draw calls por fotograma.
 */
import * as THREE from 'three'
import type { Img } from './paint'
import { ATLAS_COLS, ATLAS_ROWS, T } from './textures'
import { ATLAS_H, ATLAS_W, type Frame } from './sprites'
import type { Level } from './world'

export const MAX_LIGHTS = 8
const MAX_SPRITES = 2400

const LIGHT_GLSL = /* glsl */ `
uniform vec4 uLPos[${MAX_LIGHTS}];
uniform vec3 uLCol[${MAX_LIGHTS}];
vec3 dynLight(vec3 p) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 L = uLPos[i];
    if (L.w <= 0.0) continue;
    float k = max(0.0, 1.0 - length(L.xyz - p) / L.w);
    acc += uLCol[i] * k * k;
  }
  return acc;
}
`

const WORLD_VS = /* glsl */ `
attribute vec2 aUV;
attribute float aTile;
attribute vec3 aLight;
attribute float aAlarm;
varying vec2 vUV;
varying float vTile;
varying vec3 vLight;
varying float vAlarm;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vUV = aUV;
  vTile = aTile;
  vLight = aLight;
  vAlarm = aAlarm;
  vWorld = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const WORLD_FS = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform vec3 uFog;
uniform float uFogD;
uniform float uAlarm;
uniform float uFlicker;
${LIGHT_GLSL}
varying vec2 vUV;
varying float vTile;
varying vec3 vLight;
varying float vAlarm;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec2 f = fract(vUV);
  float t = floor(vTile + 0.5);
  vec2 cell = vec2(mod(t, uGrid.x), floor(t / uGrid.x));
  vec4 tex = texture2D(uAtlas, (cell + f) / uGrid);
  vec3 light = vLight * uFlicker + vec3(1.0, 0.12, 0.06) * vAlarm * uAlarm + dynLight(vWorld);
  // bandas de luz al estilo 1993
  light = floor(light * 9.0 + 0.5) / 9.0;
  float emis = tex.a < 0.9 ? 1.0 : 0.0;
  vec3 col = emis > 0.5 ? tex.rgb * (0.9 + 0.1 * uFlicker) : tex.rgb * light;
  float fog = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth);
  col = mix(col, uFog, fog * (1.0 - emis * 0.55));
  gl_FragColor = vec4(col, 1.0);
}
`

const SPRITE_VS = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iSize;
attribute vec4 iUV;
attribute vec4 iCol;
uniform vec3 uCamRight;
${LIGHT_GLSL}
varying vec2 vUV;
varying vec4 vCol;
varying vec3 vDyn;
varying float vFull;
varying float vDepth;
void main() {
  vec3 p;
  if (iSize.z < 0.5) {
    p = iPos + uCamRight * (position.x * iSize.x) + vec3(0.0, position.y * iSize.y, 0.0);
  } else {
    p = iPos + vec3(position.x * iSize.x, 0.0, (position.y - 0.5) * iSize.y);
  }
  vUV = vec2(mix(iUV.x, iUV.z, position.x + 0.5), mix(iUV.w, iUV.y, position.y));
  vCol = iCol;
  vFull = iSize.w;
  vDyn = iSize.w > 0.5 ? vec3(0.0) : dynLight(iPos + vec3(0.0, iSize.y * 0.5, 0.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const SPRITE_FS = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec3 uFog;
uniform float uFogD;
varying vec2 vUV;
varying vec4 vCol;
varying vec3 vDyn;
varying float vFull;
varying float vDepth;
void main() {
  vec4 t = texture2D(uTex, vUV);
  if (t.a < 0.3) discard;
  float emis = t.a < 0.9 ? 1.0 : 0.0;
  vec3 col;
  if (vFull > 0.5) {
    col = t.rgb * vCol.rgb;
  } else {
    vec3 light = floor((vCol.rgb + vDyn) * 9.0 + 0.5) / 9.0;
    col = emis > 0.5 ? t.rgb : t.rgb * light;
    col = mix(col, vec3(1.0, 0.96, 0.9), vCol.a);
  }
  float fog = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth);
  col = mix(col, uFog, fog * (vFull > 0.5 || emis > 0.5 ? 0.35 : 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`

function dataTex(img: Img): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(img.data.buffer.slice(0)), img.w, img.h, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.flipY = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

export class Renderer93 {
  readonly gl: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private worldMat: THREE.ShaderMaterial
  private worldMesh: THREE.Mesh | null = null
  private spriteMat: THREE.ShaderMaterial
  private spriteGeo: THREE.InstancedBufferGeometry
  private spriteMesh: THREE.Mesh
  private worldTex: THREE.DataTexture
  private spriteTex: THREE.DataTexture
  private lPos: THREE.Vector4[] = []
  private lCol: THREE.Vector3[] = []
  private aPos: THREE.InstancedBufferAttribute
  private aSize: THREE.InstancedBufferAttribute
  private aUV: THREE.InstancedBufferAttribute
  private aCol: THREE.InstancedBufferAttribute
  private n = 0
  private nLights = 0
  readonly camRight = new THREE.Vector3(1, 0, 0)
  readonly frames: Frame[]

  constructor(canvas: HTMLCanvasElement, worldAtlas: Img, spriteAtlas: Img, frames: Frame[]) {
    this.frames = frames
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    })
    this.gl.setPixelRatio(1)
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 48)
    this.camera.rotation.order = 'YXZ'
    this.worldTex = dataTex(worldAtlas)
    this.spriteTex = dataTex(spriteAtlas)
    for (let i = 0; i < MAX_LIGHTS; i++) {
      this.lPos.push(new THREE.Vector4(0, 0, 0, 0))
      this.lCol.push(new THREE.Vector3())
    }
    const common = {
      uLPos: { value: this.lPos },
      uLCol: { value: this.lCol },
      uFog: { value: new THREE.Color(0x000000) },
      uFogD: { value: 0.06 },
    }
    this.worldMat = new THREE.ShaderMaterial({
      uniforms: {
        ...common,
        uAtlas: { value: this.worldTex },
        uGrid: { value: new THREE.Vector2(ATLAS_COLS, ATLAS_ROWS) },
        uAlarm: { value: 0 },
        uFlicker: { value: 1 },
      },
      vertexShader: WORLD_VS,
      fragmentShader: WORLD_FS,
      side: THREE.DoubleSide,
    })
    this.spriteMat = new THREE.ShaderMaterial({
      uniforms: {
        ...common,
        uTex: { value: this.spriteTex },
        uCamRight: { value: this.camRight },
      },
      vertexShader: SPRITE_VS,
      fragmentShader: SPRITE_FS,
      side: THREE.DoubleSide,
    })
    // las dos materias comparten las mismas referencias de uniforms de luz/niebla
    this.spriteMat.uniforms.uFog = this.worldMat.uniforms.uFog
    this.spriteMat.uniforms.uFogD = this.worldMat.uniforms.uFogD

    const plane = new THREE.PlaneGeometry(1, 1)
    plane.translate(0, 0.5, 0)
    this.spriteGeo = new THREE.InstancedBufferGeometry()
    this.spriteGeo.index = plane.index
    this.spriteGeo.setAttribute('position', plane.getAttribute('position'))
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SPRITES * 3), 3)
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SPRITES * 4), 4)
    this.aUV = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SPRITES * 4), 4)
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SPRITES * 4), 4)
    for (const a of [this.aPos, this.aSize, this.aUV, this.aCol]) a.setUsage(THREE.DynamicDrawUsage)
    this.spriteGeo.setAttribute('iPos', this.aPos)
    this.spriteGeo.setAttribute('iSize', this.aSize)
    this.spriteGeo.setAttribute('iUV', this.aUV)
    this.spriteGeo.setAttribute('iCol', this.aCol)
    this.spriteGeo.instanceCount = 0
    plane.dispose()
    this.spriteMesh = new THREE.Mesh(this.spriteGeo, this.spriteMat)
    this.spriteMesh.frustumCulled = false
    this.spriteMesh.renderOrder = 1
    this.scene.add(this.spriteMesh)
  }

  setFog(color: number, density: number) {
    ;(this.worldMat.uniforms.uFog.value as THREE.Color).setHex(color)
    this.worldMat.uniforms.uFogD.value = density
    this.gl.setClearColor(color, 1)
  }

  setAmbientFx(alarm: number, flicker: number) {
    this.worldMat.uniforms.uAlarm.value = alarm
    this.worldMat.uniforms.uFlicker.value = flicker
  }

  resize(w: number, h: number) {
    this.gl.setSize(w, h, false)
  }

  /** Coloca la cámara: yaw a (0 = +X), altura y. */
  setCamera(x: number, y: number, z: number, a: number, roll = 0) {
    this.camera.position.set(x, y, z)
    this.camera.rotation.set(0, -a - Math.PI / 2, roll)
    this.camRight.set(-Math.sin(a), 0, Math.cos(a))
  }

  // ----- luces dinámicas -----
  clearLights() {
    this.nLights = 0
    for (let i = 0; i < MAX_LIGHTS; i++) this.lPos[i].w = 0
  }

  addLight(x: number, y: number, z: number, r: number, cr: number, cg: number, cb: number) {
    if (this.nLights >= MAX_LIGHTS) return
    const i = this.nLights++
    this.lPos[i].set(x, y, z, r)
    this.lCol[i].set(cr, cg, cb)
  }

  // ----- sprites -----
  beginSprites() {
    this.n = 0
  }

  /**
   * Añade un sprite. mode 0 = billboard vertical, 1 = plano en el suelo.
   * light = multiplicador (o tinte si full=1). flash = destello blanco 0..1.
   */
  sprite(
    frame: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    lr: number,
    lg: number,
    lb: number,
    flash = 0,
    flip = false,
    mode = 0,
    full = 0,
  ) {
    if (this.n >= MAX_SPRITES) return
    const f = this.frames[frame]
    if (!f) return
    const i = this.n++
    const p = this.aPos.array as Float32Array
    const s = this.aSize.array as Float32Array
    const u = this.aUV.array as Float32Array
    const c = this.aCol.array as Float32Array
    p[i * 3] = x
    p[i * 3 + 1] = y
    p[i * 3 + 2] = z
    s[i * 4] = w
    s[i * 4 + 1] = h
    s[i * 4 + 2] = mode
    s[i * 4 + 3] = full
    // medio texel hacia dentro para evitar sangrado
    const eu = 0.25 / ATLAS_W
    const ev = 0.25 / ATLAS_H
    if (flip) {
      u[i * 4] = f.u1 - eu
      u[i * 4 + 2] = f.u0 + eu
    } else {
      u[i * 4] = f.u0 + eu
      u[i * 4 + 2] = f.u1 - eu
    }
    u[i * 4 + 1] = f.v0 + ev
    u[i * 4 + 3] = f.v1 - ev
    c[i * 4] = lr
    c[i * 4 + 1] = lg
    c[i * 4 + 2] = lb
    c[i * 4 + 3] = flash
  }

  endSprites() {
    this.spriteGeo.instanceCount = this.n
    for (const [a, k] of [
      [this.aPos, 3],
      [this.aSize, 4],
      [this.aUV, 4],
      [this.aCol, 4],
    ] as [THREE.InstancedBufferAttribute, number][]) {
      a.clearUpdateRanges()
      a.addUpdateRange(0, Math.max(1, this.n) * k)
      a.needsUpdate = true
    }
  }

  render() {
    this.gl.render(this.scene, this.camera)
  }

  // ----- geometría de la arena -----
  buildArena(level: Level) {
    if (this.worldMesh) {
      this.scene.remove(this.worldMesh)
      this.worldMesh.geometry.dispose()
      this.worldMesh = null
    }
    const def = level.def
    const H = def.ceil
    const K = Math.ceil(H) + 2
    const pos: number[] = []
    const uv: number[] = []
    const tile: number[] = []
    const light: number[] = []
    const alarm: number[] = []
    const idx: number[] = []
    const ch = (x: number, z: number) => (x < 0 || z < 0 || x >= level.w || z >= level.h ? '#' : level.chars[z][x])
    const solidAt = (x: number, z: number) => level.solid[z * level.w + x] === 1 || x < 0 || z < 0
    const vert = (x: number, y: number, z: number, u: number, v: number, t: number, nx: number, ny: number, nz: number, ao: number) => {
      pos.push(x, y, z)
      uv.push(u, v)
      tile.push(t)
      const l = level.lightAt(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, nx, ny, nz)
      light.push(l[0] * ao, l[1] * ao, l[2] * ao)
      alarm.push(l[3] * ao)
    }
    const quad = () => {
      const b = pos.length / 3 - 4
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
    }
    // oclusión ambiental barata en vértices del suelo
    const aoFloor = (vx: number, vz: number) => {
      let n = 0
      for (const [dx, dz] of [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ]) {
        const cx = vx + dx
        const cz = vz + dz
        if (cx < 0 || cz < 0 || cx >= level.w || cz >= level.h || level.opaque[cz * level.w + cx]) n++
      }
      return 1 - n * 0.16
    }

    for (let z = 0; z < level.h; z++) {
      for (let x = 0; x < level.w; x++) {
        const c = ch(x, z)
        const opaque = level.opaque[z * level.w + x] === 1
        if (opaque) continue
        const low = c === 'c' || c === 'O'
        // suelo
        if (!low) {
          const ft = c === ',' ? def.floor2 : c === '~' ? T.SLIME : def.floor
          vert(x, 0, z, x, z, ft, 0, 1, 0, aoFloor(x, z))
          vert(x, 0, z + 1, x, z + 1, ft, 0, 1, 0, aoFloor(x, z + 1))
          vert(x + 1, 0, z + 1, x + 1, z + 1, ft, 0, 1, 0, aoFloor(x + 1, z + 1))
          vert(x + 1, 0, z, x + 1, z, ft, 0, 1, 0, aoFloor(x + 1, z))
          quad()
        }
        // techo
        const ct = c === 'L' ? T.CEIL_LAMP : c === 'R' ? T.CEIL_ALARM : def.ceilTile
        vert(x, H, z, x, z, ct, 0, -1, 0, 1)
        vert(x + 1, H, z, x + 1, z, ct, 0, -1, 0, 1)
        vert(x + 1, H, z + 1, x + 1, z + 1, ct, 0, -1, 0, 1)
        vert(x, H, z + 1, x, z + 1, ct, 0, -1, 0, 1)
        quad()
        // bloques bajos (cajas, borde del reactor)
        if (low) {
          const bh = c === 'c' ? 0.8 : 0.45
          const top = c === 'c' ? T.CRATE_TOP : T.RIM_TOP
          const side = c === 'c' ? T.CRATE : T.RIM_SIDE
          vert(x, bh, z, x, z, top, 0, 1, 0, 1)
          vert(x, bh, z + 1, x, z + 1, top, 0, 1, 0, 1)
          vert(x + 1, bh, z + 1, x + 1, z + 1, top, 0, 1, 0, 1)
          vert(x + 1, bh, z, x + 1, z, top, 0, 1, 0, 1)
          quad()
          const vs = 1 / bh
          const sides: [number, number, number, number, number, number, number, number][] = [
            // vecino dx,dz ; esquina A (x,z) ; esquina B ; normal
            [0, -1, x + 1, z, x, z, 0, -1],
            [0, 1, x, z + 1, x + 1, z + 1, 0, 1],
            [-1, 0, x, z, x, z + 1, -1, 0],
            [1, 0, x + 1, z + 1, x + 1, z, 1, 0],
          ]
          for (const [dx, dz, ax, az, bx, bz, nx, nz] of sides) {
            const nc = ch(x + dx, z + dz)
            if (nc === c || solidAt(x + dx, z + dz)) continue
            vert(ax, bh, az, 0, (K - bh) * vs, side, nx, 0, nz, 1)
            vert(ax, 0, az, 0, K * vs, side, nx, 0, nz, 0.7)
            vert(bx, 0, bz, 1, K * vs, side, nx, 0, nz, 0.7)
            vert(bx, bh, bz, 1, (K - bh) * vs, side, nx, 0, nz, 1)
            quad()
          }
        }
        // muros que rodean esta celda abierta
        const walls: [number, number, number, number, number, number, number, number][] = [
          // vecino ; borde A ; borde B (vistos desde dentro) ; normal hacia dentro
          [0, -1, x, z, x + 1, z, 0, 1],
          [0, 1, x + 1, z + 1, x, z + 1, 0, -1],
          [-1, 0, x, z + 1, x, z, 1, 0],
          [1, 0, x + 1, z, x + 1, z + 1, -1, 0],
        ]
        for (const [dx, dz, ax, az, bx, bz, nx, nz] of walls) {
          const wx = x + dx
          const wz = z + dz
          if (!level.isOpaque(wx, wz)) continue
          const wc = ch(wx, wz)
          // coordenada u continua a lo largo del muro
          // u = proyección sobre el vector "derecha" de quien mira el muro
          const u0 = ax * -dz + az * dx
          const u1 = bx * -dz + bz * dx
          const segs: [number, number, number, number][] = [] // y0, y1, tile, vScale
          if (wc === 'D') {
            segs.push([0, 2, T.DOOR, 0.5], [2, H, def.wall, 1])
          } else if (wc === 'V') {
            segs.push([0, 2, T.VAT, 0.5], [2, H, def.wall, 1])
          } else if (wc === 'o') {
            segs.push([0, H, T.PILLAR, 1])
          } else if (wc === '=') {
            segs.push([0, 1, def.wall2, 1], [1, H, def.wall, 1])
          } else {
            segs.push([0, H, def.wall, 1])
          }
          for (const [y0, y1, t, vs] of segs) {
            if (y1 <= y0) continue
            const aoB = y0 === 0 ? 0.72 : 1
            const aoT = y1 >= H ? 0.85 : 1
            vert(ax, y1, az, u0, (K - y1) * vs, t, nx, 0, nz, aoT)
            vert(ax, y0, az, u0, (K - y0) * vs - 0.0001, t, nx, 0, nz, aoB)
            vert(bx, y0, bz, u1, (K - y0) * vs - 0.0001, t, nx, 0, nz, aoB)
            vert(bx, y1, bz, u1, (K - y1) * vs, t, nx, 0, nz, aoT)
            quad()
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2))
    geo.setAttribute('aTile', new THREE.Float32BufferAttribute(tile, 1))
    geo.setAttribute('aLight', new THREE.Float32BufferAttribute(light, 3))
    geo.setAttribute('aAlarm', new THREE.Float32BufferAttribute(alarm, 1))
    geo.setIndex(idx)
    geo.computeBoundingSphere()
    this.worldMesh = new THREE.Mesh(geo, this.worldMat)
    this.scene.add(this.worldMesh)
    this.setFog(def.fog, def.fogDensity)
  }

  dispose() {
    if (this.worldMesh) {
      this.worldMesh.geometry.dispose()
      this.scene.remove(this.worldMesh)
    }
    this.spriteGeo.dispose()
    this.worldMat.dispose()
    this.spriteMat.dispose()
    this.worldTex.dispose()
    this.spriteTex.dispose()
    this.gl.dispose()
  }
}
