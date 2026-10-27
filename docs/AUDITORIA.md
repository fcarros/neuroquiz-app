# Auditoría de NeuroQuiz (juego tipo Kahoot)

Fecha: 2026-10-27 · Alcance: solo lectura (lo único que se ha creado es este archivo).
Leyenda: **[V]** verificado en código o comando · **[I]** inferido · **[P]** pendiente de verificar.

---

## 0. Resumen ejecutivo

- NeuroQuiz es un Kahoot casero: el profesor sube un PDF, GPT-4o genera N preguntas tipo test en español y los alumnos juegan en directo desde el móvil con un PIN de 6 dígitos o un QR [V] (`server.js:64-166`, `index.html:312-322`).
- Stack mínimo: un único `server.js` (Node + Express + Socket.IO + OpenAI + pdf-parse) y un único `index.html` con JS en línea, más `styles.css` [V]. No hay base de datos: todo el estado vive en la memoria del proceso (`server.js:35`) [V].
- Estado: **prototipo funcional con fallos serios**. El flujo completo (sala → preguntas → resultados → podio) está implementado, pero:
  1. **La puntuación no premia la rapidez**: el móvil nunca descuenta el tiempo y siempre manda el tiempo completo, así que todo acierto vale 1000 [V] (`index.html:386,413,574`).
  2. El tiempo lo informa el cliente, sin validar → se pueden inflar los puntos [V] (`server.js:223-235`).
  3. Los alumnos que no están en el top 5 no ven su posición entre preguntas [V] (`server.js:265-267`, `index.html:498`).
  4. Si se recarga el móvil o la pantalla del profesor, se pierde la partida o el jugador; no hay reconexión [V].
  5. `/upload` es público y gasta créditos de OpenAI de quien lo despliega [V].
- No hay claves versionadas ni en el historial de git [V]. `.env` existe y está ignorado [V].
- **Veredicto**: el diseño visual y el flujo de juego se pueden aprovechar; la capa de tiempo real y el origen de las preguntas habría que rehacerlos según las decisiones del Trivial (mazos JSON).
- **¿Se puede publicar en Vercel tal cual? No.** Necesita un proceso Node persistente con WebSockets (Socket.IO) y estado en memoria, y Vercel no da ninguna de las dos cosas. Además, generar con IA va en contra de la decisión de usar mazos.

---

## 1. Git y GitHub

| Aspecto | Estado |
|---|---|
| Remoto | `origin` → `https://github.com/fcarros/neuroquiz-app.git` [V] (`git remote -v`) |
| Ramas | Solo `main` (local y `origin/main`) [V] |
| Sincronización | `main` está en `2f85656`, igual que `origin/main`: ni adelantada ni atrasada respecto a la última copia local del remoto [V]. No he hecho `fetch`, así que no sé si GitHub tiene commits más nuevos [P] |
| Cambios sin confirmar | Solo `docs:prompts:/auditoria-kahoot.md` sin seguimiento (y ahora `AUDITORIA.md`) [V] |
| Commits | 10 en total, del 2025-12-14 al 2026-02-17 [V] |
| Autores | `fcarros` (con email `fcarros.ia@…`, subidas desde la web de GitHub) y `fran carro` (local, varios commits coescritos con Claude) [V] |

Historial completo (son menos de 15) [V]:

```
2f85656 2026-02-17 Show question and correct answer in host results view
106f398 2026-02-17 Force quiz generation in Spanish
fe0116b 2026-02-17 Add Render deployment config
5adb355 2026-02-17 Redesign UI and lazy-init OpenAI client
6b5b30c 2026-02-17 Upgrade multer to 2.0.2 and fix qs vulnerability
c8615fa 2026-02-17 Fix critical bugs: timeLimit, memory cleanup, disconnects, validation
ccb0977 2026-02-17 Remove obsolete debug scripts and update project config
2ab047a 2025-12-19 Add files via upload
ee903e1 2025-12-19 Refactor server.js and add main page route
b299708 2025-12-14 Add files via upload
```

