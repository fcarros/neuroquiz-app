# Fase 3B: tiempo real con Ably y publicación en Vercel

Lee CLAUDE.md y docs/decision-tiempo-real.md. Si este mensaje no termina con
«FIN DEL PROMPT», ha llegado cortado: para.

## Objetivo
Que la partida funcione con móviles reales: sustituir el transporte local
por Ably, protegido con credenciales temporales, y publicar app/ en Vercel.

## Reglas
- Enséñame el plan y espera mi confirmación. Rama v2, solo app/ y docs/.
- Paso 0: guarda este prompt en docs/prompts/fase-3b.md.
- La clave está en app/.env.local (ABLY_API_KEY). No la muestres, no la
  copies a ningún otro archivo y comprueba que .env.local está ignorado.
- Dependencias: solo la librería oficial de Ably y lo imprescindible para la
  función de Vercel. Dime cuáles.
- Un commit por tarea, en español. Si algo no cuadra, para y dímelo.

## Tareas
1. Función de Vercel que emite credenciales temporales de Ably con permisos
   mínimos por rol:
   - jugador: solo escuchar los mensajes para todos de su sala y los suyos,
     y solo publicar en el canal del profesor de su sala;
   - profesor: control total de su sala, y solo de su sala.
   Nadie debe poder pedir permisos de profesor para una sala ajena: al crear
   la sala, la función entrega al profesor una prueba firmada (HMAC con un
   secreto en una variable de entorno) que debe presentar después. Genera
   ese secreto, guárdalo en app/.env.local y dime cómo añadirlo en Vercel.
2. Transporte con Ably detrás de la interfaz existente. Mantén el
   transporte local para desarrollo, elegible con un parámetro.
3. Privacidad: sin historial ni persistencia de mensajes en Ably, y sin
   datos personales en los nombres de los canales.
4. Límites: consulta en la documentación oficial los límites del plan
   gratuito (conexiones, mensajes por segundo por canal y por conexión,
   mensajes al mes). Agrupa o limita los envíos del profesor para no
   acercarte a ellos con 30 jugadores (por ejemplo, actualizar «X han
   respondido» como mucho cada 500 ms). Documenta los cálculos.
5. Móviles reales: identidad en localStorage (por sala); aviso visible de
   «Reconectando…» en móvil y proyector; el QR apunta a la dirección pública.
6. Añade 5 a las opciones de número de preguntas.
7. Tests: permisos de cada rol en la función (incluido pedir permisos de
   profesor sin prueba válida o para otra sala) y transporte Ably con dobles.
8. Prueba real: un script que juegue una partida de 10 preguntas contra Ably
   de verdad, con 30 jugadores simulados y una recarga de móvil y de
   profesor. Mide latencia y mensajes consumidos.
9. Configuración para publicar app/ en Vercel (proyecto nuevo, aparte del
   Trivial) y pasos exactos para mí en vercel.com: directorio raíz, rama v2
   como producción y variables de entorno.
10. Actualiza CLAUDE.md y README.md y sube v2.

## Entrega
Commits, verificación, resultado de la prueba real (latencia y mensajes),
pasos para Vercel, cómo probarlo yo con 3 o 4 móviles reales y cualquier
cosa inesperada.

FIN DEL PROMPT
