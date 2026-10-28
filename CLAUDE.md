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
- `src/partida/PanelConfiguracion.tsx`, `ResumenPartida.tsx` y
  `Preparacion.tsx`: pantallas del profesor antes de jugar. El resumen se ve
  en el proyector: nunca muestra las correctas.
- Rutas (`src/App.tsx`): `/` es el profesor; `/#/jugar/123456` es el móvil
  (lo que abre el QR). Con `#` no hacen falta redirecciones en Vercel.
- `src/motor/`: el motor de partida. `estado.ts` tiene el estado (datos
  planos) y `reducir(estado, acción) → estado`, pura, con el reloj dentro de
  cada acción (`ahora`). Puntos, rachas, puestos, estadísticas y CSV se
  calculan desde las respuestas (`calculos.ts`), no se guardan. `vistas.ts`:
  lo único que sale hacia los móviles (sin secretos y sin la correcta con la
  pregunta abierta).
- Reglas: puntos `round(1000 × (1 − t / límite ÷ 2))` con `t` del reloj del
  profesor; respuestas hasta límite + 500 ms; cierre al acabar el tiempo
  (+ margen) o al responder todos; «Saltar» anula la pregunta (no cuenta ni
  rompe rachas); «Terminar» va al podio (si la pregunta estaba abierta, no
  cuenta); se puede entrar tarde con 0 puntos; expulsar solo en la sala;
  nombres de hasta 15 caracteres, los repetidos se numeran («Ana 2»).
- `src/transporte/`: interfaz `Transporte` propia (crear sala, conectar,
  enviar a todos, a un jugador, al profesor, recibir, estado de la red).
  Dos versiones: `transporte.ts` (local, BroadcastChannel entre pestañas) y
  `ably.ts` (Ably; la librería se carga solo si se usa). `elegir.ts`: local
  por defecto en `npm run dev`, Ably en la web compilada; `?transporte=local`
  o `?transporte=ably` fuerzan uno u otro. `canales.ts`: nombres de canal
  (`aq:PIN:todos`, `aq:PIN:profesor`, `aq:PIN:j:ID`) e id del jugador
  (resumen SHA-256 de su secreto). `limitador.ts`: el profesor no pasa de 25
  envíos por segundo. `mensajes.ts`: esquemas zod; todo lo recibido se valida
  y se descarta si no cumple. Detalle, límites y cálculos:
  `docs/decision-tiempo-real.md` («Ably en Aula Quiz»).
- `api/ably-token.ts` (función de Vercel; lógica en `api/_credenciales.ts`):
  elige el PIN y firma la prueba de profesor (HMAC, 12 h), y emite
  TokenRequest de Ably con permisos mínimos por rol. Variables:
  `ABLY_API_KEY` y `AULA_QUIZ_SECRETO_SALA` (en local, `app/.env.local`,
  ignorado por git; `npm run dev` y `preview` sirven la función desde
  `vite.config.ts`). Las importaciones relativas de `api/` llevan `.js`
  (Node con módulos ES en Vercel).
- `src/profesor/arbitro.ts`: une motor y transporte en la pestaña del
  profesor; envía a cada móvil solo lo que cambia de su vista y guarda la
  partida en localStorage (`aula-quiz:partida`, validada al leerla). Al
  recargar se ofrece «Continuar partida». `AppProfesor.tsx` y
  `useArbitro.ts` lo conectan con React.
- `src/proyector/`: sala (PIN, QR con `qrcode-generator`), pregunta,
  respuesta con top 5, podio y tabla con CSV.
- `src/alumno/cliente.ts`: el móvil sin interfaz (identidad, saludo con
  reintentos, respuestas, reenvío de una respuesta perdida, nuevo saludo al
  reconectar). Identidad por sala (`aula-quiz:jugador:PIN`): con Ably en
  **localStorage**, en local en sessionStorage (cada pestaña es un alumno).
  `AppAlumno.tsx`: sus pantallas, con el aviso «Reconectando…».
