/** Pedidos: requisitos con peso, plantillas con personalidad y calificación. */
import { FLAVORS, FROSTS, TOPS, flavorOf, topOf, type FlavorId, type FrostId, type TopId } from './content'
import { bakeLevel, countOf, countSide, cutEvenness, frostInfo, fruitCount, slices, variety, type BakeLevel, type Cake } from './cake'

export type Req =
  | { k: 'flavor'; v: FlavorId }
  | { k: 'frost'; v: FrostId }
  | { k: 'frostAny' }
  | { k: 'noFrostColor'; v: FrostId }
  | { k: 'halfFrost'; a: FrostId; b: FrostId }
  | { k: 'noFrost' }
  | { k: 'count'; t: TopId; n: number }
  | { k: 'min'; t: TopId; n: number }
  | { k: 'none'; t: TopId }
  | { k: 'noFruit' }
  | { k: 'halfTop'; t: TopId }
  | { k: 'variety'; n: number }
  | { k: 'slices'; n: number }
  | { k: 'bake'; v: BakeLevel }
  | { k: 'plain' }
  | { k: 'tone'; tones: string[]; n: number }
  | { k: 'many'; n: number }

export interface ReqW {
  r: Req
  w: number
  hint: string
}
export interface Order {
  text: string
  reqs: ReqW[]
}

const BAKE_ORDER: BakeLevel[] = ['crudo', 'suave', 'punto', 'dorado', 'quemado']

export function reqValue(c: Cake, r: Req): number {
  const fi = frostInfo(c)
  switch (r.k) {
    case 'flavor':
      return c.flavor === r.v ? 1 : 0
    case 'frost': {
      const f = fi.by.get(r.v) ?? 0
      return f >= 0.7 ? 1 : f >= 0.4 ? 0.5 : 0
    }
    case 'frostAny':
      return fi.cover >= 0.8 ? 1 : (fi.cover / 0.8) * 0.7
    case 'noFrostColor':
      return (fi.by.get(r.v) ?? 0) < 0.05 ? 1 : 0
    case 'halfFrost': {
      const [l, lf] = fi.left
      const [rr, rf] = fi.right
      const ok = (x: FrostId | null, f: number, want: FrostId) => x === want && f >= 0.6
      if ((ok(l, lf, r.a) && ok(rr, rf, r.b)) || (ok(l, lf, r.b) && ok(rr, rf, r.a))) return 1
      if (ok(l, lf, r.a) || ok(l, lf, r.b) || ok(rr, rf, r.a) || ok(rr, rf, r.b)) return 0.4
      return 0
    }
    case 'noFrost':
      return fi.cover < 0.05 ? 1 : 0
    case 'count': {
      const d = Math.abs(countOf(c, r.t) - r.n)
      return d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.3 : 0
    }
    case 'min':
      return Math.min(1, countOf(c, r.t) / r.n)
    case 'none':
      return countOf(c, r.t) === 0 ? 1 : 0
    case 'noFruit':
      return fruitCount(c) === 0 ? 1 : 0
    case 'halfTop': {
      const l = countSide(c, r.t, 'l')
      const rt = countSide(c, r.t, 'r')
      if (l + rt < 3) return (l + rt) / 3 / 2
      if (l === 0 || rt === 0) return 1
      return Math.max(l, rt) / (l + rt) >= 0.8 ? 0.5 : 0
    }
    case 'variety':
      return Math.min(1, variety(c) / r.n)
    case 'slices': {
      const s = slices(c)
      return s === r.n ? 1 : r.n > 1 && s > 1 ? 0.4 : 0
    }
    case 'bake': {
      const d = Math.abs(BAKE_ORDER.indexOf(bakeLevel(c.bake)) - BAKE_ORDER.indexOf(r.v))
      return d === 0 ? 1 : d === 1 ? 0.4 : 0
    }
    case 'plain':
      return c.pieces.length === 0 ? 1 : 0
    case 'tone': {
      const n = c.pieces.filter((p) => r.tones.includes(topOf(p.top).tone)).length
      return Math.min(1, n / r.n)
    }
    case 'many':
      return Math.min(1, c.pieces.length / r.n)
  }
}

export interface Verdict {
  score: number
  req: number
  quality: number
  hints: string[]
}

