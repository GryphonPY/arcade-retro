/** Clientes recurrentes con mini historias (cada visita avanza su arco). */
import type { Animal } from './draw'
import type { Order, Req, ReqW } from './orders'

type Has = (id: string) => boolean
interface Visit {
  /** Día a partir del cual puede llegar. */
  day: number
  intro: string
  order: (h: Has) => Order
  love?: string
  ok?: string
  bad?: string
  /** Visita final del arco. */
  final?: boolean
}
export interface StoryChar {
  id: string
  name: string
  animal: Animal
  fur: string
  visits: Visit[]
}

const q = (r: Req, w: number, hint: string): ReqW => ({ r, w, hint })
const ord = (text: string, ...reqs: (ReqW | false)[]): Order => ({ text, reqs: reqs.filter(Boolean) as ReqW[] })

export const STORY: StoryChar[] = [
  {
    id: 'coneja',
    name: 'Doña Coneja',
    animal: 'conejo',
    fur: '#ffffff',
    visits: [
      {
        day: 1,
        intro: '¡Hola, mija! Soy tu vecina.',
        order: () => ord('¿Uno de vainilla con crema blanca y fresitas?', q({ k: 'flavor', v: 'vainilla' }, 2, 'No era de vainilla'), q({ k: 'frost', v: 'blanca' }, 2, 'Era crema blanca'), q({ k: 'min', t: 'fresa', n: 3 }, 1, 'Más fresitas')),
        love: '¡Como los que hacía mi mamá! Vuelvo pronto.',
      },
      {
        day: 3,
        intro: 'Mi nieto Beto viene a verme.',
        order: () => ord('Le encanta el chocolate con chispas, y somos 4.', q({ k: 'flavor', v: 'chocolate' }, 2, 'Beto quería chocolate'), q({ k: 'min', t: 'chispas', n: 6 }, 1, 'Más chispas'), q({ k: 'slices', n: 4 }, 2, 'Éramos 4')),
        love: '¡Beto se va a volver loco!',
      },
      {
        day: 6,
        intro: 'Beto dice que eres la mejor pastelera.',
        order: (h) => ord('Uno mitad blanco, mitad rosa, como mi delantal.', q({ k: 'halfFrost', a: 'blanca', b: 'rosa' }, 3, 'Mitad blanco, mitad rosa'), h('corazon') && q({ k: 'min', t: 'corazon', n: 2 }, 1, 'Unos corazoncitos')),
      },
      {
        day: 7,
        final: true,
        intro: '¡Hoy Beto cumple 7 años!',
        order: () => ord('7 velitas, muchas chispas y que se vea feliz.', q({ k: 'count', t: 'vela', n: 7 }, 3, 'Eran 7 velitas'), q({ k: 'min', t: 'chispas', n: 8 }, 1, 'Más chispas'), q({ k: 'frostAny' }, 1, 'Le faltó crema')),
        love: '¡El mejor cumpleaños! Beto te mandó un dibujo de ti.',
      },
    ],
  },
  {
    id: 'bigotes',
    name: 'Don Bigotes',
    animal: 'gato',
    fur: '#d6c4b0',
    visits: [
      {
        day: 2,
        intro: 'Hmph. Otra pastelería nueva.',
        order: () => ord('Nada de rosa. Nada de cursilerías. Y entero.', q({ k: 'noFrostColor', v: 'rosa' }, 3, '¡Rosa! Qué horror'), q({ k: 'slices', n: 1 }, 1, 'Dije entero'), q({ k: 'frostAny' }, 1, 'Sin crema, qué tristeza')),
        love: '...No está mal. No se acostumbre.',
        bad: 'Lo sabía. Hmph.',
      },
      {
        day: 4,
        intro: 'Volví. No porque me haya gustado, eh.',
        order: () => ord('Chocolate. Bien dorado. Sin tonterías encima.', q({ k: 'flavor', v: 'chocolate' }, 2, 'Era chocolate'), q({ k: 'bake', v: 'dorado' }, 2, 'Lo quería dorado'), q({ k: 'plain' }, 1, 'Dije sin tonterías')),
        love: 'Hmph... está bueno. Muy bueno.',
      },
      {
        day: 8,
        intro: 'Mi esposa... le encantaban las flores.',
        order: (h) =>
          h('flor')
            ? ord('Uno con flores. Por ella.', q({ k: 'min', t: 'flor', n: 4 }, 3, 'Faltaron flores'), q({ k: 'frost', v: 'blanca' }, 1, 'A ella le gustaba blanco'))
            : ord('Uno blanco con fresas. Como el de nuestra boda.', q({ k: 'frost', v: 'blanca' }, 2, 'Era blanco'), q({ k: 'min', t: 'fresa', n: 5 }, 2, 'Faltaron fresas')),
        love: '...Gracias. De verdad.',
      },
      {
        day: 12,
        final: true,
        intro: 'Hoy es mi cumpleaños. Nadie lo sabe.',
        order: () => ord('Una sola velita. Lo que usted quiera.', q({ k: 'count', t: 'vela', n: 1 }, 3, 'Era una velita'), q({ k: 'frostAny' }, 1, 'Sin crema...'), q({ k: 'many', n: 4 }, 1, 'Se ve solito')),
        love: '...Hace años que no sonreía. Gracias, amiga.',
      },
    ],
  },
  {
    id: 'patos',
    name: 'Pato y Pata',
    animal: 'pato',
    fur: '#fffbea',
    visits: [
      {
        day: 3,
        intro: '¡Nos casamos pronto! Estamos probando pasteles.',
        order: () => ord('Mitad blanco, mitad rosa, para decidir.', q({ k: 'halfFrost', a: 'blanca', b: 'rosa' }, 3, 'Era mitad y mitad')),
        love: '¡Cuac! ¡Nos encantan los dos!',
      },
      {
        day: 5,
        intro: 'Pata quiere fresas, yo chocolate...',
        order: () => ord('Pan de chocolate y fresas solo en su mitad.', q({ k: 'flavor', v: 'chocolate' }, 2, 'Era de chocolate'), q({ k: 'halfTop', t: 'fresa' }, 3, 'Las fresas en una mitad')),
      },
      {
        day: 9,
        intro: 'Ensayo general para la boda.',
        order: () => ord('Blanco, elegante, sin fruta y en 8 rebanadas.', q({ k: 'frost', v: 'blanca' }, 2, 'Era blanco'), q({ k: 'noFruit' }, 1, 'Sin fruta'), q({ k: 'slices', n: 8 }, 2, 'Eran 8 rebanadas')),
      },
      {
        day: 14,
        final: true,
        intro: '¡HOY ES LA BODA!',
        order: (h) =>
          ord(
            'El pastel de nuestras vidas: blanco, bonito y para 8.',
            q({ k: 'frost', v: 'blanca' }, 3, 'Era blanco'),
            q({ k: 'slices', n: 8 }, 2, 'Eran 8 rebanadas'),
            h('flor') ? q({ k: 'min', t: 'flor', n: 3 }, 1, 'Unas flores') : q({ k: 'min', t: 'fresa', n: 4 }, 1, 'Unas fresas'),
            q({ k: 'variety', n: 2 }, 1, 'Algo más de adorno'),
          ),
        love: '¡Cuac cuac! ¡La mejor boda del pueblo! Están invitadas.',
      },
    ],
  },
  {
    id: 'toto',
    name: 'Osito Toto',
    animal: 'oso',
    fur: '#d9a77a',
    visits: [
      {
        day: 2,
        intro: '¡Hola! ¡Tengo 5 años y medio!',
        order: () => ord('¡Uno de chocolate con muuuchas chispas!', q({ k: 'flavor', v: 'chocolate' }, 2, '¡Era de chocolate!'), q({ k: 'min', t: 'chispas', n: 10 }, 2, '¡Más chispas!')),
        love: '¡¡WAAA!! ¡Es el mejor pastel del mundo mundial!',
      },
      {
        day: 6,
        intro: '¡Mañana es mi fiesta! Este es de prueba.',
        order: () => ord('¡6 velitas porque voy a cumplir 6!', q({ k: 'count', t: 'vela', n: 6 }, 3, '¡Eran 6!'), q({ k: 'flavor', v: 'chocolate' }, 1, 'Chocolate, porfi')),
      },
      {
        day: 10,
        intro: '¡Ahora me gustan los dinosaurios!',
        order: (h) =>
          h('menta')
            ? ord('¡Uno verde como dinosaurio!', q({ k: 'frost', v: 'menta' }, 3, '¡Tenía que ser verde!'), q({ k: 'many', n: 5 }, 1, 'Más cositas'))
            : ord('¡Uno con escamitas de chispas!', q({ k: 'min', t: 'chispas', n: 12 }, 3, '¡Más escamitas!')),
        love: '¡RAAAWR! ¡Me encanta!',
      },
    ],
  },
  {
    id: 'rita',
    name: 'Rana Rita',
    animal: 'rana',
    fur: '#86efac',
    visits: [
      {
        day: 4,
        intro: 'Hola, soy Rita, influencer de postres.',
        order: () => ord('¿Me haces algo súper aesthetic? Variado y bonito.', q({ k: 'variety', n: 3 }, 2, 'Le faltó variedad'), q({ k: 'frostAny' }, 1, 'Sin crema no es aesthetic'), q({ k: 'many', n: 7 }, 1, 'Muy vacío para la foto')),
        love: '¡Foto! Esto va directo a mi perfil.',
      },
      {
        day: 8,
        intro: '¡Mis seguidores aman tus pasteles!',
        order: (h) => ord('Uno de dos colores con un montón de cosas.', q({ k: 'halfFrost', a: h('lila') ? 'lila' : 'rosa', b: 'blanca' }, 2, `Mitad ${h('lila') ? 'lila' : 'rosa'}, mitad blanco`), q({ k: 'many', n: 10 }, 2, 'Más cosas')),
      },
      {
        day: 11,
        final: true,
        intro: '¡Mega colab! Te van a conocer en todo el país.',
        order: () => ord('Que sea un ARCOÍRIS de adornos.', q({ k: 'variety', n: 5 }, 3, 'Faltaron colores'), q({ k: 'many', n: 12 }, 2, 'Más, más, más')),
        love: '¡Un millón de likes! Ya eres famosa, amiga.',
      },
    ],
  },
  {
    id: 'buho',
    name: 'Señor Búho',
    animal: 'buho',
    fur: '#c8a27a',
    visits: [
      {
        day: 5,
        intro: 'Soy crítico gastronómico.',
        order: () => ord('Sorpréndame. Pero sin errores: horneado perfecto y 6 rebanadas parejas.', q({ k: 'bake', v: 'punto' }, 2, 'El horneado no fue perfecto'), q({ k: 'slices', n: 6 }, 2, 'Eran 6 rebanadas'), q({ k: 'frostAny' }, 1, 'Sin crema, insípido')),
        love: 'Mmm. Excelente técnica. Tomo nota.',
        bad: 'Mmm. Mediocre. Tomo nota.',
      },
      {
        day: 10,
        intro: 'Segunda visita. Espero el mismo nivel.',
        order: (h) =>
          ord(
            h('redvelvet') ? 'Un red velvet con crema blanca, en 8.' : 'Vainilla con crema blanca, en 8.',
            q({ k: 'flavor', v: h('redvelvet') ? 'redvelvet' : 'vainilla' }, 2, 'No era el sabor'),
            q({ k: 'frost', v: 'blanca' }, 2, 'Era crema blanca'),
            q({ k: 'slices', n: 8 }, 1, 'Eran 8'),
          ),
      },
      {
        day: 13,
        final: true,
        intro: 'Mi reseña final depende de esto.',
        order: () => ord('Horneado perfecto, crema impecable y nada de fruta.', q({ k: 'bake', v: 'punto' }, 2, 'El horneado...'), q({ k: 'frostAny' }, 2, 'La crema...'), q({ k: 'noFruit' }, 1, 'Dije sin fruta')),
        love: '★★★★★ "La mejor pastelería del pueblo". Firmado: Búho.',
      },
    ],
  },
]

/** Visitas de historia que tocan hoy según el progreso de cada personaje. */
export function storyFor(day: number, progress: Record<string, number>) {
  const out: { ch: StoryChar; visit: Visit; idx: number }[] = []
  for (const ch of STORY) {
    const idx = progress[ch.id] ?? 0
    const v = ch.visits[idx]
    if (v && v.day <= day) out.push({ ch, visit: v, idx })
  }
  // los finales primero; máximo 3 historias por día
  return out.sort((a, b) => Number(!!b.visit.final) - Number(!!a.visit.final) || a.visit.day - b.visit.day).slice(0, 3)
}
