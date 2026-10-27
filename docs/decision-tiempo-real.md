# Decisión de tiempo real (y propuesta de stack)

Fase 1 · Documentación consultada el **2026-10-27** en las webs oficiales de
cada servicio (enlaces en cada fila). «No confirmado» = no aparece en ninguna
fuente oficial consultada.

**Decisión pendiente de Fran antes de la fase 3.** Este documento recomienda,
no elige.

## Qué necesitamos

- Una clase: hasta **31 conexiones** (30 móviles + proyector) a la vez.
- Volumen pequeño. Estimación por partida de 20 preguntas:
  - por pregunta, ≈ 1 envío a 31 móviles + 30 respuestas + 30 avisos
    individuales + 1 resultado a 31 móviles, unos 125 mensajes contados por
    entrega;
  - en total, **≈ 3 000-5 000 mensajes por partida**.
- **Tiene que funcionar tras semanas sin uso** sin entrar al panel de nada.
- Ninguna clave privada en el frontend. Una función de Vercel puede emitir
  credenciales temporales.
- Centro educativo en España: preferible que los datos estén en la UE. Solo
  hay apodos y puntuaciones, y no hace falta guardar historial.
- El navegador del profesor es el árbitro, así que el servicio solo
  transporta mensajes. Basta con publicar/suscribir y, si puede ser, presencia.

## ¿Ofrece Vercel algo propio?

**Sí, desde hace una semana, pero no basta por sí solo.** Las funciones de
Vercel admiten WebSockets de forma nativa en todos los planes. Está disponible
para todos desde el 20/10/2026 ([changelog][v1]) y requiere Fluid compute
([docs][v2]). Limitaciones para este caso:

- Cada conexión queda fijada a una instancia. Las salas, la presencia y el
  pub/sub entre instancias necesitan un almacén externo, que Vercel sugiere
  sea Redis del Marketplace ([docs][v2]).
- La conexión se cierra al llegar a la duración máxima de la función
  ([docs][v2]). En el plan Hobby son **300 s** ([límites][v3]), así que cada
  móvil se reconectaría al menos cada 5 minutos en mitad de la partida.
- Vercel no tiene un pub/sub gestionado propio. Para repartir mensajes a
  muchos clientes recomienda proveedores gestionados, como Ably, Pusher o
  Liveblocks, que tienen integración en su Marketplace ([guía][v4]).

Conclusión: sería posible, pero supone escribir y mantener un servidor de
WebSockets, añadir Redis (otro servicio con su propio plan gratuito) y
gestionar reconexiones forzadas. Es más trabajo que un servicio gestionado y no
lo recomiendo para este proyecto.

## Comparativa

