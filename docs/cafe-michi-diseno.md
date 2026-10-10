# Café Michi — documento de diseño

Juego cozy de manejar un café atendido por gatitos (inspiración: **Cats & Soup**, Neko
Atsume, Good Coffee Great Coffee). Para jugar en pareja en el mismo iPad: los dos tocan la
misma pantalla a la vez (sin roles ni pantalla dividida).

## Bucle principal

1. Llegan **clientes** (animalitos) según la reputación del café, se sientan en una mesa
   libre y piden algo del menú (globo con el dibujo).
2. La **estación** que hace eso (cafetera, horno, tetera, licuadora, vitrina) lo prepara si
   tiene un **gatito asignado**. Sin gatito, solo avanza si ustedes la tocan.
3. Lo listo sale a la **barra de entrega**. Un gatito **mesero** lo lleva caminando a la
   mesa. Ustedes también pueden **arrastrarlo a mano** (+25 % de propina, y es más rápido).
4. El cliente come, se va contento y deja **monedas y corazones** en la mesa. Se recogen
   tocándolas (+10 %), o se recogen solas después de un rato.
5. **Apapachar**: tocar a un gatito que trabaja lo pone a doble velocidad unos segundos
   (corazones). Tocar a uno dormido lo despierta.
6. **Clientes VIP** (con coronita): piden dos cosas y pagan el triple.

Ritmo relajado: nadie se enoja feo. La paciencia es larga y, si se acaba, el cliente
solo se va sin pagar.

## Progresión

- **Menú**: recetas por estación. Desbloquear una receta trae pedidos nuevos; subirle nivel
  aumenta su precio.
- **Estaciones**: se compran (si la ampliación lo permite) y se mejoran (más velocidad).
- **Michis**: contratar (cada uno con nombre, color y personalidad), asignar trabajo
  (estación o mesero), entrenar (más velocidad) y **vestir** (moño, gorro de chef, boina,
  corona, flor, lentes, bufanda).
- **Local**: ampliaciones (más mesas, cocina, terraza, barra de ventana y jardín) y
  **decoración** (plantas, lámparas, cuadros, tapete y tema de pared y piso), que suben la
  reputación y con eso llegan más clientes.
- **Ganancias offline**: al volver, los michis ganaron monedas mientras no estaban (hasta
  6 h).

## Pantalla (800×560, horizontal)

- Pared con ventanas arriba y barra de estaciones (5 lugares).
- Barra de entrega a la derecha de las estaciones.
- Salón con 6 mesas, y terraza con 4 mesas a la derecha (si está comprada).
- Botones: Menú · Michis · Local (paneles HTML).

## Archivos

```
src/components/games/cafe-michi.tsx        — cascarón y paneles
src/components/games/cafe/content.ts       — recetas, estaciones, michis, ropa, decoración, ampliaciones
src/components/games/cafe/save.ts          — guardado (arcade-cafe-michi), con ganancias offline
src/components/games/cafe/draw.ts          — arte
src/components/games/cafe/scene.ts         — simulación, entrada multitáctil y dibujo
```
