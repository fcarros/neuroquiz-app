import { siguienteAzar } from '../mazo/azar';
import type { PartidaPreparada } from '../partida/configuracion';

/**
 * Motor de la partida. Vive en el navegador del profesor, que es el árbitro:
 * el estado son datos planos (se guardan tal cual en localStorage) y
 * `reducir` es una función pura. El reloj llega dentro de cada acción
 * (`ahora`, en ms) y el azar como semilla, así que los tests son
 * deterministas.
 *
 * Puntos, rachas y ranking no se guardan: se calculan a partir de las
 * respuestas (ver `calculos.ts`).
 */

/** Margen tras el límite en el que aún se admite una respuesta. */
export const MARGEN_MS = 500;
export const MAX_NOMBRE = 15;

export type Fase = 'sala' | 'pregunta' | 'respuesta' | 'podio' | 'tabla';

export interface Jugador {
    /** Identificador público: dirección del móvil. */
    id: string;
    /** Solo lo conocen el móvil y el profesor; se exige en cada mensaje. */
    secreto: string;
    nombre: string;
    /** Primera pregunta (índice) en la que pudo participar. */
    desde: number;
}

export interface Respuesta {
    opcion: number;
    /** Tiempo desde que se abrió la pregunta, según el reloj del profesor. */
    ms: number;
}

export interface EstadoPartida {
    version: 1;
    pin: string;
    partida: PartidaPreparada;
    fase: Fase;
    /** Pregunta actual (0…n−1); −1 en la sala. */
    indice: number;
    /** Reloj del profesor al abrir la pregunta actual. */
    abiertaEn: number | null;
    /** Por orden de llegada. */
    jugadores: Jugador[];
    expulsados: string[];
    /** Una entrada por pregunta: id del jugador → su respuesta. */
    respuestas: Record<string, Respuesta>[];
    /** Preguntas saltadas: no cuentan para nadie. */
    saltadas: number[];
}

export type Accion =
    | { tipo: 'unirse'; id: string; secreto: string; nombre: string }
    | { tipo: 'expulsar'; id: string }
    | { tipo: 'empezar'; ahora: number }
    | { tipo: 'responder'; id: string; secreto: string; indice: number; opcion: number; ahora: number }
    | { tipo: 'tick'; ahora: number }
    | { tipo: 'siguiente'; ahora: number }
    | { tipo: 'saltar'; ahora: number }
    | { tipo: 'terminar' }
    | { tipo: 'verTabla' }
    | { tipo: 'verPodio' };

/** PIN de 6 cifras (100000-999999) a partir de una semilla. */
export function generarPin(semilla: number): string {
    return String(100000 + Math.floor(siguienteAzar(semilla).valor * 900000));
}

export function crearEstado(partida: PartidaPreparada, pin: string): EstadoPartida {
    return {
        version: 1,
        pin,
        partida,
        fase: 'sala',
        indice: -1,
        abiertaEn: null,
        jugadores: [],
        expulsados: [],
        respuestas: partida.preguntas.map(() => ({})),
        saltadas: [],
    };
}

export const limiteMs = (estado: EstadoPartida) => estado.partida.segundos * 1000;

/** Recorta espacios y caracteres de control, y limita a 15 caracteres. */
export function normalizarNombre(nombre: string): string {
    // eslint-disable-next-line no-control-regex
    return nombre.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE).trim();
}

/** Si el nombre ya está cogido (sin distinguir mayúsculas), le añade « 2», « 3»… sin pasar de 15. */
export function nombreUnico(nombre: string, usados: readonly string[]): string {
    const ocupados = new Set(usados.map(n => n.toLocaleLowerCase('es')));
    if (!ocupados.has(nombre.toLocaleLowerCase('es'))) return nombre;
    for (let n = 2; ; n++) {
        const sufijo = ` ${n}`;
        const candidato = nombre.slice(0, MAX_NOMBRE - sufijo.length).trimEnd() + sufijo;
        if (!ocupados.has(candidato.toLocaleLowerCase('es'))) return candidato;
    }
}

export const buscarJugador = (estado: EstadoPartida, id: string) => estado.jugadores.find(j => j.id === id);