| | **Ably** (Free) | **Pusher Channels** (Sandbox) | **Firebase Realtime DB** (Spark) | **Supabase Realtime** (Free) | **PartyKit / Cloudflare DO** (Workers Free) |
|---|---|---|---|---|---|
| **Conexiones simultáneas** | 200 [a1] | 100 [p1] | 100 por base de datos, no ampliable [f1] | 200 [s1] | Sin tope publicado por objeto [c3] |
| **Mensajes** | 6 M/mes, 500/s en la cuenta, 50/s por canal, 64 KiB por mensaje [a1][a2] | 200 000/día (cuenta cada entrega a cada cliente), 10 KB por mensaje [p1][p2][p3] | 1 GB almacenado, 360 MB/día de descarga [f2] | 2 M/mes, 100/s, 256 KB por mensaje [s1][s2] | 100 000 peticiones/día. Los mensajes WebSocket entrantes cuentan 20:1 y los salientes son gratis [c2] |
| **Otros límites** | 200 canales, 200 miembros de presencia, historial 1 día [a1] | Eventos de cliente solo en canales privados, 10/s por conexión [p4] | ~1 000 escrituras/s [f3] | 2 proyectos activos, 500 MB de BD [s1] | 10 ms de CPU por petición HTTP [c4] |
| **Pausa o borrado por inactividad** | Las condiciones se reservan «archivar cuentas inactivas durante un periodo prolongado», sin fijar plazo [a3]. Sin pausa automática documentada | No confirmado | No confirmado (sin política publicada) | **Sí: se pausa tras 7 días con poca actividad.** Se reanuda a mano desde el panel, con hasta 1 año para hacerlo [s3] | **El PartyKit alojado cerró el 23/10/2026** [c1]. Cloudflare: no confirmado |
| **Si se supera el límite** | Corta: rechaza conexiones o mensajes (errores 40111/40112). No pide tarjeta [a2][a4] | Corta: 403 «over quota». Aviso al 80 % y al 100 % [p5] | Corta: «la app se desactiva» hasta el siguiente ciclo. No pide tarjeta [f1][f2] | No cobra. Tras un periodo de gracia puede pausar el proyecto, ponerlo en solo lectura o devolver 402 [s4] | Corta hasta el reinicio diario. No cobra [c2] |
| **Credenciales con web estática** | Token o JWT firmado en una función de Vercel con la clave en el servidor. Permisos por canal y `clientId` [a5] | La clave pública va en el cliente. El secreto firma la autorización de canales privados en una función de Vercel [p6] | La configuración es pública por diseño. La seguridad depende de las reglas de seguridad y App Check [f4] | La clave publicable es pública por diseño. Canales privados con RLS y JWT [s5][s6] | Código propio en un Worker. La autenticación se programa a mano [c1] |
| **Región y privacidad** | Empresa del Reino Unido. Los mensajes en tránsito pasan por más de 14 centros de datos. **Residencia solo en la UE únicamente en Enterprise**. DPA con cláusulas contractuales tipo en sus condiciones [a6][a7] | Clúster `eu` (Irlanda) elegible al crear la app. No confirmado que esté en Sandbox. DPA estándar de Bird [p7][p8] | `europe-west1` (Bélgica) elegible al crear la base de datos. DPA en las condiciones de Firebase [f5][f6] | Regiones de la UE (Irlanda, París, Fráncfort…). No confirmado que se puedan elegir en Free. DPA con cláusulas contractuales tipo [s7][s8] | Jurisdicción `eu` para Durable Objects. No confirmado que esté en Free [c5] |
| **Librería de navegador** | `ably` 2.30 (oct-2026), madura desde 2015. Reconecta y recupera los mensajes perdidos si vuelve en menos de 2 min. Tiene presencia [a8][a9] | `pusher-js` 8.6 (jul-2026), madura desde 2015 y ligera (~18 KB gzip). Presencia sí, historial no [p9] | `firebase` (modular), muy madura. `onDisconnect()` para la presencia y reconexión automática [f7] | `@supabase/supabase-js`, madura. Broadcast y presencia, con reconexión automática [s2][s9] | `partysocket` (reconexión con backoff). Presencia hecha a mano [c6][c3] |
| **Encaje con nuestro modelo** | Pub/sub puro: el navegador del profesor es el árbitro de forma natural | Pub/sub puro, pero los mensajes de los móviles exigen canales privados con autorización | Es una base de datos: el «mensaje» es una escritura. Las reglas permiten que un móvil escriba solo en su nodo | Broadcast encaja bien | Un servidor propio fuera de Vercel, con su cuenta, despliegues y vigilancia |

### Lectura de la tabla

- **Supabase queda descartado** por el criterio crítico. Un proyecto gratuito
  se pausa tras 7 días sin actividad y hay que reanudarlo a mano [s3].
- **PartyKit alojado ya no existe** [c1]. La alternativa (PartyServer o
  Durable Objects en Cloudflare propio) añade una segunda plataforma que
  mantener.
- **Pusher** sirve, pero tiene el plan más justo: 100 conexiones y 200 000
  mensajes al día contando cada entrega. Además, para que los móviles envíen
  mensajes hacen falta canales privados con autorización.
- **Ably** y **Firebase** cumplen todos los criterios críticos con margen
  amplio. Para ninguno de los dos he encontrado una política de pausa por
  inactividad.

## Recomendación

**Ably (plan Free)**, con autenticación por JWT firmado en una función de
Vercel (`api/token`):

1. Ninguna pausa automática documentada, sin tarjeta y con corte duro en lugar
   de cobro [a2][a3][a4]. Es el riesgo más bajo para «semanas sin uso».
2. 200 conexiones y 6 M de mensajes al mes: más de 6 veces lo necesario en
   conexiones y unas 1 000 veces lo necesario en mensajes [a1].
3. El modelo encaja: canales por partida, un `clientId` por alumno dentro del
   token (así nadie puede publicar como otro) y permisos distintos para el
   profesor y los alumnos [a5].
4. La librería reconecta y recupera los mensajes perdidos si el corte dura
   menos de 2 minutos, que es lo típico con la wifi del aula [a9].
5. La clave privada solo vive en una variable de entorno de Vercel.

