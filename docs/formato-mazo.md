> **Nota de Aula Quiz.** Este documento es una copia del de Aula Trivial
> (`fcarros/Trivial-Antigravity`, rama `v2`, commit `b7f3936`). El formato y
> las reglas son idénticos: un mazo válido en un juego lo es en el otro. En
> este repositorio el esquema está en `app/src/mazo/mazo.ts`, los mazos
> incluidos en `app/mazos/` y se comprueban con `npm run validar-mazos`
> (desde `app/`). Aula Quiz usa las categorías como filtro al configurar la
> partida (sin mostrar sus colores) y sí usa `dificultad` y `explicacion`.

# Formato de mazo de preguntas (versión 1)

Un **mazo** es un archivo JSON con todas las preguntas de una partida de Aula Trivial: seis categorías (una por color del tablero) y sus preguntas tipo test de cuatro opciones.

- Los mazos incluidos con la aplicación están en la carpeta `mazos/` (un archivo `.json` por mazo).
- El profesorado también puede **importar** un mazo desde la pantalla de configuración; se guarda en el navegador.
- El esquema y el validador están en `game-core/src/mazo.ts`. Para comprobar los mazos de la carpeta: `npm run validar-mazos`.

## Estructura

```json
{
  "formato": 1,
  "id": "industria-4-0",
  "titulo": "Industria 4.0",
  "modulo": "Digitalización",
  "descripcion": "Texto libre opcional",
  "categorias": [ { "color": "azul", "nombre": "Big Data" } ],
  "preguntas": [
    {
      "id": "p001",
      "color": "azul",
      "enunciado": "¿...?",
      "opciones": ["...", "...", "...", "..."],
      "correcta": 2,
      "dificultad": "media",
      "explicacion": "Texto opcional"
    }
  ]
}
```

### Campos del mazo

| Campo | Obligatorio | Descripción |
|---|---|---|
| `formato` | Sí | Siempre `1`. |
| `id` | Sí | Identificador único del mazo. Recomendado: minúsculas, números y guiones (`industria-4-0`). Se usa como nombre del archivo al exportar. |
| `titulo` | Sí | Título visible del mazo. |
| `modulo` | Sí | Módulo o asignatura de FP. |
| `descripcion` | No | Texto libre. |
| `categorias` | Sí | Exactamente **6**, una por color. |
| `preguntas` | Sí | Lista de preguntas. Cada color necesita al menos una. |

### Categorías

| Campo | Obligatorio | Descripción |
|---|---|---|
| `color` | Sí | Uno de: `azul`, `rosa`, `amarillo`, `marron`, `verde`, `naranja` (sin tilde en `marron`). |
| `nombre` | Sí | Nombre del tema que se muestra en el juego, por ejemplo «Big Data». |

### Preguntas

| Campo | Obligatorio | Descripción |
|---|---|---|
| `id` | Sí | Identificador único dentro del mazo (`p001`, `p002`…). |
| `color` | Sí | Color de la categoría a la que pertenece. |
| `enunciado` | Sí | Texto de la pregunta. |
| `opciones` | Sí | Exactamente **4** textos, no vacíos y distintos entre sí. |
| `correcta` | Sí | Posición de la opción correcta, **empezando en 0** (0, 1, 2 o 3). El juego baraja las opciones al mostrarlas, así que el orden del archivo no importa. |
| `dificultad` | No | `facil`, `media` o `dificil`. Se admite, pero el juego aún no la usa. |
| `explicacion` | No | Texto que explica la respuesta. Se admite, pero el juego aún no la muestra. |

## Validación

### Errores: el mazo no se puede usar
- `formato` distinto de 1.
- Campos obligatorios ausentes o vacíos.
- Categorías que no sean exactamente una por color.
- Una pregunta con un color que no existe.
- Opciones que no sean exactamente 4, vacías o repetidas. Al comparar no cuentan las mayúsculas ni los espacios.
- `correcta` fuera de 0–3, o que no sea un número entero.
- Ids de pregunta repetidos.
- Alguna categoría sin preguntas.
- Textos de relleno:
  - un enunciado como «Pregunta vacía», «Pregunta», «Sin enunciado» o «Lorem ipsum…»;
  - unas opciones que sean exactamente «A», «B», «C» y «D».

### Avisos: se puede usar, pero conviene revisarlo
- Menos de 10 preguntas en una categoría.
- Enunciados duplicados. Al comparar no cuentan las mayúsculas ni los espacios.
- Enunciados de más de 200 caracteres u opciones de más de 80. Se leen mal en el proyector.
- Categorías muy descompensadas: la que más preguntas tiene llega al doble o más que la que menos.

## Ejemplo completo

Un mazo mínimo válido con una pregunta por categoría. Lo aceptaría el validador, pero daría avisos porque cada categoría tiene menos de 10 preguntas.

