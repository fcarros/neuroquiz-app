import { barajar } from '../mazo/azar';
import { IDS_COLOR, type ColorId } from '../mazo/colores';
import { DIFICULTADES, nombresCategorias, type Dificultad, type Mazo, type Pregunta } from '../mazo/mazo';

/**
 * Configuración de una partida y selección de sus preguntas. Todo son
 * funciones puras: la interfaz solo ofrece lo que estas funciones dan por
 * posible, y `ajustarConfiguracion` corrige lo que deje de serlo.
 *
 * Prioridad de los filtros: categorías → número de preguntas → dificultad.
 * El número se ofrece según las categorías; la dificultad, según las
 * categorías y el número elegido.
 */

export type FiltroDificultad = 'todas' | Dificultad;
export type Cantidad = number | 'todas';

export const CANTIDADES: readonly Cantidad[] = [10, 15, 20, 30, 'todas'];
export const FILTROS_DIFICULTAD: readonly FiltroDificultad[] = ['todas', ...DIFICULTADES];
export const SEGUNDOS = [10, 20, 30, 60] as const;
export type Segundos = typeof SEGUNDOS[number];

export const NOMBRE_DIFICULTAD: Record<FiltroDificultad, string> = {
    todas: 'Todas',
    facil: 'Fácil',
    media: 'Media',
    dificil: 'Difícil',
};

export interface Configuracion {
    /** Categorías que entran, por su color en el mazo. */
    categorias: ColorId[];
    dificultad: FiltroDificultad;
    cantidad: Cantidad;
    segundos: Segundos;
    /** Preferencia del profesor; solo se aplica si el mazo tiene explicaciones. */
    mostrarExplicacion: boolean;
}

export const CONFIGURACION_INICIAL: Configuracion = {
    categorias: [...IDS_COLOR],
    dificultad: 'todas',
    cantidad: 10,
    segundos: 20,
    mostrarExplicacion: true,
};

// --- Qué se puede elegir ---

/** Preguntas que cumplen los filtros de categoría y dificultad. */
export function preguntasDisponibles(mazo: Mazo, categorias: readonly ColorId[], dificultad: FiltroDificultad): Pregunta[] {
    return mazo.preguntas.filter(p =>
        categorias.includes(p.color) && (dificultad === 'todas' || p.dificultad === dificultad));
}

/** Número de preguntas que tendrá la partida con esa cantidad y ese conjunto disponible. */
export const cantidadReal = (cantidad: Cantidad, disponibles: number) =>
    cantidad === 'todas' ? disponibles : cantidad;

const cubre = (cantidad: Cantidad, disponibles: number) =>
    disponibles > 0 && cantidadReal(cantidad, disponibles) <= disponibles;

export interface OpcionCantidad {
    valor: Cantidad;
    posible: boolean;
    /** Preguntas que tendría la partida (para «Todas»). */
    preguntas: number;
}

/** Números de preguntas, según las categorías elegidas (con cualquier dificultad). */
export function opcionesCantidad(mazo: Mazo, categorias: readonly ColorId[]): OpcionCantidad[] {
    const n = preguntasDisponibles(mazo, categorias, 'todas').length;
    return CANTIDADES.map(valor => ({ valor, posible: cubre(valor, n), preguntas: cantidadReal(valor, n) }));
}

export interface OpcionDificultad {
    valor: FiltroDificultad;
    posible: boolean;
    /** Preguntas de esa dificultad en las categorías elegidas. */
    disponibles: number;
}

/** Dificultades, según las categorías y el número de preguntas elegidos. */
export function opcionesDificultad(mazo: Mazo, categorias: readonly ColorId[], cantidad: Cantidad): OpcionDificultad[] {
    return FILTROS_DIFICULTAD.map(valor => {
        const disponibles = preguntasDisponibles(mazo, categorias, valor).length;
        return { valor, posible: cubre(cantidad, disponibles), disponibles };
    });
}

/** Cuántas preguntas del mazo tienen explicación. */
export const preguntasConExplicacion = (mazo: Mazo) =>
    mazo.preguntas.filter(p => p.explicacion?.trim()).length;

/** Si se mostrará la explicación: la preferencia, siempre que el mazo tenga alguna. */
export const explicacionEfectiva = (mazo: Mazo, config: Configuracion) =>
    config.mostrarExplicacion && preguntasConExplicacion(mazo) > 0;

/** ¿Se ofrece esta combinación en la interfaz? */
export function esPosible(mazo: Mazo, config: Configuracion): boolean {
    const colores = new Set(mazo.preguntas.map(p => p.color));
    if (config.categorias.length === 0 || !config.categorias.every(c => colores.has(c))) return false;
    const cantidad = opcionesCantidad(mazo, config.categorias).find(o => o.valor === config.cantidad);
    const dificultad = opcionesDificultad(mazo, config.categorias, config.cantidad).find(o => o.valor === config.dificultad);
    return Boolean(cantidad?.posible && dificultad?.posible)
        && (SEGUNDOS as readonly number[]).includes(config.segundos);
}