- Primera versión con **Gemini** (`check_models.js`, `fix_model.js`, `list_models.js` y sus `*_log.txt`). Esos archivos se borraron en `ccb0977` y se cambió a OpenAI [V]. Los logs del historial solo tienen errores de cuota de Gemini, sin claves [V].
- `.gitignore` [V]: `node_modules/`, `.env`, `.DS_Store`, `uploads/`, `*.log`, `*_log.txt`. Es correcto.
- Archivos versionados ahora mismo [V]: `.gitignore README.md index.html package-lock.json package.json render.yaml server.js styles.css`. No hay nada que sobre.
- Ignorados pero presentes en disco [V]: `.env`, `.DS_Store`, `.claude/settings.local.json`.
- Rareza: la carpeta del prompt se llama literalmente `docs:prompts:` (seguramente se creó como «docs/prompts/» desde el Finder). Cualquier herramienta que busque `docs/prompts/` no la encontrará [V].

---

## 2. Estructura y stack

```
neuroquiz/
├── server.js          # TODO el backend: Express, subida PDF, OpenAI, Socket.IO, lógica de juego (325 líneas)
├── index.html         # TODA la interfaz: 10 "vistas" en divs + JS en línea (647 líneas, 94 atributos style=)
├── styles.css         # Sistema de diseño oscuro "neón" (466 líneas)
├── package.json       # Dependencias y scripts start/dev
├── package-lock.json
├── render.yaml        # Blueprint de Render (web service Node)
├── README.md          # Descripción breve e instalación
├── uploads/           # Carpeta temporal de multer (vacía; ignorada)
├── .env               # Existe, solo con OPENAI_API_KEY (ignorado)
├── .claude/           # settings.local.json (permisos de Claude Code; ignorado)
└── docs:prompts:/auditoria-kahoot.md   # Este encargo (sin seguimiento)
```

| Ficha técnica | Valor |
|---|---|
| Lenguaje | JavaScript (CommonJS en el servidor, JS clásico en el navegador), HTML, CSS [V] |
| Runtime local | Node v25.2.1 [V]. `package.json` no fija `engines` [V] |
| Backend | Express 4.22.1 · Socket.IO 4.8.1 · multer 2.0.2 · pdf-parse 1.1.4 · openai 6.10.0 · dotenv 16.6.1 (instaladas) [V] |
| Frontend | Sin framework ni build. Cliente de Socket.IO servido en `/socket.io/socket.io.js`. Fuente Inter de Google Fonts [V]. El README dice «Tailwind CSS», pero **no se usa** [V] |
| Modelo IA | `gpt-4o` con `response_format: json_object` (`server.js:109-116`) [V] |
| Base de datos | Ninguna. Objeto `games` en memoria (`server.js:35`) [V] |
| Arranque | `npm start` → `node server.js`, puerto `PORT` o 3000 (`server.js:321`) [V] |
| Tests / lint / TS | No hay [V]. `node --check server.js` sintaxis OK [V] |
| Despliegue | `render.yaml`: web service Node, `npm install` / `npm start`, variable `OPENAI_API_KEY` [V]. No sé si llegó a desplegarse ni con qué URL [P] |
| Servicios externos | OpenAI, `api.qrserver.com` para el QR (`index.html:320`), Google Fonts [V] |

---

## 3. Multijugador y tiempo real

**Cómo se unen** [V]
- PIN numérico de 6 dígitos (`server.js:48-54`), que se muestra en grande en la pantalla del profesor.
- QR generado por el servicio externo `api.qrserver.com` con la URL `origen?pin=XXXXXX` (`index.html:319-320`). Al abrirlo, el PIN se rellena solo (`index.html:264-271`).
- Nombre libre de hasta 20 caracteres, limitado solo en el HTML (`index.html:99`). El servidor no valida el nombre ni evita duplicados (`server.js:183-199`).

**Tecnología de sincronización**: Socket.IO 4 sobre el mismo servidor HTTP (`server.js:21-22`), con salas por PIN (`socket.join(pin)`) [V].

