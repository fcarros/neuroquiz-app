# Aula Quiz — guía de diseño (referencia para la fase de interfaz)

Aprobada a partir de los bocetos del 27-10-2026. Siete pantallas: proyector
(sala de espera, pregunta, respuesta y ranking, podio) y móvil (unirse,
responder, resultado). Estilo «concurso de televisión»: fondo oscuro, colores
intensos, mucha legibilidad.

## Colores

| Uso | Color |
|---|---|
| Fondo | #0C0E1A |
| Superficie (tarjetas) | #171A2B |
| Superficie 2 (chips, filas) | #20243A |
| Bordes | #2C3150 |
| Texto principal | #F6F4EE |
| Texto secundario | #A9AEC7 |
| Acento (botones principales, PIN, puntos) | #FFC53D, con texto #1A1405 |
| Correcto | #8BDC5B (fondo de tarjeta correcta #1C2B22) |
| Bajada en el ranking | #FF8F75 |

Opciones de respuesta, siempre con letra además de color (daltonismo) y texto
oscuro #14101A encima:

| Opción | Color |
|---|---|
| A | #FF6B4A |
| B | #34C8EA |
| C | #FFC53D |
| D | #8BDC5B |

No usar las formas geométricas de Kahoot (triángulo, rombo, círculo, cuadrado):
la identidad es letra + color.

## Tipografía

- Títulos, números y botones: **Bricolage Grotesque** (pesos 700–800).
- Texto: **Figtree** (400–700).
- Cifras con `font-variant-numeric: tabular-nums`.

## Tamaños mínimos

- Proyector (diseñado a 1920×1080): enunciado 64 px; opciones 38 px; PIN
  200 px; textos secundarios nunca por debajo de 22 px.
- Móvil (390 px de ancho): opciones 18 px; botones de al menos 60 px de alto;
  las cuatro opciones ocupan la mitad inferior de la pantalla.
- Radios: tarjetas grandes 40 px, opciones 28 px (proyector) y 20 px (móvil),
  chips 999 px.

## Pantallas y contenido

1. **Sala de espera (proyector):** logotipo, mazo elegido (título, nº de
   preguntas, segundos), dirección web, PIN enorme, QR real, contador de
   jugadores, nombres en chips y botón «Empezar».
2. **Pregunta (proyector):** «4 / 15», categoría, «18 de 24 han respondido»,
   barra de progreso del tiempo, temporizador circular, enunciado y las cuatro
   opciones en cuadrícula 2×2.
3. **Respuesta y ranking (proyector):** enunciado atenuado, las cuatro
   opciones con nº de votos (la correcta resaltada en verde con marca, las
   demás atenuadas), recuadro «Por qué» con la explicación del mazo, top 5 con
   puntos y subidas/bajadas, botón «Siguiente».
4. **Podio (proyector):** podio 2-1-3 con nombres y puntos, y tres datos:
   aciertos de la clase, pregunta que más costó y mejor racha. Botones «Ver
   resultados de todos» y «Nueva partida».
5. **Unirse (móvil):** PIN y nombre, botón «Entrar», aviso de que al recargar
   se vuelve a entrar con los puntos.
6. **Responder (móvil):** nombre y puntos, «Pregunta 4 de 15» con segundos y
   barra, enunciado, cuatro botones grandes con letra y texto.
7. **Resultado (móvil):** correcto/incorrecto, puntos ganados, tiempo y racha,
   puesto y puntos totales, «Mira la pantalla».
