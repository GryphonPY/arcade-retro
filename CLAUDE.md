@AGENTS.md

# Forma de trabajo (preferencia fija del dueño del repo)

- Claude Opus es siempre el orquestador: planea, reparte, revisa e integra.
- Todo el trabajo de implementación lo hacen subagentes con el modelo Haiku
  (herramienta Agent con `model: haiku`). El orquestador no programa los
  cambios directamente; revisa lo que entregan, verifica (lint, tipos, build)
  y sube a `main`.

# Trato con el usuario

- No usar "wey" ni muletillas similares en las respuestas.
