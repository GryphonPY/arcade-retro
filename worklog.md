# Worklog

---
Task ID: 2
Agent: Super Z (main)
Task: Añadir sonido retro a todos los juegos + nuevo juego Hit & Run (pixel-art).

Work Log:
- Creado src/components/games/sfx.ts: sintetizador WebAudio (osciladores + buffer de ruido), sin archivos externos. Efectos: coin, start, eat, pellet, power, jump, land, shoot, pop, brick(row), bounce, explode, hurt, crash, levelUp, siren, boost, gameOver. Mute persistente en localStorage (arcade-muted).
- Integrados efectos de sonido en los 6 juegos existentes (snake: eat/gameOver/start; space: shoot/pop/explode/levelUp/start/gameOver; runner: jump/land/start/crash; maze: pellet/power/hurt/levelUp/start/gameOver; racer: start/crash/gameOver; bricks: pellet/bounce/brick/hurt/levelUp/start/gameOver).
- Nuevo juego src/components/games/hit-and-run.tsx: pixel-art ciudad nocturna. Embestir taxis (+150, sube búsqueda ★), patrullas que persiguen con sirena y barra de luces, turbo para escapar (+100 por patrulla superada), freno, blindaje 3, enfriamiento de búsqueda a los 9 s, partículas chunky, screen shake, matrices pixel para coches, edificios con ventanas deterministas, farolas con charcos de luz.
- page.tsx: 7ª tarjeta Hit & Run, subtítulo "Siete juegos", botón 🔊/🔇 global (hub + vista de juego), sfx.coin al seleccionar tarjeta.
- Corregido: import sfx duplicado en brick-breaker (lotes MultiEdit secuenciales) y sistema de puntuación de hit-and-run (metros + bonus separados con recalc()).
- Lint limpio. Verificación agent-browser: 7 tarjetas renderizan, Hit & Run jugable (PTS sube, estrellas de búsqueda aumentan al embestir), mute persiste en localStorage ("1"/"0"), brick-breaker sin errores, dev.log limpio.

Stage Summary:
- 7 juegos operativos con sonido chiptune opcional (mute persistente).
- hit-and-run.tsx añade mecánica hit & run completa sobre canvas pixel-art.
- Sin errores de runtime ni consola; lint 0 problemas.

---
Task ID: 1
Agent: Super Z (main)
Task: Crear página arcade con 6 mini-juegos de teclado (flechas/WASD), cada uno con diseño y temática distintos.

Work Log:
- Inicializado entorno fullstack (init-fullstack.sh), Next.js 16 + Tailwind 4 + shadcn/ui.
- Añadida fuente Press Start 2P vía next/font en layout.tsx; metadata en español (lang="es").
- Creados archivos compartidos en src/components/games/: use-keys.ts (hook flechas+WASD+Espacio con soporte táctil virtual), game-utils.ts (setupCanvas DPR, loadBest/saveBest localStorage, drawMatrix pixel-art, rr, aabb), touch-pad.tsx (cruceta táctil para punteros coarse).
- Juego 1 snake-neon.tsx: Snake synthwave (rejilla neón, degradado cian→magenta, cola de giros, velocidad progresiva).
- Juego 2 space-invasion.tsx: shooter pixel-art (matrices, oleadas, IA de disparo enemigo, estrellas parallax, vidas). Fix: arrancar partida con tecla (started no se activaba).
- Juego 3 desert-runner.tsx: endless runner cartoon (armadillo, salto/agacharse, cactus/rocas/buitres, sol, nubes, polvo).
- Juego 4 ghost-maze.tsx: laberinto tile-based 19x15 (movimiento continuo por casillas, buffer de giro, 3 fantasmas con IA de persecución, power pellets, niveles).
- Juego 5 traffic-racer.tsx: autopista top-down crepuscular (4 carriles, acelerón/freno, tráfico con faros, velocímetro, screen shake).
- Juego 6 brick-breaker.tsx: rompeladrillos pastel (5 filas de colores, ángulo según punto de impacto, estela, vidas-corazón, niveles).
- page.tsx: sala arcade oscura con líneas CRT, título pixel con glow, 6 tarjetas temáticas (cada una con paleta de su juego), récords por juego desde localStorage, ESC para volver, footer pegado.
- Lint: corregidos 8 avisos react-hooks/set-state-in-effect con disables documentados (lecturas legítimas de localStorage/matchMedia tras montar).
- Verificación con agent-browser: hub renderiza, fuente pixel carga, los 6 juegos abren y responden a teclado, game over + reinicio con Espacio OK, footer sticky OK, responsive móvil OK, sin errores de consola ni runtime en dev.log.

Stage Summary:
- Ruta única "/" con hub + vista de juego por estado (SPA). 6 juegos en src/components/games/.
- Todos los juegos: canvas 2D con DPR scaling, bucle RAF con dt acotado, controles flechas+WASD (+Espacio/Enter acción), récords en localStorage, overlays de inicio/fin, cruceta táctil en móvil.
- Lint limpio, servidor sin errores, interactividad verificada en navegador.

---
Task ID: 3
Agent: Super Z (main)
Task: Nuevo juego Gun & Run (run-and-gun pixel-art) + música chiptune de fondo por juego ("musiquitas").