**Puntos débiles que hay que aceptar:**
- No garantiza que los datos se queden en la UE en el plan gratuito [a7].
- Es una empresa del Reino Unido, con DPA y cláusulas contractuales tipo
  [a6][a7].

Para mitigarlo: no activar el historial, usar solo apodos (nunca nombres
reales) y no guardar nada en el servicio.

## Alternativa

**Firebase Realtime Database (Spark) en `europe-west1`:**

- Datos en la UE [f5].
- Sin secretos en el frontend ni función de tokens: la configuración es
  pública y la seguridad va en las reglas [f4].
- Sin tarjeta, con corte duro [f1][f2].
- 100 conexiones, suficientes para 31 [f1].

En contra:
- Exige escribir y probar bien las reglas de seguridad. La garantía de que
  nadie responda por otro dependería de las reglas, con Firebase Auth anónimo
  (que procesa datos en EE. UU. [f6]) o con un identificador secreto en la
  ruta.
- La política de inactividad no está publicada [f1].

## Fuentes (consultadas el 2026-10-27)

Vercel
- [v1]: https://vercel.com/changelog/websocket-support-is-now-generally-available
- [v2]: https://vercel.com/docs/functions/websockets
- [v3]: https://vercel.com/docs/functions/limitations
- [v4]: https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel

Ably
- [a1] https://ably.com/pricing
- [a2] https://ably.com/docs/platform/pricing/limits
- [a3] https://ably.com/terms (§5.2)
- [a4] https://ably.com/docs/platform/pricing/free · https://ably.com/docs/platform/errors/codes/40112-account-message-limit-exceeded
- [a5] https://ably.com/docs/auth/token
- [a6] https://ably.com/data-protection · https://ably.com/data-processing-addendum
- [a7] https://ably.com/docs/platform/account/enterprise-customization
- [a8] https://registry.npmjs.org/ably
- [a9] https://ably.com/docs/connect/states

Pusher
- [p1] https://pusher.com/channels/pricing/
- [p2] https://pusher.com/legal/quotas/
- [p3] https://bird.com/docs/pusher/limits/what-is-the-message-size-limit-when-publishing-an-event-in-channels
- [p4] https://pusher.com/docs/channels/using_channels/events/
- [p5] https://bird.com/docs/pusher/limits/what-happens-when-i-hit-my-channels-plan-limits
- [p6] https://pusher.com/docs/channels/server_api/authorizing-users/
- [p7] https://pusher.com/docs/channels/miscellaneous/clusters/
- [p8] https://bird.com/docs/pusher/legal/can-i-sign-a-dpa-with-pusher
- [p9] https://registry.npmjs.org/pusher-js · https://github.com/pusher/pusher-js

Firebase
- [f1] https://firebase.google.com/docs/database/faq-and-troubleshooting · https://firebase.google.com/docs/database/usage/limits
- [f2] https://firebase.google.com/pricing
- [f3] https://firebase.google.com/docs/database/usage/limits
- [f4] https://firebase.google.com/docs/projects/api-keys
- [f5] https://firebase.google.com/docs/database/locations
- [f6] https://firebase.google.com/support/privacy
- [f7] https://firebase.google.com/docs/database/web/offline-capabilities

Supabase
- [s1] https://supabase.com/pricing
- [s2] https://supabase.com/docs/guides/realtime/limits
- [s3] https://supabase.com/docs/guides/platform/project-pausing
- [s4] https://supabase.com/docs/guides/platform/cost-control · https://supabase.com/docs/guides/platform/billing-faq
- [s5] https://supabase.com/docs/guides/api/api-keys
- [s6] https://supabase.com/docs/guides/realtime/authorization
- [s7] https://supabase.com/docs/guides/platform/regions
- [s8] https://supabase.com/legal/dpa
- [s9] https://supabase.com/docs/guides/realtime/presence

Cloudflare / PartyKit
- [c1] https://docs.partykit.io/ · https://docs.partykit.io/guides/migrate-to-partyserver/
- [c2] https://developers.cloudflare.com/durable-objects/platform/pricing/
- [c3] https://developers.cloudflare.com/durable-objects/platform/limits/ · https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- [c4] https://developers.cloudflare.com/workers/platform/limits/
- [c5] https://developers.cloudflare.com/durable-objects/reference/data-location/
- [c6] https://github.com/cloudflare/partykit/tree/main/packages/partysocket

[v1]: https://vercel.com/changelog/websocket-support-is-now-generally-available
[v2]: https://vercel.com/docs/functions/websockets
[v3]: https://vercel.com/docs/functions/limitations
[v4]: https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel
