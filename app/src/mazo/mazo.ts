import { z } from 'zod';
import { IDS_COLOR, NOMBRE_COLOR, esColorId, type ColorId } from './colores';

/**
 * Formato de mazo, versión 1. Documentación: docs/formato-mazo.md
 */

export const FORMATO_MAZO = 1;
export const DIFICULTADES = ['facil', 'media', 'dificil'] as const;
export type Dificultad = typeof DIFICULTADES[number];

/** Umbrales de los avisos. */
export const MIN_PREGUNTAS_RECOMENDADAS = 10;
export const MAX_LARGO_ENUNCIADO = 200;
export const MAX_LARGO_OPCION = 80;

const COLORES_VALIDOS = IDS_COLOR.join(', ');

const texto = (campo: string) =>
    z.string({
        error: iss => iss.input === undefined
            ? `falta el campo «${campo}»`
            : `el campo «${campo}» debe ser un texto`,
    }).refine(s => s.trim() !== '', { error: `el campo «${campo}» está vacío` });

const textoOpcional = (campo: string) =>
    z.string({ error: `el campo «${campo}» debe ser un texto` }).optional();

const color = z.custom<ColorId>(esColorId, {
    error: iss => iss.input === undefined
        ? 'falta el campo «color»'
        : `el color «${String(iss.input)}» no existe (los válidos son: ${COLORES_VALIDOS})`,
});

const CategoriaSchema = z.object({
    color,
    nombre: texto('nombre'),
}, { error: 'debe ser un objeto con «color» y «nombre»' });

const PreguntaSchema = z.object({
    id: texto('id'),
    color,
    enunciado: texto('enunciado'),
    opciones: z.array(z.string({ error: 'debe ser un texto' })
        .refine(s => s.trim() !== '', { error: 'está vacía' }), {
        error: iss => iss.input === undefined
            ? 'falta el campo «opciones»'
            : 'el campo «opciones» debe ser una lista de textos',
    }).length(4, {
        error: iss => `tiene ${Array.isArray(iss.input) ? iss.input.length : '?'} opciones; deben ser exactamente 4`,
    }),
    correcta: z.number({
        error: iss => iss.input === undefined
            ? 'falta el campo «correcta»'
            : '«correcta» debe ser un número: la posición de la opción correcta (0, 1, 2 o 3)',
    }).int({ error: '«correcta» debe ser 0, 1, 2 o 3' })
        .min(0, { error: '«correcta» debe ser 0, 1, 2 o 3 (la primera opción es la 0)' })
        .max(3, { error: '«correcta» debe ser 0, 1, 2 o 3 (la primera opción es la 0)' }),
    dificultad: z.enum(DIFICULTADES, {
        error: '«dificultad» debe ser facil, media o dificil',
    }).optional(),
    explicacion: textoOpcional('explicacion'),
}, { error: 'debe ser un objeto' });

export const MazoSchema = z.object({
    formato: z.literal(FORMATO_MAZO, {
        error: iss => iss.input === undefined
            ? 'falta el campo «formato» (debe ser 1)'
            : `«formato» debe ser 1 (el archivo indica ${JSON.stringify(iss.input)})`,
    }),
    id: texto('id'),
    titulo: texto('titulo'),
    modulo: texto('modulo'),
    descripcion: textoOpcional('descripcion'),
    categorias: z.array(CategoriaSchema, {
        error: iss => iss.input === undefined
            ? 'falta el campo «categorias»'
            : 'el campo «categorias» debe ser una lista',
    }),
    preguntas: z.array(PreguntaSchema, {
        error: iss => iss.input === undefined
            ? 'falta el campo «preguntas»'
            : 'el campo «preguntas» debe ser una lista',
    }),
}, { error: 'El archivo no contiene un mazo: se esperaba un objeto JSON.' });

export type Mazo = z.infer<typeof MazoSchema>;
export type Pregunta = z.infer<typeof PreguntaSchema>;
export type Categoria = z.infer<typeof CategoriaSchema>;

export interface ResultadoValidacion {
    valido: boolean;
    errores: string[];
    avisos: string[];
    /** El mazo, solo si no hay errores. */
    mazo: Mazo | null;
}

// --- Utilidades de texto ---

/** Para comparar textos: sin mayúsculas ni espacios sobrantes. */
export const claveComparacion = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Para detectar relleno: además, sin tildes ni puntuación final. */
const claveRelleno = (s: string) => claveComparacion(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s.¿?¡!:;,…-]+$/g, '').replace(/^[\s¿¡]+/, '');

