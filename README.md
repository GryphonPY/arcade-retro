# 🕹️ Neo•Arcade MVS (Multi Video System)

<p align="center">
  <img src="https://img.shields.io/badge/Neo--Geo-MVS%20100M-red?style=for-the-badge&logo=retroarch&logoColor=white" alt="Neo-Geo MVS" />
  <img src="https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/WebAudio-Stereo%20Chiptune-f59e0b?style=for-the-badge&logo=audio&logoColor=white" alt="WebAudio" />
  <img src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-f97316?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Pages" />
</p>

<p align="center">
  <b>Una cabina recreativa arcade completa en la web con 10 cartuchos clásicos desarrollados en Canvas 2D nativo, música chiptune procedural, audio 8-bit sintetizado y soporte táctil arcade responsivo para móviles y escritorio.</b>
</p>

---

## ✨ Características Principales

- 🎮 **10 Cartuchos Clásicos Completos**: Desde clones retro inerciales hasta mazmorras roguelike, carreras nocturnas y plataformas de acción.
- 📺 **Filtro CRT Scanlines Auténtico**: Efecto de curvatura de tubo catódico, viñeta y líneas de barrido RGB 15kHz activables con un botón.
- 🪙 **Monedero Arcade Realista**: Sistema interactivo con pulsador `25¢ INSERT COIN`, sonido vintage de moneda y desbloqueo de `FREE PLAY`.
- 🕹️ **Controles Híbridos Universales**:
  - **Teclado**: Flechas direccionales, `WASD`, `ESPACIO`, `SHIFT`, `P` (Pausa), `ESC` (Volver al menú).
  - **Móviles**: Cruceta japonesa D-Pad y pulsadores de botón tipo Sanwa acoplados sin solapamiento ni desbordamiento de pantalla (vista *fullscreen 100dvh* sin scroll).
- 🔊 **Sintetizador WebAudio Chiptune**: Efectos de sonido y melodías 8-bit generadas proceduralmente en tiempo real, sin archivos de audio externos pesados.
- 💾 **Persistencia Local de Récords**: Puntuaciones máximas y preferencias guardadas automáticamente en `localStorage`.

---

## 👾 Catálogo de los 10 Cartuchos

| Cartucho | Título | Género / Estilo | Controles Clave |
| :--- | :--- | :--- | :--- |
| **NGM-009** | **Asteroid Drift 360°** | Física Espacial Inercial Vectorial | `← →` Rotación · `↑` Empuje · `ESPACIO` / `A` Láser · `↓` / `B` Warp |
| **NGM-010** | **Cyber Dungeon Slayer** | Mazmorra Rogue / Slash RPG | `WASD` / Flechas · `ESPACIO` / `A` Espada · `SHIFT` / `B` Poción |
| **NGM-001** | **Snake Neón** | Synthwave Clásico | `↑ ↓ ← →` / `WASD` · `ESPACIO` / `A` Iniciar |
| **NGM-002** | **Invasión Espacial** | Matamarcianos Clásico Pixel Art | `← →` Mover · `ESPACIO` / `A` Disparo láser · OVNI nodriza bonus |
| **NGM-003** | **Corredor del Desierto** | Endless Runner Plataformas | `↑` / `A` Salto · `↓` / `B` Agacharse |
| **NGM-004** | **Laberinto Fantasma** | Arcade de Laberinto Clásico | `↑ ↓ ← →` / `WASD` · Bolitas de poder y fantasmas asustados |
| **NGM-005** | **Carrera de Tráfico** | Asfalto Nocturno / Esquiva | `← →` Carril · `↑` / `T` Turbo acelerón · `↓` Freno |
| **NGM-006** | **Rompe Ladrillos** | Paleta y Prisma Neón | `← →` Mover paleta · `ESPACIO` / `A` / Click lanzar bola |
| **NGM-007** | **Hit & Run** | Persecución en la Ciudad Pixel | `WASD` / Flechas · Embiste taxis · `↑` / `T` Turbo escape |
| **NGM-008** | **Gun & Run** | Run 'n Gun / Acción Selva | `← →` Correr · `A` / `ESPACIO` Disparo · `B` / `↑` Salto |

---

## 🛠️ Stack Tecnológico

- **Framework**: [Next.js 16](https://nextjs.org/) con App Router y exportación estática (`output: 'export'`).
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) con tipado estricto en todas las mecánicas de juego.
- **Renderizado**: HTML5 Canvas 2D con ajuste adaptativo de DPI para pantallas Retina/HiDPI.
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) y fuentes pixel art retro.
- **Audio**: Web Audio API nativa con osciladores `square`, `triangle`, `sawtooth` y generador de ruido para explosiones.
- **Despliegue**: [Cloudflare Pages](https://pages.cloudflare.com/) mediante integración continua (CI/CD) vinculada a la rama `main`.

---

## 🚀 Instalación y Desarrollo Local

Si deseas clonar y ejecutar la cabina en tu máquina:

```bash
# 1. Clonar el repositorio
git clone https://github.com/GryphonPY/arcade-retro.git
cd arcade-retro

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Compilar para Producción

```bash
npm run build
```

Genera la versión optimizada en la carpeta `./out`, lista para alojarse en cualquier CDN o servicio estático (Cloudflare Pages, Vercel, GitHub Pages, Netlify).

---

## 📱 Experiencia en Móviles

El proyecto cuenta con un diseño responsivo especial para teléfonos inteligentes:
- **Detección Automática de Dispositivo Táctil**: Activa el mando arcade virtual solo en pantallas táctiles (`pointer: coarse`).
- **Pantalla Completa 100dvh**: Desactiva el desplazamiento de ventana dentro de las partidas para evitar interrupciones al tocar la cruceta.
- **Controles Acoplados al Fondo**: El D-Pad y los botones Sanwa se anclan debajo del canvas sin superponerse a la acción ni a las pantallas de Game Over.

---

## 👤 Autor

- GitHub: [@GryphonPY](https://github.com/GryphonPY)

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
