# Fase 2 de 6: nuevo proyecto, mazos y configuración de partida

Lee CLAUDE.md, docs/AUDITORIA.md, docs/decision-tiempo-real.md y
docs/diseno-aula-quiz.md antes de empezar. Si este mensaje no termina con la
línea «FIN DEL PROMPT», ha llegado cortado: para y dímelo.

## Objetivo

Arrancar la versión nueva, «Aula Quiz», con el stack acordado, y que el
profesor pueda elegir mazo y configurar la partida. Todavía sin tiempo real ni
móviles: eso es la fase 3. La versión antigua (server.js) debe seguir
funcionando igual hasta la fase 4.

## Decisiones ya tomadas

- Nombre del juego: **Aula Quiz** (sustituye a NeuroQuiz en la versión nueva).
- Stack: Vite, React, TypeScript, Tailwind, zod y vitest, como en Aula Trivial.
- Diseño: docs/diseno-aula-quiz.md es la referencia obligatoria. Las opciones
  se identifican por **letra (A-D) y color**, nunca por formas geométricas.
  Corrige en docs/decision-tiempo-real.md y en CLAUDE.md cualquier mención a
  conservar «bloques de opción con forma».
- Servicio de tiempo real: pendiente de mi decisión, no lo uses aún.

## Reglas

- Enséñame el plan paso a paso y espera mi confirmación antes de tocar nada.
- Trabaja en la rama v2. No toques main.
- Paso 0: guarda este prompt tal cual en docs/prompts/fase-2.md y haz un
  commit aparte con docs/diseno-aula-quiz.md (lo añadí yo; no cambies su
  contenido).
- La versión nueva va en una carpeta propia (propón el nombre, por ejemplo
  app/). No modifiques server.js, index.html ni styles.css.
- Dependencias: solo las del stack acordado y las que hagan falta para que
  funcione. Dime cuáles instalas y por qué.
- No llames a OpenAI ni a ningún servicio de tiempo real.
- Un commit por tarea, con mensaje en español.
- Si algo no coincide con lo esperado, para y coméntamelo.

## Tareas

1. **Esqueleto del proyecto** con el stack acordado, en su carpeta, con
   scripts para desarrollo, compilación, tests, lint y tipos. Fuentes y
   colores de la guía de diseño configurados en Tailwind. Interfaz en
   español y `lang="es"`.

2. **Formato de mazo.** Usa exactamente el formato v1 de Aula Trivial. Está
   en el repositorio privado fcarros/Trivial-Antigravity, rama v2, en
   game-core (esquema y validador) y docs/formato-mazo.md. Puedes leerlo
   desde GitHub; no escribas en ese repositorio. Copia el esquema y el
   validador sin cambiar las reglas, para que un mismo archivo sea válido en
   los dos juegos. Anota en CLAUDE.md que es una copia y de qué commit sale.

3. **Mazos incluidos.** Copia de ese mismo repositorio los tres mazos de su
   carpeta mazos/ (Tema 1 y Tema 2 de Comercio Digital Internacional e
   Industria 4.0). Se empaquetan con la app al compilar, como en el Trivial.

4. **Biblioteca de mazos**: incluidos e importados (archivo .json, validado y
   guardado en el navegador, con manejo de errores), exportar y borrar los
   importados. Un mazo importado se vuelve a validar cada vez que se carga.

5. **Configuración de partida** (pantalla del profesor), con el estilo de la
   guía:
   - elegir mazo (agrupados por módulo);
   - número de preguntas: 10, 15, 20, 30 o todas;
   - categorías que entran (por defecto, todas);
   - dificultad: todas, fácil, media o difícil; solo se ofrecen las que el
     mazo puede cubrir con el número elegido;
   - segundos por pregunta: 10, 20, 30 o 60;
   - mostrar o no la explicación tras cada pregunta.
   Al pulsar «Crear partida», la selección de preguntas se hace al azar
   respetando los filtros, sin repetir, y se muestra un resumen. La sala de
   espera y la partida llegan en la fase 3.

6. **Tests** con vitest: el validador (copiar también los tests del Trivial
   si existen), la selección de preguntas con cada filtro, y que nunca se
   ofrezca una combinación imposible.

7. **Verificación:** tipos, tests, lint y compilación sin errores; la versión
   antigua sigue arrancando como antes; y la pantalla de configuración se
   comprueba en un navegador sin ventana a 1920×1080, con una captura que me
   describas.

8. Actualiza CLAUDE.md (estado y pendientes) y README.md, y sube la rama v2.

## Entrega

- Lista de commits y dependencias instaladas.
- Resultado de cada verificación y número de tests.
- Lista de comprobaciones manuales para que yo pruebe la configuración.
- Cualquier cosa inesperada o que hayas dejado sin hacer, y por qué.

FIN DEL PROMPT
