# Aula Quiz (antes NeuroQuiz)

Juego educativo tipo Kahoot para usar en clase con alumnado de FP. El profesor
proyecta las preguntas y los alumnos responden desde el móvil en tiempo real;
la rapidez puntúa y al final hay ranking y podio. Una clase: hasta 30 alumnos
a la vez más el proyector.

Contexto completo del punto de partida: `docs/AUDITORIA.md`. Prompts de cada
fase: `docs/prompts/`. Guía de diseño obligatoria de la versión nueva:
`docs/diseno-aula-quiz.md` (opciones identificadas por **letra A-D y color**,
nunca por formas geométricas).

Conviven dos versiones hasta la fase 4:

- **v1 «NeuroQuiz»** en la raíz (`server.js`, `index.html`, `styles.css`): no
  se modifica.
- **v2 «Aula Quiz»** en `app/`: la reescritura.

## Arquitectura actual (v1, rama `main`)

- `server.js`: Node + Express + Socket.IO. Sirve los estáticos, recibe un PDF
  en `POST /upload`, genera las preguntas con OpenAI (`gpt-4o`) y lleva toda
  la lógica de partida. El estado vive en memoria (`games`).
- `index.html`: toda la interfaz (vistas que se muestran y ocultan) con el JS
  en línea. `styles.css`: sistema de diseño oscuro «neón».
- El temporizador corre en el navegador del profesor; el servidor no
  controla el tiempo.
- Despliegue previsto en Render (`render.yaml`). No es compatible con Vercel.

## Arquitectura objetivo (v2, carpeta `app/`, rama `v2`)

- **Web estática en Vercel**, sin servidor propio encendido todo el tiempo.
- **El navegador del profesor es el árbitro**: guarda el estado de la partida
  (y lo persiste para sobrevivir a una recarga), marca inicio y fin de cada
  pregunta con su reloj, calcula los puntos y decide qué ve cada móvil.
- **Los móviles solo envían su respuesta**. Nunca reciben la correcta antes de
  que el profesor la revele. Cada alumno tiene un identificador secreto para
  que nadie responda por otro y puede volver a entrar con su puntuación.
- **Servicio de tiempo real externo y gratuito: Ably** (plan Free, decidido el
  2026-10-28; ver `docs/decision-tiempo-real.md`). Solo transporta mensajes.
  Ninguna clave privada en el frontend: si hace falta, una función pequeña de
  Vercel emite credenciales temporales.
- **Mazos de preguntas guardados** con el formato de «Aula Trivial» (v1), para
  que los mismos archivos sirvan en los dos juegos.
- La generación desde PDF vuelve en la fase 6, protegida.

## Estructura de `app/`

- Vite 8 + React 19 + TypeScript 5.9 + Tailwind 4 + zod 4 + vitest 4.1 +
  ESLint 10. Node 24 (`app/.nvmrc` y `engines`). vitest 5 no admite Node 25
  (el del Mac de Fran), por eso se usa la 4.1.
- `src/index.css`: colores, radios y fuentes de la guía en el `@theme` de
  Tailwind (`bg-fondo`, `bg-superficie`, `text-acento`, `bg-opcion-a`…). Las
  fuentes (Bricolage Grotesque y Figtree) se alojan en la app con
  `@fontsource-variable`, sin Google Fonts.
- `src/mazo/`: formato de mazo copiado del Trivial (ver abajo).
- `mazos/`: mazos incluidos, empaquetados al compilar (`import.meta.glob`).
- `src/biblioteca/`: incluidos + importados (localStorage,
  `aula-quiz:mazos-importados`), importar, exportar y borrar. Todo mazo se
  valida cada vez que se carga.
- `src/partida/configuracion.ts`: filtros, combinaciones posibles, ajustes y
  selección de preguntas (funciones puras). Prioridad: categorías → número →
  dificultad. Las opciones de cada pregunta se barajan al crear la partida.
- `src/partida/PanelConfiguracion.tsx` y `ResumenPartida.tsx`: pantallas del
  profesor. El resumen se ve en el proyector: nunca muestra las correctas.

## Formato de mazo (copia del Trivial)

