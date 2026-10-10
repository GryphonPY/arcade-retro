# Pastelería en Pareja — documento de diseño

Clon de **Good Pizza, Great Pizza** pero de pasteles, tierno, para jugar en pareja en el
mismo iPad (los dos tocan la misma pantalla al mismo tiempo, sin pantalla dividida).

## Lo que lo hace divertido (lo que NO debe perderse)

1. **Todo es táctil y físico**: la masa se vierte manteniendo el tazón sobre el molde,
   la crema se **unta con la espátula** pasando el dedo (se ve lo que cubres), los adornos
   se echan a **puños** que caen esparcidos, el pastel se **arrastra** al horno y se saca a
   tiempo, se **corta** deslizando el cuchillo. Nada de menús de opciones.
2. **Pedidos con personalidad**: el cliente lo dice a su manera ("Uno que parezca nube",
   "Fresas de un lado y nada del otro", "Que no se vea rosa, odio el rosa"). Interpretar es
   parte del juego. Se puede preguntar "¿Cómo?" (lo repite más claro) o "No puedo"
   (rechazar si te falta un ingrediente).
3. **Sin reloj**: ritmo relajado como Good Pizza. Lo que cuenta es qué tan bien quedó.
4. **Clientes recurrentes con mini historias** que avanzan día a día.
5. **Progresión que se ve**: comprar ingredientes trae pedidos nuevos; el equipo hace más
   fácil la cocina; la decoración cambia el local.

## Pantalla (mundo lógico 800×560, horizontal; el iPad es el objetivo)

```
┌───────────┬──────────────────────────────┬────────────┐
│ CLIENTE   │   MESA 1        MESA 2       │  HORNO     │
│ (animal + │   (pastel visto desde arriba)│  2 rejillas│
│  globo)   │                              │            │
│ ¿Cómo?    │                              │ ENTREGAR → │
│ No puedo  │                              │ (caja)     │
├───────────┴──────────────────────────────┴────────────┤
│ tazones de masa | botes de crema + espátula | adornos  │
│                 | cuchillo | basura                    │
└────────────────────────────────────────────────────────┘
```

- **Dos mesas** y **dos rejillas** de horno: mientras uno decora, el otro hornea.
- **Multitáctil**: cada dedo es independiente; los dos pueden untar, echar adornos o
  arrastrar a la vez.
- En modo 2 jugadores pueden llegar **dos clientes a la vez** (dos lugares en el mostrador).

## Flujo de un pastel

| Paso | Gesto | Detalle |
|---|---|---|
| Masa | arrastrar un tazón a una mesa vacía y **mantener** | el molde se llena; ideal 85–105 %; si se pasa, se derrama (feo) |
| Hornear | arrastrar el molde a una rejilla | color: crudo → dorado → quemado. Ideal 0.9–1.15; "doradito" 1.05–1.25; "suavecito" 0.85–1.0 |
| Sacar | arrastrar de la rejilla a una mesa | |
| Crema | tocar un bote (elige color) y untar con el dedo | rejilla de cobertura 32×32; se puede hacer mitad y mitad |
| Adornos | arrastrar desde el bote y soltar | cae un puño de 3 piezas esparcidas; arrastrar una pieza la mueve; fuera del pastel = se cae |
| Cortar | tocar el cuchillo y deslizar a través del pastel | cada corte pasa por el centro y suma 2 rebanadas |
| Entregar | arrastrar el pastel al cliente | se califica y paga |
| Basura | arrastrar a la basura | empezar de nuevo |

## Pedidos y calificación

Cada pedido es una lista de **requisitos con peso** que se evalúan sobre el pastel:
sabor, horneado, color de crema (completo o por mitades), cobertura, cantidad de un
adorno (exacta, mínima o cero), adornos por mitad, variedad, rebanadas, "sin X".
Además hay **calidad general** (no crudo/quemado, crema bien untada, sin derrames).

`satisfacción = 75 % requisitos + 25 % calidad`. Paga = precio base del sabor +
propina según satisfacción × bonus de decoración. Reacciones: <45 triste, 45–69 bien,
70–89 feliz, ≥90 enamorado (corazones, confeti).

Los pedidos se generan con **plantillas** según lo desbloqueado (nunca piden algo que no
tienes, salvo a propósito para que practiques "No puedo").

## Clientes recurrentes (mini historias)

| Personaje | Gusto | Arco |
|---|---|---|
| **Doña Coneja** (abuelita) | clásicos: vainilla, crema blanca, fresas | cuenta de su nieto; final: cumple del nieto |
| **Don Bigotes** (gato gruñón) | exigente, pide al revés ("nada de rosa") | se va ablandando; final: sonríe por primera vez |
| **Pato y Pata** | prueban sabores para su boda | final: pastel de bodas (blanco, flores, 8 rebanadas) |
| **Osito Toto** | chocolate y velas = su edad | final: su fiesta |
| **Rana Rita** (influencer) | "aesthetic": colores pastel, mucha variedad | final: te hace famosa (más clientes) |
| **Señor Búho** (crítico) | horneado perfecto, nada de errores | final: reseña de 5 estrellas |

El resto de clientes son animalitos al azar con pedidos de plantilla.

## Progresión

- **Mapa de días** por capítulos (7 días cada uno; el día 7 es un evento especial).
  Cada día: 6–8 clientes. Estrellas 1–3 según satisfacción promedio. Se pueden repetir.
- **Tienda** entre días:
  - *Ingredientes*: sabores (fresa, red velvet, matcha), cremas (chocolate, lila, menta,
    limón, cielo), adornos (cereza, arándano, bombón, corazón, estrella, flor, galleta,
    macaron, kiwi, vela). Cada compra habilita pedidos nuevos.
  - *Equipo*: horno turbo (2 niveles), campanita del horno (marca el punto ideal),
    espátula grande, guía de corte, segunda rejilla.
  - *Decoración* (se ve en el local y sube propinas): papel tapiz, piso, plantas,
    cuadros, letrero, lámparas.
- **Recetario**: pasteles con nombre (Selva Negra, Nube Rosa, Arcoíris, Jardín, Bodas…)
  que se descubren al hacer uno que cumpla su receta. Álbum con %.
- Guardado en `localStorage` (`arcade-pasteleria-v1`), sincronizado con la nube.

## Arquitectura

```
src/components/games/pasteleria.tsx        — cascarón: pantallas (mapa, día, tienda, recetario)
src/components/games/pasteleria/
  content.ts   — ingredientes, equipo, decoración, recetas, personajes, días
  cake.ts      — modelo del pastel: masa, horneado, crema (rejilla), adornos, cortes
  orders.ts    — plantillas de pedidos y calificación
  save.ts      — guardado
  draw.ts      — arte (Opus)
  kitchen.ts   — el día: entrada multitáctil, bucle, clientes
  ui.tsx       — mapa, tienda, recetario, resumen (HTML)
```

## Fases

1. **Cocina táctil** (masa, horno, crema, adornos, cortes, entrega) con pedidos de
   plantilla y calificación. Probar en iPad simulado con dos dedos.
2. **Mapa, tienda, guardado**: días, estrellas, compras que cambian la cocina.
3. **Personajes y mini historias** + eventos de fin de capítulo.
4. **Recetario y decoración visible**; pulido de arte y sonido.