**Dónde vive el estado**: en la memoria del proceso Node (`games[pin]`: preguntas, jugadores, respuestas, estado) [V]. **El temporizador corre solo en el navegador del profesor** (`index.html:349-381`). Al llegar a 0, es el navegador del profesor el que manda `show_results` (`index.html:378`). El servidor no controla el tiempo [V].

**Casos límite**

| Caso | Qué pasa | |
|---|---|---|
| El alumno recarga o pierde la conexión | El jugador se identifica por `socket.id`. Al desconectarse se le **borra con su puntuación** (`server.js:285-291`). No puede volver a entrar porque `player_join` exige `state === 'lobby'` (`server.js:184`) | [V] |
| Reconexión automática de Socket.IO | Genera un `socket.id` nuevo. El servidor ya no lo reconoce y sus respuestas fallarían (ver «Errores probables») | [I] |
| El alumno llega tarde | Rechazado con «Invalid PIN or Game Started» (`server.js:197`) | [V] |
| El profesor recarga o se cae | Se emite `game_cancelled`, se **borra la partida** y todos los móviles recargan (`server.js:280-283`, `index.html:601-604`) | [V] |
| Proceso reiniciado (despliegue, el plan gratuito de Render se duerme) | Se pierden todas las partidas | [I] |
| El móvil se bloquea a mitad de partida | La conexión se corta y se cae en el caso «pierde la conexión» | [I] |

**Capacidad y límites**
- El código no pone ningún tope de jugadores [V]. Socket.IO en un solo proceso aguanta sin problema una clase de 30 alumnos [I].
- Los límites reales dependerían del alojamiento: en el plan gratuito de Render, la instancia se duerme cuando no hay tráfico (el primer acceso tarda) y no escala a varias instancias. Con varias instancias, el estado en memoria se rompería [I/P].
- La sala de espera se pinta con insignias (`index.html:324-332`) y escala bien a una clase [V].

**Compatibilidad con Vercel**

| Parte | ¿Compatible? |
|---|---|
| `index.html` + `styles.css` como estáticos | Sí [I] |
| Servidor Socket.IO (`server.js:21-22,168-295`) | **No**: las funciones de Vercel no mantienen WebSockets persistentes [I] |
| Estado `games` en memoria | **No**: cada invocación serverless puede caer en una instancia distinta [I] |
| `setTimeout` de limpieza (`server.js:318`) | No [I] |
| `POST /upload` (PDF + GPT-4o) | Se podría portar a una función, pero escribe en disco (`multer dest: 'uploads/'`) y una llamada a GPT-4o con 20 000 caracteres puede superar el tiempo máximo de la función. Además contradice la decisión de usar mazos [I] |
| Cliente (`io()`, `index.html:254`) | Habría que cambiarlo por un servicio de tiempo real gestionado (Supabase Realtime, Firebase, Ably, Pusher, PartyKit…) [I] |

---

## 4. Funcionalidad