const ENUNCIADOS_RELLENO = new Set([
    'pregunta vacia', 'pregunta', 'sin pregunta', 'sin enunciado', 'enunciado',
    'texto de la pregunta', 'escribe aqui la pregunta', 'pendiente', 'todo', 'xxx',
]);

export function esEnunciadoRelleno(enunciado: string): boolean {
    const clave = claveRelleno(enunciado);
    return ENUNCIADOS_RELLENO.has(clave) || clave.includes('lorem ipsum');
}

/** Opciones de relleno: exactamente «A», «B», «C» y «D». */
export function sonOpcionesRelleno(opciones: string[]): boolean {
    const claves = opciones.map(claveComparacion).sort();
    return claves.join(',') === 'a,b,c,d';
}

// --- Mensajes con ubicación ---

const esObjeto = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

function describirPregunta(datos: unknown, indice: number): string {
    const preguntas = esObjeto(datos) && Array.isArray(datos.preguntas) ? datos.preguntas : [];
    const p = preguntas[indice];
    const id = esObjeto(p) && typeof p.id === 'string' && p.id.trim() ? ` (${p.id})` : '';
    return `Pregunta n.º ${indice + 1}${id}`;
}

function ubicacion(ruta: PropertyKey[], datos: unknown): string {
    const partes: string[] = [];
    for (let i = 0; i < ruta.length; i++) {
        const clave = ruta[i];
        const siguiente = ruta[i + 1];
        if (clave === 'preguntas' && typeof siguiente === 'number') {
            partes.push(describirPregunta(datos, siguiente));
            i++;
        } else if (clave === 'categorias' && typeof siguiente === 'number') {
            partes.push(`Categoría n.º ${siguiente + 1}`);
            i++;
        } else if (clave === 'opciones' && typeof siguiente === 'number') {
            partes.push(`opción ${siguiente + 1}`);
            i++;
        }
    }
    return partes.join(', ');
}

const conUbicacion = (lugar: string, mensaje: string) =>
    lugar ? `${lugar}: ${mensaje}` : mensaje.charAt(0).toUpperCase() + mensaje.slice(1);

// --- Validación ---

/**
 * Valida un mazo (ya leído con JSON.parse). Devuelve errores (el mazo no se
 * puede usar) y avisos (se puede usar, pero conviene revisarlo).
 */
export function validarMazo(datos: unknown): ResultadoValidacion {
    const errores: string[] = [];
    const avisos: string[] = [];

    const resultado = MazoSchema.safeParse(datos);
    if (!resultado.success) {
        for (const issue of resultado.error.issues) {
            errores.push(conUbicacion(ubicacion(issue.path, datos), issue.message));
        }
    }

    // Comprobaciones de contenido sobre los datos en bruto, para informar
    // de todo a la vez aunque la estructura tenga errores.
    if (esObjeto(datos)) {
        comprobarCategorias(datos.categorias, errores);
        comprobarPreguntas(datos, errores, avisos);
    }

    const errUnicos = [...new Set(errores)];
    const valido = errUnicos.length === 0 && resultado.success;
    return {
        valido,
        errores: errUnicos,
        avisos: [...new Set(avisos)],
        mazo: valido && resultado.success ? resultado.data : null,
    };
}

function comprobarCategorias(categorias: unknown, errores: string[]) {
    if (!Array.isArray(categorias)) return;
    const usos = new Map<ColorId, number>();
    for (const c of categorias) {
        if (esObjeto(c) && esColorId(c.color)) usos.set(c.color, (usos.get(c.color) ?? 0) + 1);
    }
    const faltan = IDS_COLOR.filter(c => !usos.has(c));
    const repetidos = IDS_COLOR.filter(c => (usos.get(c) ?? 0) > 1);
    if (faltan.length > 0) {
        errores.push(`Categorías: falta la categoría del color ${faltan.map(c => NOMBRE_COLOR[c].toLowerCase()).join(', ')}. Debe haber exactamente una por color (${COLORES_VALIDOS}).`);
    }
    if (repetidos.length > 0) {
        errores.push(`Categorías: el color ${repetidos.map(c => NOMBRE_COLOR[c].toLowerCase()).join(', ')} aparece más de una vez. Debe haber exactamente una categoría por color.`);
    }
    if (faltan.length === 0 && repetidos.length === 0 && categorias.length !== IDS_COLOR.length) {
        errores.push(`Categorías: hay ${categorias.length} y deben ser exactamente ${IDS_COLOR.length}, una por color.`);
    }
}