// --- Ajustes ---

export interface Ajuste {
    config: Configuracion;
    /** Qué se ha cambiado y por qué, para avisar al profesor. */
    cambios: string[];
}

const textoCantidad = (c: Cantidad) => (c === 'todas' ? 'todas' : String(c));

/**
 * Devuelve una configuración posible lo más parecida a la dada, y explica lo
 * que ha cambiado. Si ya es posible, la devuelve igual y sin cambios.
 */
export function ajustarConfiguracion(mazo: Mazo, config: Configuracion): Ajuste {
    const cambios: string[] = [];
    const colores = new Set(mazo.preguntas.map(p => p.color));
    let categorias = config.categorias.filter(c => colores.has(c));
    if (categorias.length === 0) categorias = IDS_COLOR.filter(c => colores.has(c));

    let cantidad = config.cantidad;
    const cantidades = opcionesCantidad(mazo, categorias);
    if (!cantidades.find(o => o.valor === cantidad)?.posible) {
        // El mayor número fijo que quepa; si no cabe ninguno, todas las disponibles.
        const total = cantidades.find(o => o.valor === 'todas')!.preguntas;
        const fijos = cantidades.filter(o => o.posible && o.valor !== 'todas');
        const nueva = fijos.length > 0 ? fijos[fijos.length - 1].valor : 'todas';
        cambios.push(`Con esas categorías solo hay ${total} preguntas: el número pasa de ${textoCantidad(cantidad)} a ${textoCantidad(nueva)}.`);
        cantidad = nueva;
    }

    let dificultad = config.dificultad;
    const dificultades = opcionesDificultad(mazo, categorias, cantidad);
    if (!dificultades.find(o => o.valor === dificultad)?.posible) {
        cambios.push(`No hay suficientes preguntas de dificultad ${NOMBRE_DIFICULTAD[dificultad].toLowerCase()}: la dificultad pasa a «Todas».`);
        dificultad = 'todas';
    }

    const segundos = (SEGUNDOS as readonly number[]).includes(config.segundos) ? config.segundos : CONFIGURACION_INICIAL.segundos;

    return { config: { ...config, categorias, cantidad, dificultad, segundos }, cambios };
}

// --- Selección de preguntas ---

export type Letra = 'A' | 'B' | 'C' | 'D';
export const LETRAS: readonly Letra[] = ['A', 'B', 'C', 'D'];

/** Pregunta lista para jugar: opciones ya barajadas y `correcta` recalculada. */
export interface PreguntaPartida {
    id: string;
    color: ColorId;
    categoria: string;
    enunciado: string;
    opciones: [string, string, string, string];
    /** Posición de la correcta en `opciones` (0-3, es decir, A-D). */
    correcta: number;
    dificultad?: Dificultad;
    explicacion?: string;
}

export interface PartidaPreparada {
    mazo: { id: string; titulo: string; modulo: string };
    segundos: Segundos;
    mostrarExplicacion: boolean;
    preguntas: PreguntaPartida[];
}

/**
 * Elige las preguntas al azar respetando los filtros, sin repetir, y baraja
 * las opciones de cada una. Con la misma semilla, el resultado es el mismo.
 * Lanza un error si la configuración no es posible.
 */
export function prepararPartida(mazo: Mazo, config: Configuracion, semilla: number): PartidaPreparada {
    if (!esPosible(mazo, config)) throw new Error('La configuración de la partida no es posible con este mazo.');

    const disponibles = preguntasDisponibles(mazo, config.categorias, config.dificultad);
    const n = cantidadReal(config.cantidad, disponibles.length);
    const barajadas = barajar(disponibles, semilla);
    let azar = barajadas.azar;
    const nombres = nombresCategorias(mazo);

    const preguntas = barajadas.lista.slice(0, n).map((p): PreguntaPartida => {
        const orden = barajar([0, 1, 2, 3], azar);
        azar = orden.azar;
        return {
            id: p.id,
            color: p.color,
            categoria: nombres[p.color],
            enunciado: p.enunciado,
            opciones: orden.lista.map(i => p.opciones[i]) as PreguntaPartida['opciones'],
            correcta: orden.lista.indexOf(p.correcta),
            ...(p.dificultad && { dificultad: p.dificultad }),
            ...(p.explicacion && { explicacion: p.explicacion }),
        };
    });

    return {
        mazo: { id: mazo.id, titulo: mazo.titulo, modulo: mazo.modulo },
        segundos: config.segundos,
        mostrarExplicacion: explicacionEfectiva(mazo, config),
        preguntas,
    };
}