| Función | Estado | Archivo | Observaciones |
|---|---|---|---|
| Crear partida (subir PDF + IA) | Completa | `server.js:64-166`, `index.html:289-310` | 3-20 preguntas, dificultad Easy/Medium/Hard y tiempo 10-45 s. Se filtran las preguntas mal formadas (`server.js:129-137`) [V] |
| Sala de espera con PIN y QR | Completa | `index.html:74-92,316-340` | El QR depende de un servicio externo. Con nombres repetidos, `player_left` borra la primera insignia que coincida [V] |
| Unirse (alumno) | Completa | `index.html:94-102,552-562` | Sin validar en el servidor [V] |
| Mostrar pregunta (profesor) | Completa | `index.html:384-413` | El enunciado y las opciones solo se ven en el proyector. El móvil ve solo 4 botones de color, forma y letra A-D (estilo Kahoot) [V] |
| Responder (alumno) | Completa con fallos | `index.html:564-598`, `server.js:223-248` | Se bloquea la segunda respuesta en cliente y servidor (`server.js:231`). El alumno sabe al instante si ha acertado (`server.js:241`) [V] |
| Temporizador | A medias | `index.html:346-381` | Solo en el profesor. El móvil no muestra cuenta atrás ni descuenta tiempo. El servidor admite respuestas hasta que el profesor pulsa resultados [V] |
| Puntuación por rapidez | **Rota** | `server.js:57-61,235`, `index.html:574` | Diseñada como `1000 × tiempoRestante/total`, pero el `timeLeft` del alumno no baja nunca, así que todo acierto vale 1000 [V] |
| Resultados de la pregunta | Completa | `server.js:251-275`, `index.html:438-488` | Pregunta, opción correcta, gráfico de barras y top 5 [V] |
| Posición del alumno entre preguntas | A medias | `index.html:489-503` | Solo si está en el top 5. Los demás se quedan en «Waiting for results...» [V] |
| Pasar a la siguiente pregunta | Completa | `server.js:211-220` | Sin máquina de estados: se puede saltar en plena pregunta o antes de empezar [V] |
| Podio final y confeti | Completa | `server.js:313-319`, `index.html:511-544,620-636` | Top 3. El alumno fuera del podio no ve su posición final (`myTotalScore` se calcula y no se usa) [V] |
| «Play again» | Esbozada | `index.html:232` | Hace `location.reload()`: hay que volver a subir el PDF y pagar otra generación [V] |
| Tipos de pregunta | Solo test con 4 opciones | `server.js:129-137` | No hay verdadero/falso, respuesta múltiple ni imágenes [V] |
| Sonidos / música | No existen | — | No hay ningún `Audio` ni `<audio>` [V] |
| Idioma de la interfaz | Inglés | `index.html:2,21…` | `lang="en"` y todos los textos en inglés; solo las preguntas salen en español [V] |
| Guardar o reutilizar un quiz | No existe | — | Las preguntas se pierden al terminar [V] |

**Código muerto** [V]: `icons` en `index.html:397`, `colors` en `index.html:444`, `myTotalScore` (se escribe en 497 y 541, nunca se lee), `generatePIN` sin límite de intentos (irrelevante). **TODOs**: ninguno [V].

---

## 5. Preguntas y contenido

- **Origen**: un PDF subido por el profesor. Se usan sus primeros 20 000 caracteres (`server.js:75`) y GPT-4o genera las preguntas en ese momento [V]. No hay archivos de preguntas, banco ni formulario [V].
- **Cantidad y materia**: no hay ninguna pregunta guardada en el proyecto. Dependen de cada PDF [V].
- **Formato** (lo que pide el prompt, `server.js:93-102`) [V]:

```json
{ "questions": [
  { "question": "Texto de la pregunta",
    "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
    "correctIndex": 0 }
] }
```

  No hay ningún ejemplo real guardado: solo existe en memoria durante la partida [V].
- **Cambiar de temario hoy**: subir otro PDF. No se puede revisar ni corregir lo que genera la IA antes de jugar, y cada partida cuesta una llamada a la API [V].

**Comparación con el mazo del Trivial (v1)**

| Mazo Trivial | NeuroQuiz | |
|---|---|---|
| `formato`, `id`, `titulo`, `modulo`, `descripcion` | No existen (no hay metadatos de mazo) | Falta |
| `categorias` (6, una por color) | No existen | Falta. En un Kahoot no hace falta |
| `preguntas[]` | `questions[]` | Coincide (cambia el nombre) |
| `id` de pregunta | No existe | Falta |
| `color` | No existe. El color es de la **opción** (rojo, azul, amarillo, verde), no de la pregunta | No aplica igual |
| `enunciado` | `question` | Coincide |
| `opciones` (exactamente 4) | `options` (exactamente 4, validado) | Coincide |
| `correcta` (0-3) | `correctIndex` (0-3, validado) | Coincide |
| `dificultad` (facil/media/dificil) | Un solo parámetro global de generación (`Easy/Medium/Hard`), no por pregunta | Falta por pregunta |
| `explicacion` | No existe | Falta. Sería útil en la pantalla de resultados |
| — | `timeLimit` global de la partida | Sobra en la pregunta; podría ir como configuración de partida o campo opcional |