export function judge(c: Cake, o: Order): Verdict {
  const tw = o.reqs.reduce((a, q) => a + q.w, 0) || 1
  let req = 0
  const hints: string[] = []
  for (const q of o.reqs) {
    const v = reqValue(c, q.r)
    req += v * q.w
    if (v < 0.6) hints.push(q.hint)
  }
  req /= tw
  // calidad general
  const qs: number[] = []
  const lvl = bakeLevel(c.bake)
  const wantsBake = o.reqs.some((q) => q.r.k === 'bake')
  if (lvl === 'crudo') {
    qs.push(0.15)
    hints.push('¡Estaba crudo!')
  } else if (lvl === 'quemado') {
    qs.push(0.1)
    hints.push('Se quemó un poquito...')
  } else qs.push(wantsBake || lvl === 'punto' ? 1 : 0.85)
  qs.push(c.fill >= 0.85 ? 1 : c.fill / 0.85)
  if (c.fill < 0.6) hints.push('Muy delgadito')
  if (c.spill > 0.05) {
    qs.push(0.5)
    hints.push('Se derramó la masa')
  }
  const fi = frostInfo(c)
  if (fi.cover > 0.05 && !o.reqs.some((q) => q.r.k === 'noFrost')) {
    qs.push(Math.min(1, fi.cover / 0.9))
    if (fi.cover < 0.75 && !o.reqs.some((q) => q.r.k === 'halfFrost')) hints.push('La crema quedó a medias')
  }
  if (c.cuts.length >= 2) {
    const ev = cutEvenness(c)
    qs.push(ev)
    if (ev < 0.6) hints.push('Rebanadas chuecas')
  }
  const quality = qs.reduce((a, b) => a + b, 0) / qs.length
  return { score: Math.round(100 * (0.75 * req + 0.25 * quality)), req, quality, hints }
}

/** Lista clara del pedido, para cuando preguntan "¿Cómo?". */
export function clearText(o: Order): string {
  const parts = o.reqs.map(({ r }) => {
    switch (r.k) {
      case 'flavor':
        return `pan de ${flavorOf(r.v).name.toLowerCase()}`
      case 'frost':
        return `crema ${FROSTS.find((f) => f.id === r.v)!.name}`
      case 'frostAny':
        return 'con crema'
      case 'noFrostColor':
        return `nada de crema ${FROSTS.find((f) => f.id === r.v)!.name}`
      case 'halfFrost':
        return `mitad ${FROSTS.find((f) => f.id === r.a)!.name}, mitad ${FROSTS.find((f) => f.id === r.b)!.name}`
      case 'noFrost':
        return 'sin crema'
      case 'count':
        return `${r.n} ${topOf(r.t).plural} exactas`
      case 'min':
        return `${r.n}+ ${topOf(r.t).plural}`
      case 'none':
        return `sin ${topOf(r.t).plural}`
      case 'noFruit':
        return 'sin fruta'
      case 'halfTop':
        return `${topOf(r.t).plural} solo en una mitad`
      case 'variety':
        return `${r.n}+ adornos distintos`
      case 'slices':
        return r.n === 1 ? 'sin cortar' : `${r.n} rebanadas`
      case 'bake':
        return r.v === 'suave' ? 'poco horneado' : r.v === 'dorado' ? 'bien dorado' : 'horneado normal'
      case 'plain':
        return 'sin adornos'
      case 'tone':
        return `${r.n}+ adornos ${r.tones.join('/')}`
      case 'many':
        return `${r.n}+ adornos`
    }
  })
  return parts.join(' · ')
}

// ---------- plantillas ----------
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
type Tpl = (h: (id: string) => boolean) => Order | null

const owned = <T extends { id: string }>(list: T[], h: (id: string) => boolean) => list.filter((x) => h(x.id))
const fr = (id: FrostId) => FROSTS.find((f) => f.id === id)!.name
const fl = (id: FlavorId) => flavorOf(id).name.toLowerCase()
const pl = (id: TopId) => topOf(id).plural

