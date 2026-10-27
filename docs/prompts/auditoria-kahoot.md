# Tarea: auditoría completa del proyecto (solo lectura)

Si este mensaje no termina con la línea «FIN DEL PROMPT», ha llegado cortado:
para y dímelo antes de hacer nada.

Vas a auditar este proyecto: un juego educativo tipo Kahoot para usar en clase
con alumnado de FP. Existe un desarrollo anterior en esta carpeta y,
probablemente, un repositorio en GitHub. El objetivo es dar contexto completo y
fiable a otra sesión de planificación, que decidirá cómo mejorarlo y publicarlo
en Vercel.

## Contexto

Ya hemos rehecho con éxito otro juego del mismo profesor, «Aula Trivial» (otra
carpeta, no la toques ni la busques). Allí acordamos estas decisiones, que
probablemente reutilicemos aquí:

- Las preguntas viven en «mazos» guardados y revisados de antemano, no se
  generan con IA en el momento de jugar.
- Formato de mazo del Trivial (versión 1), en JSON: campos "formato", "id",
  "titulo", "modulo", "descripcion" (opcional), "categorias" (6, una por color)
  y "preguntas". Cada pregunta tiene "id", "color", "enunciado", "opciones"
  (exactamente 4), "correcta" (posición 0-3), "dificultad" (facil, media o
  dificil, opcional) y "explicacion" (opcional).
- La web se publica en Vercel como web estática. Ninguna clave de API va en el
  frontend.

## Reglas

- NO modifiques, muevas ni borres ningún archivo existente.
- NO hagas commits, push, pull, merge ni cambies de rama.
- NO instales ni actualices dependencias.
- NO ejecutes la aplicación ni llames a ninguna API externa (OpenAI, Firebase,
  Supabase u otras). Si para comprobar algo haría falta, anótalo como
  pendiente.
- NO muestres el contenido de archivos .env ni de ninguna clave: di solo si
  existen, dónde están y si están versionados en git.
- Lo único que puedes crear es el archivo `AUDITORIA.md` en la raíz.
- Puedes ejecutar comandos de solo lectura (git status, git log, ls, cat,
  grep…) y comprobar que el código compila sin generar archivos (por ejemplo
  `tsc --noEmit`), si las dependencias ya están instaladas.
- Marca cada afirmación: [V] verificado en el código o en un comando,
  [I] inferido, [P] pendiente de verificar. Cita rutas y líneas.
- No propongas todavía una reescritura ni arregles nada.

## Qué analizar

1. **Git y GitHub**: remoto, ramas, sincronización con GitHub, cambios sin
   confirmar, resumen del historial (fechas, número de commits, últimos 15),
   .gitignore y archivos que no deberían estar versionados.

2. **Estructura y stack**: árbol de carpetas comentado (sin node_modules ni
   similares), lenguajes, frameworks y versiones, cómo se arranca, si tiene
   backend o base de datos, y si está desplegado en algún sitio y con qué
   configuración.

3. **Multijugador y tiempo real** (lo más importante en un Kahoot):
   - ¿Cómo se unen los alumnos? Código de sala, QR, enlace, nombre…
   - ¿Con qué tecnología se sincronizan las pantallas? WebSockets propios,
     Socket.IO, Firebase, Supabase, sondeo periódico, otra.
   - ¿Dónde vive el estado de la partida? Servidor, base de datos, navegador
     del profesor.
   - ¿Qué pasa si un alumno recarga la página, pierde la conexión o entra
     tarde? ¿Y si se recarga la pantalla del profesor?
   - ¿Cuántos jugadores soporta y qué límites tiene (planes gratuitos,
     conexiones)?
   - ¿Funcionaría en Vercel tal como está? Vercel no mantiene conexiones
     WebSocket persistentes en sus funciones: indica qué partes serían
     compatibles y cuáles no.

4. **Funcionalidad del juego**: flujo completo (crear partida, sala de
   espera, pregunta, respuesta, resultados, ranking, podio final),
   temporizador, puntuación (¿premia la rapidez?), tipos de pregunta,
   sonidos, pantalla del profesor frente a pantalla del alumno. Para cada
   función: completa / a medias / rota / esbozada. Código muerto y TODOs.

5. **Preguntas y contenido**: de dónde salen (archivo, PDF, IA, formulario),
   formato exacto con un ejemplo real, cuántas hay y de qué materia, y qué
   habría que hacer hoy para cambiar de temario. Compara el formato con el del
   mazo del Trivial descrito arriba: qué coincide, qué falta y qué sobra.

6. **Calidad del código**: arquitectura, gestión del estado, duplicación,
   manejo de errores, errores probables o confirmados con su ubicación, tests.

7. **Interfaz y uso en el aula**: diseño visual, legibilidad en proyector,
   uso en móvil (la pantalla del alumno es crítica), accesibilidad básica.

8. **Seguridad y privacidad**: claves y credenciales (dónde están y si se han
   versionado alguna vez en el historial), reglas de acceso de la base de
   datos si la hay, qué datos del alumnado se guardan y dónde, y si se pueden
   hacer trampas (ver la respuesta correcta desde el móvil, responder dos
   veces, suplantar a otro jugador).

9. **Documentación**: README, CLAUDE.md u otros, y qué le faltaría saber a
   alguien que abre el proyecto por primera vez.

## Formato de AUDITORIA.md

En español, con estas secciones y en este orden:

0. Resumen ejecutivo (máximo 12 líneas: qué es, en qué estado está,
   veredicto, y si se puede publicar en Vercel tal cual).
1. Git y GitHub.
2. Estructura y stack (con ficha técnica en tabla).
3. Multijugador y tiempo real.
4. Funcionalidad: tabla función / estado / archivo / observaciones.
5. Preguntas y contenido, con la comparación con el formato del Trivial.
6. Calidad del código.
7. Interfaz y uso en el aula.
8. Seguridad y privacidad.
9. Documentación.
10. Problemas detectados, ordenados por gravedad (crítico / importante /
    menor), cada uno con ubicación y evidencia.
11. Puntos fuertes que conviene conservar.
12. Oportunidades de mejora: solo una lista priorizada, sin desarrollar.
13. Pendiente de verificar.
14. Preguntas para Fran (lo que necesitas saber y no se deduce del código).

Sé concreto y evita relleno: no más de unas 600 líneas. Al terminar, muéstrame
en la terminal el resumen ejecutivo y confirma que no has modificado nada más.

FIN DEL PROMPT
