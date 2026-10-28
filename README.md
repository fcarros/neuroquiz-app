# Aula Quiz (antes NeuroQuiz)

Juego de preguntas en directo para clase, al estilo Kahoot. El proyector
muestra las preguntas, los resultados y el podio; los alumnos responden desde
el móvil.

En este repositorio conviven dos versiones mientras dura la reescritura:

| | Dónde | Estado |
|---|---|---|
| **Aula Quiz** (v2) | carpeta `app/` | En desarrollo (fase 3B de 6): partida completa con móviles reales por Ably; en desarrollo, también entre pestañas. |
| **NeuroQuiz** (v1) | raíz (`server.js`, `index.html`) | Funciona: genera las preguntas con IA desde un PDF. |

Plan y estado: `CLAUDE.md`. Guía de diseño: `docs/diseno-aula-quiz.md`.

## Aula Quiz (v2, carpeta `app/`)

### Requisitos

- Node.js 24 (el que usa Vercel; fijado en `app/.nvmrc` y `engines`). Funciona
  también con Node 25, pero `npm install` mostrará un aviso `EBADENGINE`
  (solo informativo) porque no es la versión indicada.
- Para jugar con móviles reales (Ably), `app/.env.local` con dos variables
  (nunca se suben al repositorio):

  ```
  ABLY_API_KEY=…                # clave de Ably con Publish, Subscribe y Presence
  AULA_QUIZ_SECRETO_SALA=…      # secreto para firmar las salas; se genera con:
  # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```

  Sin ellas, `npm run dev` funciona igual con el transporte local
  (pestañas).
- Google Chrome, solo para los scripts de comprobación de `app/scripts/`.

### Arranque

```bash
cd app
npm install
npm run dev
```

Abre `http://localhost:5173` (pensado para el proyector, a 1920×1080). En
`npm run dev` se usa el transporte local (pestañas); con
`http://localhost:5173/?transporte=ably` se usa Ably. La web compilada y
publicada usa Ably por defecto.

Otros comandos: `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`, `npm run preview` y `npm run validar-mazos`.

Partida de prueba automática en Chrome sin ventana (proyector y 3 móviles):

```bash
npm run build
npx vite preview --port 4173 --strictPort   # en otra terminal
node scripts/partida-pestanas.mjs http://localhost:4173/ capturas
```

### Qué se puede hacer hoy

1. **Elegir mazo.** Vienen incluidos dos temas de Comercio Digital
   Internacional y uno de Industria 4.0, agrupados por módulo.
2. **Importar un mazo** propio (`.json`, formato de Aula Trivial, ver
   `docs/formato-mazo.md`). Se valida y se guarda en ese navegador. Los
   importados se pueden exportar y borrar.
3. **Configurar la partida:** categorías, número de preguntas (5, 10, 15, 20, 30
   o todas), dificultad, segundos por pregunta (10, 20, 30 o 60) y si se
   muestra la explicación. Solo se ofrecen combinaciones posibles.
4. **Crear partida:** elige las preguntas al azar y muestra un resumen.
5. **Abrir sala:** PIN de 6 cifras y QR. Los alumnos entran con su nombre
   (los repetidos se numeran) y el profesor puede expulsar desde la sala.
6. **Jugar:** pregunta con cuenta atrás; se cierra al acabar el tiempo o al
   responder todos. Luego, votos, la correcta, «Por qué» y el top 5. Puntos
   por rapidez: entre 1000 (al instante) y 500 (en el último segundo).
   Controles: Empezar, Siguiente, Saltar pregunta y Terminar.
7. **Final:** podio con tres datos de la clase y tabla de todos, descargable
   en CSV (se abre bien en Excel).
8. **Recargas:** si el alumno recarga, vuelve solo con sus puntos; si
   recarga el profesor, se le ofrece continuar la partida.

### Cómo probarlo con varias pestañas