const TEMPLATES: Tpl[] = [
  (h) => {
    const f = pick(owned(FLAVORS, h)).id
    const c = pick(owned(FROSTS, h)).id
    return {
      text: pick([`Uno de ${fl(f)} con crema ${fr(c)}, porfa`, `¿Me hace uno de ${fl(f)}? Con crema ${fr(c)}`, `Antojo de ${fl(f)} y crema ${fr(c)}`]),
      reqs: [
        { r: { k: 'flavor', v: f }, w: 2, hint: `No era de ${fl(f)}` },
        { r: { k: 'frost', v: c }, w: 2, hint: `Quería crema ${fr(c)}` },
      ],
    }
  },
  (h) => {
    const t = pick(owned(TOPS, h).filter((x) => x.id !== 'vela')).id
    const n = ri(3, 7)
    return {
      text: pick([`Con ${n} ${pl(t)}. Ni una más, ni una menos`, `Quiero exactamente ${n} ${pl(t)}`, `${n} ${pl(t)}, es mi número de la suerte`]),
      reqs: [
        { r: { k: 'count', t, n }, w: 3, hint: `Pedí ${n} ${pl(t)}` },
        { r: { k: 'frostAny' }, w: 1, hint: 'Le faltó crema' },
      ],
    }
  },
  (h) => {
    const t = pick(owned(TOPS, h).filter((x) => x.id !== 'vela')).id
    return {
      text: pick([`¡Muuuchas ${pl(t)}!`, `Que no se vea el pastel de tantas ${pl(t)}`, `Soy fan de las ${pl(t)}. Fan.`]),
      reqs: [{ r: { k: 'min', t, n: 10 }, w: 3, hint: `Más ${pl(t)}` }],
    }
  },
  (h) => {
    const t = pick(owned(TOPS, h).filter((x) => x.id !== 'vela')).id
    return {
      text: `${pl(t)[0].toUpperCase() + pl(t).slice(1)} de un lado y nada del otro, es para compartir`,
      reqs: [
        { r: { k: 'halfTop', t }, w: 3, hint: `Las ${pl(t)} iban de un solo lado` },
        { r: { k: 'frostAny' }, w: 1, hint: 'Le faltó crema' },
      ],
    }
  },
  (h) => {
    const fs = owned(FROSTS, h)
    if (fs.length < 2) return null
    const a = pick(fs).id
    let b = pick(fs).id
    while (b === a) b = pick(fs).id
    return {
      text: pick([`Mitad ${fr(a)} y mitad ${fr(b)}, no me decido`, `A mi novio le gusta ${fr(a)} y a mí ${fr(b)}... ¿mitad y mitad?`]),
      reqs: [{ r: { k: 'halfFrost', a, b }, w: 4, hint: `Era mitad ${fr(a)}, mitad ${fr(b)}` }],
    }
  },
  (h) => {
    const c = pick(owned(FROSTS, h)).id
    return {
      text: pick([`Lo que sea, menos crema ${fr(c)}. La odio`, `Con crema, pero NADA ${fr(c)}`]),
      reqs: [
        { r: { k: 'noFrostColor', v: c }, w: 3, hint: `¡Dije nada ${fr(c)}!` },
        { r: { k: 'frostAny' }, w: 1, hint: 'Sí quería crema' },
      ],
    }
  },
  () => ({
    text: pick(['Sin fruta, soy alérgico. Achú', 'Nada de fruta, pero que se vea bonito']),
    reqs: [
      { r: { k: 'noFruit' }, w: 3, hint: '¡Tenía fruta!' },
      { r: { k: 'many', n: 5 }, w: 1, hint: 'Se veía vacío' },
    ],
  }),
  (h) => {
    const n = pick([4, 6, 8])
    const f = pick(owned(FLAVORS, h)).id
    return {
      text: pick([`De ${fl(f)}, somos ${n} amigos`, `Para ${n} personas, de ${fl(f)}`, `Mi familia es de ${n}. ¿Uno de ${fl(f)}?`]),
      reqs: [
        { r: { k: 'slices', n }, w: 2, hint: `Éramos ${n}, faltó cortarlo así` },
        { r: { k: 'flavor', v: f }, w: 1, hint: `No era de ${fl(f)}` },
      ],
    }
  },
  (h) => {
    const t = pick(owned(TOPS, h).filter((x) => x.id !== 'vela')).id
    return {
      text: pick([`No lo corte, me lo como entero. Con ${pl(t)}`, `Entero, sin cortar. Y ${pl(t)} encima`]),
      reqs: [
        { r: { k: 'slices', n: 1 }, w: 2, hint: '¡Lo cortaron!' },
        { r: { k: 'min', t, n: 4 }, w: 1, hint: `Más ${pl(t)}` },
      ],
    }
  },
  (h) => {
    const f = pick(owned(FLAVORS, h)).id
    return {
      text: pick([`De ${fl(f)}, suavecito, que se deshaga`, `Poquito horneado, me gusta húmedo. De ${fl(f)}`]),
      reqs: [
        { r: { k: 'bake', v: 'suave' }, w: 2, hint: 'Lo quería más suavecito' },
        { r: { k: 'flavor', v: f }, w: 1, hint: `No era de ${fl(f)}` },
      ],
    }
  },
  () => ({
    text: pick(['Bien doradito y sin crema, me gusta ver el pan', 'Sin crema, tostadito por fuera']),
    reqs: [
      { r: { k: 'bake', v: 'dorado' }, w: 2, hint: 'Lo quería más dorado' },
      { r: { k: 'noFrost' }, w: 2, hint: 'Sin crema, dije' },
    ],
  }),
  () => ({
    text: pick(['Sencillito: sin crema y sin nada', 'Solo el pan, soy de gustos simples']),
    reqs: [
      { r: { k: 'noFrost' }, w: 2, hint: 'Sin crema, porfa' },
      { r: { k: 'plain' }, w: 2, hint: 'Sin adornos, dije' },
    ],
  }),
  (h) => {
    if (owned(TOPS, h).length < 4) return null
    return {
      text: pick(['Con de todo un poco', 'Sorpréndame, que tenga de todo', '¡Uno bien variado!']),
      reqs: [
        { r: { k: 'variety', n: 4 }, w: 3, hint: 'Quería más variedad' },
        { r: { k: 'frostAny' }, w: 1, hint: 'Le faltó crema' },
      ],
    }
  },
  (h) => {
    if (!h('vela')) return null
    const n = ri(3, 9)
    return {
      text: pick([`¡Es mi cumple! Cumplo ${n}`, `Hoy cumplo ${n} añitos`, `Velitas para mis ${n} años, porfis`]),
      reqs: [
        { r: { k: 'count', t: 'vela', n }, w: 3, hint: `Cumplo ${n}, eran ${n} velas` },
        { r: { k: 'frostAny' }, w: 1, hint: 'Un cumple sin crema...' },
      ],
    }
  },
  () => ({
    text: pick(['Uno que parezca nube', 'Blanquito como nube, sin chispas']),
    reqs: [
      { r: { k: 'frost', v: 'blanca' }, w: 3, hint: 'Las nubes son blancas' },
      { r: { k: 'none', t: 'chispas' }, w: 1, hint: 'Las nubes no tienen chispas' },
    ],
  }),
  (h) => {
    if (!h('flor')) return null
    return {
      text: 'Que parezca un jardín',
      reqs: [
        { r: { k: 'min', t: 'flor', n: 4 }, w: 3, hint: 'Faltaron flores' },
        { r: { k: 'tone', tones: ['verde', 'lila'], n: 5 }, w: 1, hint: 'Más verde y lila' },
      ],
    }
  },
  (h) => ({
    text: pick(['Rojo. Todo rojo. Me encanta el rojo', 'Algo rojísimo']),
    reqs: [
      { r: { k: 'tone', tones: ['rojo'], n: 6 }, w: 3, hint: 'Más cosas rojas' },
      ...(h('redvelvet') ? [{ r: { k: 'flavor', v: 'redvelvet' } as Req, w: 1, hint: 'Un red velvet habría ido perfecto' }] : []),
    ],
  }),
  (h) => ({
    text: pick(['Chocolate por todos lados', 'Soy chocolatero, sorpréndame']),
    reqs: [
      { r: { k: 'flavor', v: 'chocolate' }, w: 2, hint: 'El pan no era de chocolate' },
      ...(h('choco') ? [{ r: { k: 'frost', v: 'choco' } as Req, w: 2, hint: 'La crema no era de chocolate' }] : []),
      ...(h('bombon') ? [{ r: { k: 'min', t: 'bombon', n: 4 } as Req, w: 1, hint: 'Faltaron bombones' }] : []),
    ],
  }),
  (h) => {
    const ts = owned(TOPS, h).filter((x) => x.id !== 'vela')
    if (ts.length < 2) return null
    const a = pick(ts).id
    let b = pick(ts).id
    while (b === a) b = pick(ts).id
    const n = ri(2, 5)
    const m = ri(2, 5)
    return {
      text: `${n} ${pl(a)} y ${m} ${pl(b)}`,
      reqs: [
        { r: { k: 'count', t: a, n }, w: 2, hint: `Eran ${n} ${pl(a)}` },
        { r: { k: 'count', t: b, n: m }, w: 2, hint: `Eran ${m} ${pl(b)}` },
      ],
    }
  },
  (h) => {
    const f = pick(owned(FLAVORS, h)).id
    const c = pick(owned(FROSTS, h)).id
    const t = pick(owned(TOPS, h).filter((x) => x.id !== 'vela')).id
    const n = ri(4, 8)
    const s = pick([4, 6, 8])
    return {
      text: `De ${fl(f)}, crema ${fr(c)}, ${n} ${pl(t)} y en ${s} rebanadas. Lo tengo todo pensado`,
      reqs: [
        { r: { k: 'flavor', v: f }, w: 1, hint: `No era de ${fl(f)}` },
        { r: { k: 'frost', v: c }, w: 1, hint: `Era crema ${fr(c)}` },
        { r: { k: 'count', t, n }, w: 1, hint: `Eran ${n} ${pl(t)}` },
        { r: { k: 'slices', n: s }, w: 1, hint: `Eran ${s} rebanadas` },
      ],
    }
  },
]

export function randomOrder(h: (id: string) => boolean, day: number): Order {
  // los primeros días solo pedidos sencillos
  const pool = day <= 1 ? TEMPLATES.slice(0, 3) : day <= 2 ? TEMPLATES.slice(0, 10) : TEMPLATES
  for (let i = 0; i < 30; i++) {
    const o = pick(pool)(h)
    if (o && o.reqs.length > 0) return o
  }
  return TEMPLATES[0](h)!
}
