# NeuroQuiz

Juego de preguntas en directo para clase, al estilo Kahoot. El profesor sube
un PDF con el temario, la IA (OpenAI) genera preguntas tipo test en español y
los alumnos responden desde el móvil mientras el proyector muestra las
preguntas, los resultados y el podio final.

> **Aviso:** esta es la versión actual (v1). En la rama `v2` se está rehaciendo
> como web estática con mazos de preguntas guardados. Ver `CLAUDE.md`.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (probado con Node 25).
- Una clave de API de OpenAI con saldo (cada quiz generado consume créditos).
- Que el ordenador del profesor y los móviles lleguen al servidor: misma red
  wifi si se ejecuta en local, o el servidor publicado en internet.

## Instalación

```bash
git clone https://github.com/fcarros/neuroquiz-app.git
cd neuroquiz-app
npm install
```

Crea un archivo `.env` en la **raíz del proyecto** (junto a `server.js`) con
esta línea:

```
OPENAI_API_KEY=tu_clave_aqui
```

`.env` está en `.gitignore`: no lo subas nunca al repositorio.

## Arranque

```bash
npm start
```

Abre `http://localhost:3000`. Para usar otro puerto: `PORT=4000 npm start`.
Para desarrollo con recarga automática: `npm run dev`.

El servidor arranca aunque falte la clave, pero no podrá generar quizzes.

Para que los móviles se conecten en local, usa la IP del ordenador en vez de
`localhost` (por ejemplo `http://192.168.1.20:3000`); el QR se genera con la
dirección que tenga abierta el profesor.

## Cómo se juega hoy

**Profesor (en el proyector)**

1. Pulsa **HOST**.
2. Elige número de preguntas (3-20), dificultad y tiempo por pregunta.
3. Sube el PDF y pulsa **GENERATE QUIZ**. Tarda unos segundos.
4. Aparecen el PIN de 6 dígitos y un QR. Cuando estén todos, pulsa
   **START GAME**.
5. En cada pregunta se ve el enunciado, las 4 opciones y la cuenta atrás. Al
   acabar el tiempo (o al pulsar **Show Results**) se ve la correcta, cuántos
   eligieron cada opción y el top 5. **NEXT QUESTION** pasa a la siguiente.
6. Tras la última pregunta aparece el podio.

**Alumnos (en el móvil)**

1. Escanean el QR o abren la web, pulsan **JOIN** y escriben el PIN y un
   apodo.
2. En cada pregunta pulsan el botón con el color y la forma de la opción que
   ven en el proyector.
3. Al responder ven si han acertado y, entre preguntas, su posición si están
   en el top 5.

## Limitaciones conocidas

- La interfaz está en inglés; las preguntas salen en español.
- Si un alumno recarga la página, sale de la partida y no puede volver. Si
  recarga el profesor, la partida se cancela.
- No se puede entrar una vez empezada la partida.
- Las preguntas no se guardan ni se pueden revisar antes de jugar.
- La puntuación por rapidez no funciona: todo acierto vale 1000 puntos.

Lista completa en `docs/AUDITORIA.md`.

## Despliegue

`render.yaml` describe un servicio web Node para Render. Hay que configurar
`OPENAI_API_KEY` en el panel. No funciona en Vercel (necesita un servidor con
WebSockets y estado en memoria).