Hoy los «móviles» son pestañas del mismo navegador (se comunican con
BroadcastChannel). Todas en el **mismo navegador y el mismo perfil**.

1. `cd app && npm run dev` y abre `http://localhost:5173` (el proyector,
   con el transporte local).
2. Elige un mazo, configura (con 10 s por pregunta se prueba antes) y pulsa
   **Crear partida** y luego **Abrir sala**. Apunta el PIN.
3. Abre otra pestaña con `http://localhost:5173/#/jugar/PIN` (cambia PIN por
   el número). Para verla como un móvil, abre las herramientas de
   desarrollo (Cmd+Opción+I) y activa la vista de dispositivo (Cmd+Mayús+M).
4. Escribe un nombre y pulsa **Entrar**. Repite en dos o tres pestañas más
   (cada pestaña es un alumno distinto; prueba a repetir un nombre).
5. Vuelve al proyector: verás los nombres. Pulsa **Empezar**.
6. Responde en cada pestaña de móvil. Si responden todos, la pregunta se
   cierra sola; si no, al acabar el tiempo.
7. Prueba a **recargar un móvil** a mitad de pregunta: vuelve con sus puntos.
   Prueba a **recargar el proyector**: pulsa **Continuar partida**.
8. Al final, **Ver resultados de todos** y **Descargar CSV**.

Consejo: si una pestaña de móvil está en segundo plano, el navegador puede
retrasar su cuenta atrás, pero la hora que cuenta es la del proyector.
Para empezar de cero, en el proyector usa **Nueva partida** o **Cancelar
partida**.

### Cómo probarlo con móviles reales

Con la web publicada en Vercel (o, para una prueba rápida, `npm run dev --
--host` en el ordenador y los móviles en la misma wifi: la dirección `http://`
de la red local no es segura y algunos navegadores no permiten ahí el cálculo
del id del alumno, así que lo fiable es la web publicada).

1. En el ordenador del proyector, abre la web publicada, prepara la partida
   y pulsa **Abrir sala**.
2. Con cada móvil, escanea el QR (o abre la web y escribe el PIN). Escribe un
   nombre y pulsa **Entrar**.
3. Pulsa **Empezar** en el proyector y responde desde los móviles.
4. Prueba a bloquear un móvil unos segundos o a recargarlo: aparece
   «Reconectando…» y vuelve con sus puntos. Prueba también a recargar el
   proyector y pulsar **Continuar partida**.

## NeuroQuiz (v1, raíz)

### Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (probado con Node 25).
- Una clave de API de OpenAI con saldo (cada quiz generado consume créditos).
- Que el ordenador del profesor y los móviles lleguen al servidor: misma red
  wifi si se ejecuta en local, o el servidor publicado en internet.

### Instalación

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

### Arranque

```bash
npm start
```

Abre `http://localhost:3000`. Para usar otro puerto: `PORT=4000 npm start`.
Para desarrollo con recarga automática: `npm run dev`.

El servidor arranca aunque falte la clave, pero no podrá generar quizzes.

Para que los móviles se conecten en local, usa la IP del ordenador en vez de
`localhost` (por ejemplo `http://192.168.1.20:3000`); el QR se genera con la
dirección que tenga abierta el profesor.

### Cómo se juega hoy

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

### Limitaciones conocidas

- La interfaz está en inglés; las preguntas salen en español.
- Si un alumno recarga la página, sale de la partida y no puede volver. Si
  recarga el profesor, la partida se cancela.
- No se puede entrar una vez empezada la partida.
- Las preguntas no se guardan ni se pueden revisar antes de jugar.
- La puntuación por rapidez no funciona: todo acierto vale 1000 puntos.

Lista completa en `docs/AUDITORIA.md`.

### Despliegue

`render.yaml` describe un servicio web Node para Render. Hay que configurar
`OPENAI_API_KEY` en el panel. No funciona en Vercel (necesita un servidor con
WebSockets y estado en memoria).
