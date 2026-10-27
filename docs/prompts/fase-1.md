# Fase 1 de 6: limpieza, cimientos y decisión de tiempo real

Lee AUDITORIA.md antes de empezar. Si este mensaje no termina con la línea
«FIN DEL PROMPT», ha llegado cortado: para y dímelo.

## Hacia dónde va el proyecto

NeuroQuiz pasará a funcionar así:

- **Web estática en Vercel.** Sin servidor propio encendido todo el tiempo.
- **El navegador del profesor es el árbitro.** Guarda el estado de la
  partida, marca el inicio y el fin de cada pregunta con su propio reloj,
  calcula los puntos (la rapidez puntúa) y decide qué ve cada móvil. La
  partida se guarda en su navegador para sobrevivir a una recarga.
- **Los móviles solo envían su respuesta.** Nunca reciben la respuesta
  correcta antes de que el profesor la revele. Cada alumno tiene un
  identificador secreto para que nadie pueda responder por otro, y puede
  volver a entrar con su puntuación si recarga.
- **Un servicio de tiempo real externo y gratuito** solo transporta los
  mensajes entre el proyector y los móviles. Ninguna clave privada va en el
  frontend: si el servicio la necesita, una función pequeña de Vercel emite
  credenciales temporales.
- **Mazos de preguntas guardados**, con el mismo formato que el juego «Aula
  Trivial» del mismo profesor, para que los mismos archivos sirvan en los dos
  juegos. La generación desde PDF vuelve en la última fase, protegida.
- Escala: una clase, hasta 30 alumnos a la vez, más el proyector.

Fases: 1) limpieza, cimientos y decisión de tiempo real, 2) mazos,
3) tiempo real y motor de partida, 4) publicación en Vercel y prueba de carga,
5) interfaz, 6) generador desde PDF.

## Reglas

- Enséñame el plan paso a paso y espera mi confirmación antes de tocar nada.
- Crea una rama `v2` desde la rama principal y trabaja solo en ella. No
  modifiques la rama principal ni hagas merge.
- No cambies cómo funciona el juego en esta fase.
- No instales ni actualices dependencias. No llames a OpenAI ni a ningún
  servicio externo, salvo búsquedas web de documentación para la tarea 4.
- No crees cuentas en ningún servicio ni pidas claves.
- No muestres el contenido de .env.
- Un commit por tarea, con mensaje en español.
- Si algo no coincide con lo esperado, para y coméntamelo.

## Tareas

0. **Carpeta de prompts.** La carpeta `docs:prompts:` se creó así por error
   desde el Finder (el Mac convierte «/» en «:»). Crea la estructura correcta
   `docs/prompts/`, mueve allí su contenido, borra la carpeta mal nombrada y
   guarda este prompt tal cual como `docs/prompts/fase-1.md`. Mueve también
   AUDITORIA.md a `docs/`.

1. **Archivos que no deberían estar en el repositorio.** Revisa lo que la
   auditoría señale como generado, temporal o de pruebas. Quita del control
   de versiones lo que sobre y ajusta `.gitignore`. Enséñame la lista antes de
   borrar nada del disco.

2. **CLAUDE.md** en la raíz con: qué es el proyecto y para qué se usa en el
   aula; arquitectura actual y arquitectura objetivo (la de arriba); las 6
   fases y en cuál estamos; comandos para instalar y arrancar; convenciones
   (interfaz en español, commits en español, trabajo en ramas, nunca versionar
   .env ni claves); avisos conocidos de la auditoría; y una sección «Estado»
   con los pendientes, que actualizarás al cerrar cada fase.

3. **README.md** reescrito para que alguien nuevo pueda arrancar la versión
   actual: requisitos, dónde va el .env y cómo se juega hoy.

4. **Decisión de tiempo real.** Crea `docs/decision-tiempo-real.md`
   comparando, con documentación oficial actual consultada en la web (cita las
   fuentes y la fecha de consulta), al menos: Ably, Pusher Channels, Firebase
   Realtime Database, Supabase Realtime y PartyKit / Cloudflare Durable
   Objects. Para cada uno, en una tabla:
   - límites del plan gratuito (conexiones simultáneas, mensajes, otros);
   - si el proyecto gratuito se pausa o se borra por inactividad (crítico: el
     juego puede pasar semanas sin usarse y debe funcionar el día de clase sin
     tocar nada);
   - cómo se protegen las credenciales con una web estática en Vercel;
   - región de los datos y privacidad (centro educativo en España);
   - qué pasa si se supera el límite gratuito (¿corta o cobra?);
   - facilidad de uso y madurez de la librería en el navegador.
   Termina con una recomendación justificada y una alternativa. No elijas por
   mí: espera mi decisión antes de la fase 3.

5. **Propuesta de stack.** En el mismo documento, propón con qué tecnologías
   rehacer el frontend. Ten en cuenta que «Aula Trivial» usa Vite, React,
   TypeScript, Tailwind, zod y vitest, y que conviene poder compartir el
   validador de mazos. Indica qué partes del código actual merece la pena
   conservar (sobre todo el diseño visual y el flujo de juego, que la
   auditoría valora bien). Solo propuesta, no migres nada todavía.

6. **Verificación:** la versión actual sigue arrancando igual que antes (sin
   llamar a OpenAI ni subir ningún PDF), y `git status` queda limpio.

7. Sube la rama `v2` a GitHub si el repositorio tiene remoto. Si no lo tiene,
   dímelo y no crees ninguno.

## Entrega

- Lista de commits.
- Resultado de la verificación.
- Resumen de la decisión de tiempo real en cinco líneas, con tu
  recomendación.
- Resumen de la propuesta de stack.
- Cualquier cosa inesperada o que hayas dejado sin hacer, y por qué.

FIN DEL PROMPT