```json
{
  "formato": 1,
  "id": "redes-basicas",
  "titulo": "Redes: conceptos básicos",
  "modulo": "Sistemas Microinformáticos y Redes",
  "descripcion": "Repaso de la UD 1.",
  "categorias": [
    { "color": "azul", "nombre": "Modelo OSI" },
    { "color": "rosa", "nombre": "Direccionamiento IP" },
    { "color": "amarillo", "nombre": "Cableado" },
    { "color": "marron", "nombre": "Dispositivos" },
    { "color": "verde", "nombre": "Protocolos" },
    { "color": "naranja", "nombre": "Seguridad" }
  ],
  "preguntas": [
    {
      "id": "p001",
      "color": "azul",
      "enunciado": "¿Cuántas capas tiene el modelo OSI?",
      "opciones": ["4", "5", "7", "9"],
      "correcta": 2,
      "dificultad": "facil"
    },
    {
      "id": "p002",
      "color": "rosa",
      "enunciado": "¿Qué máscara corresponde a /24?",
      "opciones": ["255.0.0.0", "255.255.0.0", "255.255.255.0", "255.255.255.255"],
      "correcta": 2,
      "explicacion": "/24 significa 24 bits a 1: tres octetos completos."
    },
    {
      "id": "p003",
      "color": "amarillo",
      "enunciado": "¿Qué conector se usa habitualmente con cable de par trenzado?",
      "opciones": ["RJ-45", "BNC", "SC", "DB-9"],
      "correcta": 0
    },
    {
      "id": "p004",
      "color": "marron",
      "enunciado": "¿Qué dispositivo interconecta redes distintas?",
      "opciones": ["Hub", "Switch", "Router", "Repetidor"],
      "correcta": 2
    },
    {
      "id": "p005",
      "color": "verde",
      "enunciado": "¿Qué protocolo asigna direcciones IP automáticamente?",
      "opciones": ["DNS", "DHCP", "FTP", "ARP"],
      "correcta": 1,
      "dificultad": "media"
    },
    {
      "id": "p006",
      "color": "naranja",
      "enunciado": "¿Qué elemento filtra el tráfico entre redes según unas reglas?",
      "opciones": ["Cortafuegos", "Proxy inverso", "Balanceador", "Concentrador"],
      "correcta": 0
    }
  ]
}
```

## Instrucciones para generar mazos con IA

Copia este texto en un asistente de IA (ChatGPT, Claude, Gemini…). Rellena lo que va entre corchetes y añade el material de la unidad. Después importa el archivo resultante en Aula Trivial, que lo validará.

```text
Genera un mazo de preguntas para el juego «Aula Trivial» a partir del
material que te doy al final. Devuelve SOLO un objeto JSON válido, sin
texto antes ni después y sin bloques de código.

Datos del mazo:
- id: [identificador en minúsculas con guiones, p. ej. "redes-ud1"]
- titulo: [título visible]
- modulo: [módulo de FP]
- Número de preguntas: [p. ej. 12] por categoría.

Reglas obligatorias del formato:
1. Estructura exacta:
   {"formato":1,"id":"...","titulo":"...","modulo":"...","descripcion":"...",
    "categorias":[...],"preguntas":[...]}
2. "categorias": exactamente 6 objetos {"color","nombre"}, uno por cada color:
   "azul", "rosa", "amarillo", "marron", "verde", "naranja" (escritos así,
   sin tildes). "nombre" es un tema del material, de 1 a 3 palabras, y los 6
   temas deben ser distintos y cubrir el material de forma equilibrada.
3. Cada pregunta: {"id","color","enunciado","opciones","correcta"} y,
   opcionalmente, "dificultad" ("facil", "media" o "dificil") y "explicacion"
   (una frase que justifique la respuesta).
   - "id": "p001", "p002"… sin repetir.
   - "color": el de la categoría a la que pertenece la pregunta.
   - "opciones": exactamente 4 textos distintos y no vacíos.
   - "correcta": número entero con la POSICIÓN de la opción correcta en la
     lista, empezando en 0 (0, 1, 2 o 3). Reparte la respuesta correcta entre
     las cuatro posiciones.
4. El mismo número de preguntas en las 6 categorías.

Reglas de calidad:
- Basa todas las preguntas en el material; no inventes datos.
- Enunciados claros, de 200 caracteres como máximo. Opciones de 80 como
  máximo, de longitud parecida entre sí.
- Una sola respuesta correcta e inequívoca. Distractores plausibles.
- Evita "todas las anteriores", "ninguna de las anteriores" y las preguntas
  de verdadero/falso.
- No repitas enunciados ni preguntes dos veces lo mismo.
- Nunca uses textos de relleno como "Pregunta vacía" ni opciones "A", "B",
  "C", "D".
- Español correcto, con tildes y signos de apertura (¿ ¡).

MATERIAL:
[pega aquí el texto de la unidad]
```
