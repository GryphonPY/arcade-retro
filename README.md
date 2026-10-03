# Arcade Retro

Sala de juegos arcade para el navegador: **17 juegos** hechos desde cero con Canvas 2D, música chiptune generada en tiempo real con WebAudio, controles táctiles pensados para el celular y una **tabla de récords mundial**.

Sin anuncios, sin cuentas y sin descargas: solo eliges un apodo para aparecer en el salón de la fama. Se puede instalar como app y jugar sin conexión.

**Juega aquí:** https://arcade-retro-cool.periwinkle-cookie.workers.dev/

## Juegos

| Juego | Género | De qué trata |
| :-- | :-- | :-- |
| **Duelo Pong** | Versus | Contra la máquina o contra un amigo en el mismo celular. |
| **Defensa Final** | Defensa | Toca el cielo para detonar misiles y protege tus ciudades. |
| **Horda Nocturna** | Supervivencia | Solo te mueves: tus armas atacan solas. Sube de nivel y combínalas. |
| **Bloques** | Puzle | Piezas que caen, con guardar pieza, pieza fantasma, T-spins y combos. |
| **Flap Pixel** | Un botón | Aletea entre tuberías. Medallas de bronce a platino. |
| **Cruza el Camino** | Esquiva | Avanza sin fin entre carreteras, ríos con troncos y vías de tren. |
| **Torre Neón** | Precisión | Apila bloques. Los encajes perfectos encadenan combos. |
| **Asteroid Drift** | Shooter vectorial | Física inercial en 360°, asteroides que se parten y ovnis. |
| **Cyber Dungeon** | Mazmorra rogue | Pisos generados al azar, espada, mejoras y jefes. |
| **Snake Neón** | Clásico | La serpiente de siempre, con combos y power-ups. |
| **Invasión Espacial** | Matamarcianos | Oleadas, picadas, búnkers destructibles y jefes. |
| **Corredor del Desierto** | Endless runner | Saltos, monedas, power-ups y ciclo día/noche. |
| **Laberinto Fantasma** | Laberinto | Fantasmas con personalidad propia, como en el original. |
| **Carrera de Tráfico** | Carreras | Esquiva coches; rozarlos llena el turbo. |
| **Rompe Ladrillos** | Paleta | Niveles con patrones, ladrillos especiales y power-ups. |
| **Hit & Run** | Persecución | Embiste taxis y escapa de la policía. |
| **Gun & Run** | Run & gun | Acción lateral con armas, jefes y rehenes. |

## Controles

| | Teclado | Celular |
| :-- | :-- | :-- |
| Mover | Flechas o `WASD` | Cruceta (desliza el pulgar) |
| Acción principal | `Espacio`, `Enter`, `Z` o `J` | Botón **A** |
| Acción secundaria | `Shift`, `X` o `K` | Botón **B** |
| Pausa | `P` | Botón de pausa (arriba) |
| Salir al menú | `Esc` | Flecha atrás |

Cada juego explica sus controles en su pantalla de inicio y en el botón **?**. Puedes abrir un juego directo con su enlace, por ejemplo `/#bloques`.

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build      # genera el sitio estático en ./out
npx wrangler dev   # sitio + API de récords con una base D1 local (después de build)
```

En `npm run dev` la tabla mundial no aparece porque la API vive en el Worker; para probarla usa `npx wrangler dev`.

### Estructura

```
worker/index.ts           Worker de Cloudflare: sirve el sitio y la API /api/scores (D1)
src/
  app/                    página única (sala + juego activo)
  components/arcade/      sala principal, vista de juego, ajustes, récords y tabla mundial
  components/games/       un archivo por juego + piezas compartidas
    catalog.ts            lista de juegos (nombre, controles, colores)
    game-screen.tsx       escala la pantalla del juego al espacio disponible
    juice.ts              temblor de cámara, hit-stop, partículas, textos flotantes
    overlay.tsx           pantallas de inicio, fin de partida y marcador
    touch-pad.tsx         mando táctil
    use-keys.ts           teclado + mando táctil unificados
    sfx.ts / music.ts     efectos y música chiptune con WebAudio
```

### Agregar un juego

1. Crea `src/components/games/<id>.tsx` siguiendo la estructura de cualquier juego existente (`useKeys`, `GameScreen`, `TouchPad`, overlays).
2. Agrega su portada en `src/components/games/badges/<id>.tsx` y regístrala en `cartridge-badge.tsx`.
3. Añade la entrada en `catalog.ts` y el import dinámico en `components/arcade/game-view.tsx`.

## Tabla de récords mundial

`worker/index.ts` expone `GET /api/scores` (top 3 de cada juego), `GET /api/scores?game=<id>` (top 10) y `POST /api/scores` (`{ game, name, score }`). Guarda la mejor puntuación de cada apodo por juego en Cloudflare D1. Los apodos tienen de 2 a 16 caracteres y pasan por un filtro de palabras; hay un límite de envíos por minuto por IP (guardada solo como hash). Como los juegos corren en el navegador, la tabla no es a prueba de tramposos expertos.

La base (`arcade-retro-scores`) no necesita configuración: Wrangler la crea sola en el primer deploy y el Worker crea sus tablas en la primera petición. Si la base no existe, la API responde 503 y el sitio funciona igual, sin la tabla mundial.

## Despliegue

El sitio es 100% estático (`output: 'export'`) y se publica en https://arcade-retro-cool.periwinkle-cookie.workers.dev/ mediante Cloudflare Workers Builds, conectado al repo: cada push a `main` se compila y publica solo. El workflow de GitHub Actions corre lint, typecheck y build en cada push y pull request.

## Autor

[@GryphonPY](https://github.com/GryphonPY) · Licencia [MIT](LICENSE)
