# NeuroQuiz

Juego educativo tipo Kahoot para usar en clase con alumnado de FP. El profesor
proyecta las preguntas y los alumnos responden desde el móvil en tiempo real;
la rapidez puntúa y al final hay ranking y podio. Una clase: hasta 30 alumnos
a la vez más el proyector.

Contexto completo del punto de partida: `docs/AUDITORIA.md`. Prompts de cada
fase: `docs/prompts/`.

## Arquitectura actual (v1, rama `main`)

- `server.js`: Node + Express + Socket.IO. Sirve los estáticos, recibe un PDF
  en `POST /upload`, genera las preguntas con OpenAI (`gpt-4o`) y lleva toda
  la lógica de partida. El estado vive en memoria (`games`).
- `index.html`: toda la interfaz (vistas que se muestran y ocultan) con el JS
  en línea. `styles.css`: sistema de diseño oscuro «neón».
- El temporizador corre en el navegador del profesor; el servidor no
  controla el tiempo.
- Despliegue previsto en Render (`render.yaml`). No es compatible con Vercel.

## Arquitectura objetivo (v2, rama `v2`)

- **Web estática en Vercel**, sin servidor propio encendido todo el tiempo.
- **El navegador del profesor es el árbitro**: guarda el estado de la partida
  (y lo persiste para sobrevivir a una recarga), marca inicio y fin de cada
  pregunta con su reloj, calcula los puntos y decide qué ve cada móvil.
- **Los móviles solo envían su respuesta**. Nunca reciben la correcta antes de
  que el profesor la revele. Cada alumno tiene un identificador secreto para
  que nadie responda por otro y puede volver a entrar con su puntuación.
- **Servicio de tiempo real externo y gratuito** que solo transporta mensajes.
  Ninguna clave privada en el frontend: si hace falta, una función pequeña de
  Vercel emite credenciales temporales.
- **Mazos de preguntas guardados** con el formato de «Aula Trivial» (v1), para
  que los mismos archivos sirvan en los dos juegos.
- La generación desde PDF vuelve en la fase 6, protegida.

## Fases

1. **Limpieza, cimientos y decisión de tiempo real** ← fase actual
2. Mazos
3. Tiempo real y motor de partida
4. Publicación en Vercel y prueba de carga
5. Interfaz
6. Generador desde PDF

## Comandos (versión actual)

```bash
npm install        # instalar dependencias
npm start          # arrancar en http://localhost:3000 (PORT para cambiarlo)
npm run dev        # arrancar con recarga automática (node --watch)
```

Para generar quizzes hace falta `OPENAI_API_KEY` en `.env` (raíz). El
servidor arranca sin ella, pero `/upload` devuelve error.

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

Fase 1 en curso (rama `v2`).

- [x] Carpeta de prompts reorganizada y auditoría en `docs/`.
- [x] `.gitignore` ajustado.
- [x] `CLAUDE.md` creado.
- [x] README reescrito.
- [ ] `docs/decision-tiempo-real.md`: comparativa y propuesta de stack.
- [ ] **Pendiente de Fran**: elegir servicio de tiempo real antes de la fase 3.