Conclusión [I]: el núcleo pregunta + 4 opciones + índice correcto es el mismo, así que un mazo del Trivial se podría jugar aquí ignorando `categorias` y `color`.

---

## 6. Calidad del código

- **Arquitectura**: dos archivos monolíticos. La lógica de juego, la IA y el transporte están mezclados en `server.js`; las vistas, el estado y el manejo de eventos, en el `<script>` de `index.html` [V]. Es fácil de leer por lo pequeño que es, pero cuesta ampliarlo.
- **Estado**:
  - En el cliente, variables globales (`myRole`, `myPin`, `timeLeft`…) y vistas que se muestran u ocultan con `hidden` (`index.html:254-261,274-281`) [V].
  - En el servidor, una máquina de estados implícita (`lobby / playing / question_active / results / finished`) que **no se comprueba** en `next_question` ni en `show_results` [V].
- **Duplicación**: poca. Muchos estilos en línea (94 `style=`) que repiten tamaños y pesos ya definidos en CSS [V].
- **Manejo de errores**:
  - `/upload` tiene `try/catch` y borra el archivo temporal (`server.js:157-165`) [V].
  - Los handlers de Socket.IO no tienen ningún `try/catch` ni validan tipos [V].
  - Los errores llegan al usuario con `alert()` o un modal que muestra el mensaje en crudo, a veces de OpenAI (`server.js:159`) [V].

**Errores confirmados o probables**

1. **La puntuación por rapidez no funciona** [V]. `timeLeft` solo se decrementa en `startTimer()`, que solo llama el profesor (`index.html:413`). El alumno envía el valor inicial (`index.html:386,574`).
2. **Sin tope de puntos** [V]. `calculateScore` no limita `timeLeft` (`server.js:57-61`), así que un cliente modificado que mande `timeLeft: 1e9` suma puntos sin límite.
3. **Posible caída del servidor** [I/P]. `submit_answer` hace `game.players[socket.id].score` sin comprobar que exista (`server.js:237`). Si responde un socket que no es jugador (el profesor, alguien que se reconectó con otro id, o un cliente malicioso), se lanza un `TypeError` dentro del listener. En Node eso suele tumbar el proceso y **cancela todas las partidas**. Hay que probarlo.
4. **`timeLimit` sin validar** [V] (`server.js:151`). `0` pasa a 20 por el `|| 20`, pero los negativos o enormes se aceptan; con negativos la puntuación sale negativa.
5. **Respuestas fuera de tiempo** [V]. El servidor acepta respuestas mientras `state === 'question_active'`, lo que incluye los segundos entre que el reloj del profesor llega a 0 y llega `show_results`.
6. **Saltos de estado** [V]. `next_question` funciona durante una pregunta activa o en la sala de espera. Con `show_results` repetido no pasa nada grave.
7. **Nombres repetidos**: `player_left` quita la primera insignia con ese nombre, que puede ser la de otro alumno (`index.html:337-339`) [V].
8. **Fuga de memoria pequeña** [V]. Si se llama a `/upload` y nadie hace `host_join`, la partida queda en `games` para siempre: solo se borra al desconectarse el profesor o al terminar (`server.js:280-283,318`).
9. **Sin límite de tamaño** [V]. multer no tiene `limits` ni filtro de tipo (`server.js:23`), así que se puede subir cualquier archivo de cualquier tamaño.

**Tests**: no hay [V].

---

## 7. Interfaz y uso en el aula

- **Diseño**: tema oscuro tipo «neón» o «glass», colores e iconos de Kahoot (▲◆●■), animaciones de entrada, barras animadas, podio y confeti [V] (`styles.css`). Es vistoso y coherente.
- **Proyector**:
  - Tipografía fluida con `clamp()` y un PIN muy grande (`styles.css:49`, hasta 9rem) [V].
  - El enunciado llega como mucho a 2rem (`index.html:138`) y el contenedor no pasa de 1100 px (`index.html:14`). En una pantalla grande puede quedarse pequeño [I/P].
  - Fondo oscuro con opciones translúcidas al 12 % de opacidad (`styles.css:154-157`). En proyectores con poco contraste puede verse lavado [P].