function comprobarPreguntas(datos: Record<string, unknown>, errores: string[], avisos: string[]) {
    const preguntas = datos.preguntas;
    if (!Array.isArray(preguntas)) return;

    const porColor = new Map<ColorId, number>(IDS_COLOR.map(c => [c, 0]));
    const ids = new Map<string, number[]>();
    const enunciados = new Map<string, number[]>();

    preguntas.forEach((p, i) => {
        if (!esObjeto(p)) return;
        const lugar = describirPregunta(datos, i);

        if (esColorId(p.color)) porColor.set(p.color, (porColor.get(p.color) ?? 0) + 1);
        if (typeof p.id === 'string' && p.id.trim()) {
            ids.set(p.id, [...(ids.get(p.id) ?? []), i + 1]);
        }

        if (typeof p.enunciado === 'string' && p.enunciado.trim()) {
            if (esEnunciadoRelleno(p.enunciado)) {
                errores.push(`${lugar}: el enunciado «${p.enunciado}» es un texto de relleno.`);
            } else {
                const clave = claveComparacion(p.enunciado);
                enunciados.set(clave, [...(enunciados.get(clave) ?? []), i + 1]);
            }
            if (p.enunciado.length > MAX_LARGO_ENUNCIADO) {
                avisos.push(`${lugar}: el enunciado tiene ${p.enunciado.length} caracteres (recomendado: ${MAX_LARGO_ENUNCIADO} como máximo).`);
            }
        }

        if (Array.isArray(p.opciones) && p.opciones.every(o => typeof o === 'string')) {
            const opciones = p.opciones as string[];
            const noVacias = opciones.filter(o => o.trim() !== '');
            if (sonOpcionesRelleno(opciones)) {
                errores.push(`${lugar}: las opciones son «A», «B», «C» y «D», un texto de relleno.`);
            } else if (new Set(noVacias.map(claveComparacion)).size < noVacias.length) {
                errores.push(`${lugar}: hay opciones repetidas.`);
            }
            opciones.forEach((o, j) => {
                if (o.length > MAX_LARGO_OPCION) {
                    avisos.push(`${lugar}, opción ${j + 1}: tiene ${o.length} caracteres (recomendado: ${MAX_LARGO_OPCION} como máximo).`);
                }
            });
        }
    });

    for (const [id, posiciones] of ids) {
        if (posiciones.length > 1) {
            errores.push(`El id de pregunta «${id}» está repetido (preguntas n.º ${posiciones.join(', ')}). Cada pregunta necesita un id distinto.`);
        }
    }
    for (const [, posiciones] of enunciados) {
        if (posiciones.length > 1) {
            avisos.push(`Las preguntas n.º ${posiciones.join(', ')} tienen el mismo enunciado.`);
        }
    }

    const nombres = nombresDeCategoria(datos.categorias);
    for (const [c, n] of porColor) {
        const nombre = nombres[c] ? `${NOMBRE_COLOR[c].toLowerCase()} (${nombres[c]})` : NOMBRE_COLOR[c].toLowerCase();
        if (n === 0) {
            errores.push(`La categoría ${nombre} no tiene preguntas.`);
        } else if (n < MIN_PREGUNTAS_RECOMENDADAS) {
            avisos.push(`La categoría ${nombre} solo tiene ${n} pregunta${n === 1 ? '' : 's'} (recomendado: al menos ${MIN_PREGUNTAS_RECOMENDADAS}).`);
        }
    }

    const cuentas = [...porColor.values()].filter(n => n > 0);
    if (cuentas.length > 1) {
        const min = Math.min(...cuentas);
        const max = Math.max(...cuentas);
        if (max >= 2 * min) {
            avisos.push(`Las categorías están muy descompensadas: van de ${min} a ${max} preguntas. Conviene igualarlas.`);
        }
    }
}

function nombresDeCategoria(categorias: unknown): Partial<Record<ColorId, string>> {
    const nombres: Partial<Record<ColorId, string>> = {};
    if (!Array.isArray(categorias)) return nombres;
    for (const c of categorias) {
        if (esObjeto(c) && esColorId(c.color) && typeof c.nombre === 'string') nombres[c.color] = c.nombre;
    }
    return nombres;
}

// --- Utilidades para el juego y la interfaz ---

/** Nombre de cada categoría del mazo, por color. */
export function nombresCategorias(mazo: Mazo): Record<ColorId, string> {
    return Object.fromEntries(mazo.categorias.map(c => [c.color, c.nombre])) as Record<ColorId, string>;
}

/** Número de preguntas de cada color. */
export function contarPorColor(mazo: Mazo): Record<ColorId, number> {
    const cuentas = Object.fromEntries(IDS_COLOR.map(c => [c, 0])) as Record<ColorId, number>;
    for (const p of mazo.preguntas) cuentas[p.color]++;
    return cuentas;
}