/** ¿El mensaje viene de verdad de ese jugador? */
export const esJugador = (estado: EstadoPartida, id: string, secreto: string) =>
    buscarJugador(estado, id)?.secreto === secreto;

const abrir = (estado: EstadoPartida, indice: number, ahora: number): EstadoPartida =>
    indice < estado.partida.preguntas.length
        ? { ...estado, fase: 'pregunta', indice, abiertaEn: ahora }
        : { ...estado, fase: 'podio', abiertaEn: null };

const cerrar = (estado: EstadoPartida): EstadoPartida => ({ ...estado, fase: 'respuesta' });

const saltarActual = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    saltadas: [...estado.saltadas, estado.indice],
    respuestas: estado.respuestas.map((r, i) => (i === estado.indice ? {} : r)),
});

const hanRespondidoTodos = (estado: EstadoPartida) =>
    estado.jugadores.length > 0
    && estado.jugadores.every(j => estado.respuestas[estado.indice][j.id] !== undefined);

/**
 * Aplica una acción. Si no es válida en el estado actual, devuelve el mismo
 * objeto sin cambios (así quien llama sabe que no ha pasado nada).
 */
export function reducir(estado: EstadoPartida, accion: Accion): EstadoPartida {
    switch (accion.tipo) {
        case 'unirse': {
            if (estado.fase === 'podio' || estado.fase === 'tabla') return estado;
            if (estado.expulsados.includes(accion.id) || buscarJugador(estado, accion.id)) return estado;
            const nombre = normalizarNombre(accion.nombre);
            if (!nombre) return estado;
            const desde = estado.fase === 'sala' ? 0 : estado.fase === 'pregunta' ? estado.indice : estado.indice + 1;
            const jugador: Jugador = {
                id: accion.id,
                secreto: accion.secreto,
                nombre: nombreUnico(nombre, estado.jugadores.map(j => j.nombre)),
                desde,
            };
            return { ...estado, jugadores: [...estado.jugadores, jugador] };
        }

        case 'expulsar': {
            if (estado.fase !== 'sala' || !buscarJugador(estado, accion.id)) return estado;
            return {
                ...estado,
                jugadores: estado.jugadores.filter(j => j.id !== accion.id),
                expulsados: [...estado.expulsados, accion.id],
            };
        }

        case 'empezar':
            if (estado.fase !== 'sala' || estado.jugadores.length === 0) return estado;
            return abrir(estado, 0, accion.ahora);

        case 'responder': {
            if (estado.fase !== 'pregunta' || accion.indice !== estado.indice) return estado;
            if (!esJugador(estado, accion.id, accion.secreto)) return estado;
            if (!Number.isInteger(accion.opcion) || accion.opcion < 0 || accion.opcion > 3) return estado;
            const actuales = estado.respuestas[estado.indice];
            if (actuales[accion.id]) return estado;
            const ms = accion.ahora - estado.abiertaEn!;
            if (ms > limiteMs(estado) + MARGEN_MS) return estado;
            const nuevo: EstadoPartida = {
                ...estado,
                respuestas: estado.respuestas.map((r, i) =>
                    i === estado.indice ? { ...r, [accion.id]: { opcion: accion.opcion, ms: Math.max(0, ms) } } : r),
            };
            return hanRespondidoTodos(nuevo) ? cerrar(nuevo) : nuevo;
        }

        case 'tick':
            if (estado.fase !== 'pregunta' || accion.ahora < estado.abiertaEn! + limiteMs(estado) + MARGEN_MS) return estado;
            return cerrar(estado);

        case 'siguiente':
            if (estado.fase !== 'respuesta') return estado;
            return abrir(estado, estado.indice + 1, accion.ahora);

        case 'saltar':
            if (estado.fase !== 'pregunta') return estado;
            return abrir(saltarActual(estado), estado.indice + 1, accion.ahora);

        case 'terminar':
            if (estado.fase === 'pregunta') return { ...saltarActual(estado), fase: 'podio', abiertaEn: null };
            if (estado.fase === 'respuesta') return { ...estado, fase: 'podio' };
            return estado;

        case 'verTabla':
            return estado.fase === 'podio' ? { ...estado, fase: 'tabla' } : estado;

        case 'verPodio':
            return estado.fase === 'tabla' ? { ...estado, fase: 'podio' } : estado;
    }
}