- **Móvil**:
  - Cuatro botones grandes en rejilla 2×2 al 70 % de la altura (`index.html:159`) [V].
  - El amarillo usa texto oscuro, bien (`styles.css:194`) [V].
  - **No hay temporizador ni número de pregunta en el móvil** [V].
  - Si no estás en el top 5, te quedas sin feedback de posición [V].
  - Textos en inglés [V].
- **Accesibilidad básica**:
  - `user-scalable=no` impide hacer zoom (`index.html:6`) [V].
  - Los botones del alumno solo tienen forma y letra, sin `aria-label` [V].
  - `lang="en"` con contenido en español [V].
  - Solo hay `:focus` en los inputs (`styles.css:126`) [V].
  - No respeta `prefers-reduced-motion` [V].
  - El color nunca es la única pista: siempre va con forma y letra [V].

---

## 8. Seguridad y privacidad

- **Claves**:
  - `.env` existe en la raíz, contiene solo la variable `OPENAI_API_KEY` y está en `.gitignore` [V].
  - **Nunca se ha versionado** `.env` (ningún commit lo toca) [V].
  - Buscando en todo el historial (`git log --all -p`) no aparecen claves tipo OpenAI ni Google [V]. Los scripts antiguos de Gemini leían `process.env.GEMINI_API_KEY` [V].
  - Ninguna clave va al frontend [V].
- **Archivos servidos públicamente**: `express.static(__dirname)` (`server.js:13`) publica **toda la raíz del proyecto**: `server.js`, `package.json`, `render.yaml`, `README.md`… [V]. `.env` y `.claude/` quedan protegidos porque `send` ignora los archivos que empiezan por punto por defecto (`node_modules/send/index.js:117-119`) [V]. Aun así, es una configuración frágil.
- **Abuso de la API**: `POST /upload` no tiene autenticación ni límite de peticiones. Cualquiera que conozca la URL puede generar quizzes a cargo de la cuenta de OpenAI [V]. El texto del PDF y el campo `difficulty` se meten tal cual en el prompt [V], con un riesgo de inyección de prompt bajo.
- **Base de datos / reglas**: no hay [V].
- **Datos del alumnado**:
  - Solo el apodo y la puntuación, en memoria; se borran 5 minutos después de terminar o al desconectarse el profesor [V].
  - El texto del PDF se envía a OpenAI [V].
  - El QR envía la URL del juego (con el PIN) a `api.qrserver.com` [V].
  - Google Fonts recibe la IP de cada dispositivo [V].
- **Trampas**

| Trampa | ¿Posible? |
|---|---|
| Ver la respuesta correcta desde el móvil | No antes de responder: `new_question` no envía `correctIndex` (`server.js:304-310`) [V]. Sí justo después: `answer_result` dice al instante si acertaste, y se puede comentar con el compañero mientras sigue la pregunta [V] |
| Responder dos veces | No: se comprueba en el servidor por `socket.id` (`server.js:231`) [V] |
| Inflar puntos | **Sí**: el `timeLeft` lo manda el cliente y no se limita (`server.js:223,235`) [V] |
| Suplantar a otro jugador | No se puede tomar su sesión (la identidad es el `socket.id`), pero sí entrar con el mismo nombre visible o con nombres ofensivos, porque no hay validación ni moderación [V] |
| Controlar la partida sin ser el profesor | `start_game`, `next_question` y `show_results` comprueban `hostSocket === socket.id` [V]. Pero `host_join` **no tiene ninguna protección**: cualquiera que sepa el PIN puede emitir `host_join` y quedarse como profesor (`server.js:172-176`) [V] |
| Que un alumno tumbe el servidor | Probable (ver error 3 de la sección 6) [I/P] |

---

## 9. Documentación