Work Log:
- Creado src/components/games/music.ts: secuenciador chiptune WebAudio (bajo + melodía + percusión kick/snare/hat, rejilla de corcheas con soporte de nota sostenida '.'). 9 pistas compuestas: hub (chill C-Am-F-G), snake-neon (synthwave Am-F-C-G), space-invasion (driver Em), desert-runner (country bounce), ghost-maze (saltarín F-Dm-Bb-C), traffic-racer (dark wave Dm), brick-breaker (pastel G-Em-C-D), hit-and-run (funk Em), gun-and-run (acción heroica Am). Scheduler con lookahead (setInterval 40ms), pausa al silenciar (respeta arcade-muted de sfx.ts y su propia preferencia arcade-music), primeMusic() engancha el primer pointerdown/keydown para el autoplay policy.
- Creado src/components/games/gun-and-run.tsx (8º juego): run & gun de acción lateral pixel-art, selva al atardecer (sol retro con bandas, montañas/jungla parallax, cajas/rocas deterministas). Soldado con matrices pixel (torso 11x8 + piernas animadas 2 frames/salto/idle, flip horizontal), correr/saltar/disparar (ESPACIO con autocadencia), 3 enemigos: soldados (+100, disparan), drones que bombardean y sueltan power-ups (+150), torretas con cañón orientado al jugador (+250, hp 3). Power-ups: V = triple disparo 9s, botiquín = +1 vida. Plataformas atravesables desde arriba, cámara solo-avanza, zonas cada 300 m con cartela, partículas con gravedad, casquillos, screen shake, 3-4 vidas con invulnerabilidad parpadeante. Guarda récord en localStorage (gun-and-run).
- Corregidos durante el desarrollo: hp tipado en Soldier/Drone y filtros anti doble-puntuación con triple disparo; choque de dron ya no otorga puntos.
- page.tsx: 8ª tarjeta Gun & Run (paleta selva/atardecer), botón 🎵 MusicButton (tachado en rojo si off) junto al 🔊 en hub y vista de juego, efectos startMusic(activeId ?? 'hub') + primeMusic(), subtítulo "Siete juegos se quedaron cortos: ahora son ocho, con música chiptune en cada uno".
- layout.tsx: metadata actualizada a "8 mini-juegos con teclado y música chiptune".
- brick-breaker.tsx: restaurado disable comment de react-hooks/set-state-in-effect (se había perdido).
- Lint 0 problemas, tsc limpio en src/. Verificación agent-browser: 8 tarjetas, Gun & Run jugable (inicio, daño con corazones, game over "CAÍSTE EN COMBATE", reinicio con ENTER), toggle música persiste en localStorage ('0'/'1'), Snake sin regresiones, sin errores de consola ni en dev.log.

Stage Summary:
- 8 juegos operativos, cada uno con melodía chiptune propia + tema del hub; SFX y música conmuteables por separado (🔊 / 🎵) y persistentes.
- gun-and-run.tsx añade run & gun completo sobre canvas 640x360 pixel-art.
- Sin errores de runtime; lint y tsc limpios.

---
Task ID: 4
Agent: Super Z (main)
Task: Compatibilidad móvil completa de los 8 juegos (cruceta táctil, viewport, z-index del pad).

Work Log:
- Reescrito touch-pad.tsx: soporte multi-touch real (cada botón con pointer events propios), deslizar el dedo entre direcciones (releasePointerCapture en pointerdown + onPointerEnter con buttons>0 pulsa el botón de destino), pointerleave/up/cancel liberan, safe-area con env() para notch (bottom calc), botón de acción configurable (actionLabel/actionGlyph), tamaño 168-176px, tap-highlight desactivado.
- Añadido ?touch=1 como parámetro URL para forzar la cruceta (pruebas en escritorio y demo).
- Activado showAction en los 8 juegos con etiquetas contextuales: Gun & Run "Disparar", Rompe Ladrillos "Lanzar", Corredor "Saltar", resto "Acción" (antes solo space-invasion lo tenía: en móvil no se podía disparar/lanzar).
- Canvas de los 8 juegos con touch-none select-none (evita scroll/zoom accidental al jugar).
- Párrafos de puntos bajo el canvas ocultos en móvil (hidden sm:block).
- layout.tsx: export const viewport (device-width, initialScale 1, userScalable false, viewportFit cover).
- Bug corregido en page.tsx: el footer (z-10 tras main en el DOM) tapaba la cruceta fija (atrapada en el contexto de apilamiento de main z-10) y bloqueaba toques en ▼ y en el botón de acción; quitado z-10 del footer.
- Verificado con agent-browser + emulación iPhone 14 (390x844): meta viewport aplicado, cruceta visible en vista de juego, Gun & Run arranca y dispara con toques, Rompe Ladrillos lanza la bola y suma 10 pts, Snake gira/mueve con la cruceta, sin errores de consola. Lint limpio, servidor 200.

Stage Summary:
- Los 8 juegos jugables end-to-end en móvil: cruceta fija + botón de acción contextual, sin zoom accidental, safe-area, pad por encima del contenido.
- Parámetro ?touch=1 para ver/probar la cruceta en escritorio.