- `scripts/`: comprobaciones con Chrome sin ventana (protocolo DevTools, sin
  dependencias). `captura-configuracion.mjs` (fase 2) y
  `partida-pestanas.mjs` (proyector + 3 móviles, partida de 5 preguntas con
  el mazo `scripts/datos/mazo-verificacion.json`; `TRANSPORTE=ably` para
  hacerlo con Ably, con un contexto aislado por móvil). Capturas e informes
  en `app/capturas/` (ignorado por git).
- `pruebas/`: tests que juntan función y transporte (`ablyFalso.ts`, un
  doble de Ably que aplica los permisos firmados) y la prueba contra Ably de
  verdad (`ably.real.test.ts`, fuera de `npm test`).
- `vercel.json`: publicación (Vite, `npm ci`, `dist`).

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
3. Tiempo real y motor de partida
   - 3A. Motor, pantallas y conexión local entre pestañas ✓
   - 3B. Ably y publicación en Vercel ✓
4. Prueba de carga y retirada de la v1 ← siguiente
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
# Con `npm run build && npx vite preview --port 4173 --strictPort` en marcha:
node scripts/partida-pestanas.mjs http://localhost:4173/ capturas
TRANSPORTE=ably node scripts/partida-pestanas.mjs http://localhost:4173/ capturas
npm run prueba:ably    # partida real contra Ably: 30 jugadores, 10 preguntas
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

Fases 1, 2, 3A y 3B cerradas (rama `v2`, 2026-10-28).

Publicada en **https://aula-quiz-fawn.vercel.app** (proyecto de Vercel
`aula-quiz`, aparte del Trivial; directorio raíz `app`, rama de producción
`v2`: cada push a `v2` se publica). Variables `ABLY_API_KEY` y
`AULA_QUIZ_SECRETO_SALA` en el panel, como secretas (el secreto de Vercel es
distinto del de `.env.local`).

Hecho en la fase 3B:

- [x] Función de credenciales (`api/ably-token.ts`) con permisos mínimos por
  rol y prueba HMAC de profesor; secreto en `app/.env.local`.
- [x] Transporte con Ably detrás de la interfaz, con limitador; transporte
  local para desarrollo; `?transporte=` para elegir.
- [x] Identidad por sala en localStorage, aviso «Reconectando…» en móvil y
  proyector, aviso en la sala si la dirección del QR no sirve para móviles.
- [x] 5 en las opciones de número de preguntas.
- [x] 175 tests; prueba real contra Ably (30 jugadores, 10 preguntas,
  recargas): ≈ 2 800 mensajes, pregunta → móvil 46 ms de mediana.
- [x] `vercel.json` y proyecto en Vercel. Comprobado en la web publicada:
  la función (permisos, 403 con la prueba de otra sala, 405, 400) y una
  partida completa con proyector y 3 móviles por Ably, sin parámetros en la
  dirección (`TRANSPORTE=publicada`).

Pendiente:

- [ ] Comprobar en el panel de Ably que no hay reglas de persistencia
  (Settings → Rules).
- [ ] Probar con móviles reales en clase.
- [ ] El limitador hace que algunos alumnos vean su resultado hasta ~1 s
  después que el resto (cierre de 31 envíos a 25/s). Si molesta, se puede
  subir a 40/s o enviar los resultados en un solo mensaje común.
- [ ] Si la función elige un PIN ya en uso, chocarían dos salas
  (improbable; comprobarlo exigiría el permiso `channel-metadata`).
- [ ] Un alumno expulsado puede volver desde otro navegador con otra
  identidad; el profesor puede volver a expulsarlo.
- [ ] La v1 (`server.js`) sigue en la raíz hasta la fase 4.
- [ ] Industria 4.0 no tiene dificultades ni explicaciones: con él solo se
  ofrece «Todas» y no se muestran explicaciones. Habría que completarlo en el
  Trivial y volver a copiarlo.