- `README.md` [V]: descripción, características, tecnologías, instalación y despliegue en Render/Railway. Inexactitudes: dice que usa **Tailwind CSS** (no lo usa) y dice «Modo Gran Pantalla», que no es un modo aparte sino el diseño normal.
- No hay `CLAUDE.md`, ni documentación del protocolo de eventos de Socket.IO, ni licencia explícita (`package.json` dice ISC) [V].
- A quien abra el proyecto por primera vez le faltaría saber:
  - la lista de eventos (`host_join`, `player_join`, `start_game`, `new_question`, `submit_answer`, `answer_result`, `show_results`, `question_results`, `next_question`, `game_over`, `game_cancelled`, `player_joined`, `player_left`, `update_answers_count`, `error`);
  - que el temporizador lo controla el navegador del profesor;
  - que todo está en memoria;
  - cuánto cuesta cada generación;
  - si hay o hubo un despliegue activo y dónde.

---

## 10. Problemas detectados (por gravedad)

### Crítico
1. **No se puede desplegar en Vercel tal cual**: depende de Socket.IO, de un proceso persistente y de estado en memoria. Evidencia: `server.js:21-22,35,168-295,322` [V].
2. **La puntuación por rapidez está rota**: todo acierto vale 1000. Evidencia: `index.html:386,413,574` frente a `index.html:349-358` [V].
3. **Puntos sin límite con un cliente modificado**: el `timeLeft` viene del cliente y no se limita. Evidencia: `server.js:57-61,223,235` [V].
4. **`host_join` sin protección**: cualquiera con el PIN puede secuestrar el control de la partida. Evidencia: `server.js:172-176` [V].
5. **`/upload` público** con la clave de OpenAI de quien lo despliega y sin límite de tamaño ni de peticiones. Evidencia: `server.js:23,64` [V].

### Importante
6. **Posible caída del proceso** si responde un socket que no es jugador. Evidencia: `server.js:237` [I/P].
7. **Sin reconexión**: si un alumno recarga, pierde todo; si recarga el profesor, se cancela la partida. Tampoco se puede entrar tarde. Evidencia: `server.js:184,277-294` [V].
8. **Los alumnos fuera del top 5 no ven su posición** entre preguntas ni al final. Evidencia: `server.js:265-267`, `index.html:498,538-543` [V].
9. **El tiempo no lo controla el servidor**: se aceptan respuestas fuera de plazo y el móvil no tiene cuenta atrás. Evidencia: `server.js:225`, `index.html:378,413` [V].
10. **Las preguntas no se pueden revisar ni guardar**: la IA genera en el momento de jugar, lo contrario de lo decidido para el Trivial. Evidencia: `server.js:85-153` [V].
11. **`express.static(__dirname)` publica el código fuente y la configuración**. Evidencia: `server.js:13` [V].

### Menor
12. Interfaz en inglés y `lang="en"` (`index.html:2`) [V].
13. Nombres sin validar ni deduplicar; la insignia equivocada desaparece al salir un alumno (`server.js:183-189`, `index.html:337-339`) [V].
14. `timeLimit` sin validar en el servidor (`server.js:151`) [V].
15. No hay máquina de estados en `next_question` (`server.js:211-220`) [V].
16. Fuga de memoria con partidas creadas sin profesor (`server.js:145-153`) [V].
17. QR dependiente de `api.qrserver.com` (`index.html:320`) [V].
18. `user-scalable=no` y accesibilidad básica floja (`index.html:6`) [V].
19. Código muerto (`index.html:397,444`, `myTotalScore`) [V].
20. «Play again» recarga la página y obliga a regenerar el quiz (`index.html:232`) [V].
21. README inexacto (Tailwind) [V].

---

## 11. Puntos fuertes que conviene conservar