`app/src/mazo/` es una **copia** del formato v1 de Aula Trivial
(`fcarros/Trivial-Antigravity`, rama `v2`, commit `b7f3936`, 2026-10-13):
`mazo.ts`, `colores.ts`, `azar.ts` y `mazo.test.ts` sin cambios, y
`crearMazo()` de `pruebas.ts`. No se cambian sus reglas aquí: si el formato
evoluciona, se cambia en el Trivial y se vuelve a copiar. Detalle y forma de
comprobarlo en `app/src/mazo/ORIGEN.md`. Documentación: `docs/formato-mazo.md`.

## Fases

1. Limpieza, cimientos y decisión de tiempo real ✓
2. Nuevo proyecto, mazos y configuración de partida ✓
3. **Tiempo real y motor de partida** ← siguiente
3. Tiempo real y motor de partida
4. Publicación en Vercel y prueba de carga
5. Interfaz
6. Generador desde PDF

## Comandos

Versión nueva (desde `app/`):

```bash
npm install            # instalar dependencias
npm run dev            # desarrollo en http://localhost:5173
npm run build          # comprobar tipos y compilar a app/dist
npm run preview        # servir la compilación
npm test               # tests (vitest)
npm run lint           # ESLint, sin avisos permitidos
npm run typecheck      # tipos (tsc -b)
npm run validar-mazos  # validar los mazos de app/mazos/
```

Versión antigua (desde la raíz):

```bash
npm install        # instalar dependencias
npm start          # arrancar en http://localhost:3000 (PORT para cambiarlo)
npm run dev        # arrancar con recarga automática (node --watch)
```

Para generar quizzes en la v1 hace falta `OPENAI_API_KEY` en `.env` (raíz).
El servidor arranca sin ella, pero `/upload` devuelve error.

## Convenciones

- Interfaz y textos para el alumnado en **español**.
- Commits en **español**, uno por tarea.
- Trabajo siempre en ramas (`v2` para la reescritura); no tocar `main` ni
  hacer merge sin permiso.
- **Nunca versionar `.env` ni ninguna clave**, ni mostrarlas en la terminal.
  Ninguna clave privada en el frontend.
- No instalar ni actualizar dependencias ni llamar a servicios externos sin
  que lo pida la fase en curso.

## Avisos conocidos (de la auditoría, v1)

- La rapidez no puntúa: el móvil nunca descuenta el tiempo y todo acierto vale
  1000 (`index.html:386,413,574`).
- El tiempo restante lo manda el cliente sin límite: se pueden inflar puntos
  (`server.js:57-61,223-235`).
- `host_join` no tiene protección: cualquiera con el PIN puede tomar el
  control (`server.js:172-176`).
- `POST /upload` es público, sin límite de tamaño ni de peticiones
  (`server.js:23,64`).
- Posible caída del proceso si responde un socket que no es jugador
  (`server.js:237`, sin verificar).
- Sin reconexión: si recarga un alumno pierde su puntuación; si recarga el
  profesor se cancela la partida (`server.js:184,277-294`).
- Solo el top 5 ve su posición entre preguntas (`server.js:265-267`).
- `express.static(__dirname)` publica el código fuente (`server.js:13`).
- Interfaz en inglés (`index.html`).

## Estado

Fases 1 y 2 cerradas (rama `v2`, 2026-10-28). Siguiente: fase 3.

Hecho en la fase 2:

- [x] Esqueleto de `app/` con el stack acordado, tema de la guía de diseño,
  `lang="es"`.
- [x] Formato de mazo v1 copiado del Trivial (37 tests suyos incluidos).
- [x] Tres mazos incluidos: CDI Tema 1 y Tema 2 (240 preguntas cada uno, con
  dificultad y explicación) e Industria 4.0 (60, **sin dificultad ni
  explicaciones**).
- [x] Biblioteca: importar (validado), exportar y borrar importados.
- [x] Configuración de partida y resumen; selección al azar sin repetir.
- [x] 70 tests, tipos, lint y compilación sin errores. Pantalla comprobada en
  Chrome sin ventana a 1920×1080.

Pendiente:

- [ ] **Fase 3**: Ably (cuenta, función de tokens en Vercel), sala de espera,
  motor de partida en el navegador del profesor, pantallas del móvil.
- [ ] La partida preparada aún no se guarda: si se recarga la página, se
  pierde (la persistencia llega con el motor en la fase 3).
- [ ] La v1 (`server.js`) sigue en la raíz hasta la fase 4.
- [ ] Industria 4.0 no tiene dificultades ni explicaciones: con él solo se
  ofrece «Todas» y no se muestran explicaciones. Habría que completarlo en el
  Trivial y volver a copiarlo.
