# Fase 3A: motor de partida, pantallas y conexión local
Lee CLAUDE.md, docs/diseno-aula-quiz.md y docs/decision-tiempo-real.md. Si este mensaje no termina con «FIN DEL PROMPT», ha llegado cortado: para.
## Objetivo
Una partida completa jugable en un ordenador: el proyector en una pestaña y los «móviles» en otras pestañas del mismo navegador, comunicadas por BroadcastChannel. Sin Ably todavía (fase 3B), pero con una capa de transporte propia para que cambiar a Ably solo sustituya esa pieza.
## Reglas
- Enséñame el plan y espera mi confirmación. Rama v2, solo dentro de app/.
- Paso 0: guarda este prompt en docs/prompts/fase-3a.md y versiona el script de capturas en app/scripts/.
- Dependencias: solo una librería para generar el QR sin internet; dime cuál.
- Un commit por tarea, en español. Si algo no cuadra, para y dímelo.
## Arquitectura
- El navegador del profesor es el árbitro: estado de la partida en datos planos y una función pura (estado, acción) -> estado. Relojes y azar inyectados para que los tests sean deterministas.
- Transporte: interfaz propia (conectar a una sala, enviar a todos, enviar a un jugador, recibir). Implementación local con BroadcastChannel.
- Mensajes con esquema zod. Todo lo que llega de un móvil se valida y se descarta si no cumple.
- Los móviles nunca reciben la respuesta correcta hasta que el profesor cierra la pregunta.
## Reglas de juego
- Sala con PIN de 6 cifras y QR con la dirección y el PIN.
- El alumno entra con un nombre de hasta 15 caracteres (si se repite, se numera). Se recomienda nombre de pila o apodo: dilo en la pantalla.
- Puede entrar con la partida empezada, con 0 puntos.
- El profesor puede expulsar a un jugador desde la sala.
- Puntos por acierto: round(1000 × (1 − t / límite ÷ 2)), con t medido por el reloj del profesor al recibir la respuesta. Fallo o sin respuesta: 0.
- La racha se muestra pero no suma puntos.
- Una sola respuesta por jugador y pregunta. Las que lleguen después del límite (con 500 ms de margen) se ignoran.
- La pregunta se cierra al acabar el tiempo o cuando han respondido todos.
- Reconexión: cada móvil guarda un identificador secreto en su navegador y vuelve con sus puntos si recarga. El profesor también puede recargar: la partida se guarda en su navegador y continúa.
## Pantallas (según docs/diseno-aula-quiz.md)
- Proyector: sala de espera, pregunta, respuesta con votos y «Por qué» (si está activada la explicación), ranking top 5, podio y tabla final de todos con descarga en CSV.
- Controles del profesor: Empezar, Siguiente, Saltar pregunta y Terminar.
- Móvil: unirse, esperando, responder, resultado de la pregunta y final con su puesto.
## Tests
Motor (flujo completo, puntuación, cierre por tiempo y por todos respondidos), anti-trampas (respuesta doble, tardía, de jugador desconocido, mensaje malformado), reconexión del alumno y del profesor, y una partida simulada con 30 jugadores sobre el transporte local.
## Verificación
Tipos, tests, lint y compilación sin errores. Con Chrome sin ventana: un proyector y 3 pestañas de móvil (390 px de ancho) juegan una partida de 5 preguntas completa, incluida una recarga de un móvil a mitad. Descríbeme las capturas. Actualiza CLAUDE.md y README.md y sube v2.
## Entrega
Commits, verificación, número de tests, cómo probarlo yo con varias pestañas paso a paso y cualquier cosa inesperada.
FIN DEL PROMPT