- **Flujo Kahoot completo y claro**: rol → sala de espera con PIN y QR → pregunta en el proyector y botones de color en el móvil → resultados con barras y top 5 → podio con confeti [V].
- **Diseño visual** cuidado y coherente (`styles.css`): variables CSS, tipografía fluida, colores y formas de las opciones, animaciones y podio 2-1-3 [V].
- **Rejilla 2×2 del móvil** a pantalla casi completa, con forma y letra además del color [V].
- **Pantalla de resultados del profesor** con la pregunta, la correcta resaltada y la distribución de respuestas: muy útil para comentar en clase [V].
- **No se filtra la correcta** antes de responder y se impide responder dos veces en el servidor [V].
- **Escapado de HTML** en las zonas que usan `innerHTML` (`index.html:458,486,528`) [V].
- **Validación de la estructura** de preguntas (4 opciones, índice 0-3), reutilizable para validar mazos (`server.js:129-137`) [V].
- La lógica de puntuación por rapidez (`server.js:57-61`) es correcta como fórmula; solo falla la medición del tiempo.

---

## 12. Oportunidades de mejora (priorizadas, sin desarrollar)

1. Sustituir la generación con IA por la carga de mazos JSON revisados (formato compatible con el Trivial).
2. Elegir un transporte de tiempo real compatible con Vercel (servicio gestionado) o mantener un servidor Node aparte.
3. Que el servidor o la autoridad central controle el tiempo y calcule la puntuación a partir de su propio reloj.
4. Reconexión de alumnos y profesor (identificador persistente en `localStorage`, estado recuperable).
5. Que cada alumno vea su posición y su puntuación (no solo el top 5), también al final.
6. Cuenta atrás y número de pregunta en el móvil.
7. Proteger el rol de profesor (token secreto al crear la partida).
8. Traducir la interfaz al español.
9. Mostrar la `explicacion` del mazo en la pantalla de resultados.
10. Sonidos y música opcionales.
11. QR generado en local.
12. Accesibilidad: permitir el zoom, `aria-label`, `prefers-reduced-motion`.
13. Separar el JS y el CSS en línea, y añadir tests de la lógica de juego.
14. Repetir la partida con el mismo mazo sin recargar.

---

## 13. Pendiente de verificar

- [P] Si GitHub tiene commits más nuevos que `origin/main` (no he hecho `fetch`).
- [P] Si existe un despliegue activo en Render (u otro sitio), su URL y su plan.
- [P] Si un `submit_answer` desde un socket que no es jugador tumba realmente el proceso (`server.js:237`).
- [P] Comportamiento real con 25-30 móviles a la vez y con la wifi del centro (posibles cortes de WebSocket).
- [P] Legibilidad real en el proyector del aula (tamaño del enunciado y contraste de las opciones translúcidas).
- [P] Calidad y fiabilidad de las preguntas que genera GPT-4o con los PDF reales del módulo.
- [P] Que `api.qrserver.com` y Google Fonts no estén bloqueados por el filtro de red del centro.
- [P] Si la clave de OpenAI del `.env` sigue activa o tiene saldo (no se ha llamado a la API).

---

## 14. Preguntas para Fran

1. ¿Llegaste a usar NeuroQuiz en clase? ¿Qué falló o qué echaron de menos los alumnos?
2. ¿Está desplegado en Render (o en otro sitio)? ¿Hay que mantener esa URL o se puede retirar?
3. ¿Quieres mantener la opción de generar preguntas con IA como herramienta para **preparar** mazos (fuera del juego) o descartarla del todo?
4. ¿Los mazos serán los mismos que los del Trivial (mismo JSON) o un formato propio para el Kahoot? ¿Te sirve ignorar `categorias` y `color`?
5. Tiempo real en Vercel: ¿aceptas un servicio externo gestionado (Supabase, Firebase, Ably…) con su cuenta y su plan gratuito, o prefieres mantener un pequeño servidor aparte?
6. ¿Cuántos alumnos sueles tener a la vez? ¿Usan móviles propios o los del centro? ¿La wifi es fiable?
7. ¿Hace falta guardar resultados (historial por alumno o por grupo) o basta con el ranking en directo? Esto afecta a la privacidad.
8. ¿Los alumnos deben entrar con un apodo libre o con el nombre real o de una lista? ¿Te preocupan los apodos ofensivos?
9. ¿Quieres otros tipos de pregunta (verdadero/falso, imágenes) o basta con 4 opciones?
10. ¿Nombre definitivo del juego: «NeuroQuiz» u otro?
