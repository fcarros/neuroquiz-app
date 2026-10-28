import { clasificacion, preguntasJugadas, puntosPorAcierto } from './calculos';
import { buscarJugador, limiteMs, type EstadoPartida } from './estado';

/**
 * Lo que ve cada móvil. Es lo único del estado que sale del navegador del
 * profesor: nunca incluye secretos ni, mientras la pregunta está abierta, la
 * respuesta correcta.
 */

/** Igual para todos los móviles de la sala. */
export type VistaComun =
    | { fase: 'sala'; titulo: string; total: number; segundos: number }
    | {
        fase: 'pregunta'; indice: number; total: number; categoria: string; enunciado: string;
        opciones: string[]; segundos: number;
        /** Tiempo que queda al enviar el mensaje (el reloj de cada móvil puede ir distinto). */
        restanteMs: number;
    }
    | {
        fase: 'respuesta'; indice: number; total: number; enunciado: string; opciones: string[];
        correcta: number; explicacion?: string;
    }
    | { fase: 'final'; titulo: string };

/** Lo que ve un jugador concreto. */
export type VistaJugador =
    | { estado: 'fuera' }
    | { estado: 'expulsado' }
    | { estado: 'cerrada' }
    | {
        estado: 'dentro';
        nombre: string;
        puntos: number;
        puesto: number;
        /** Cuántos juegan (no en la sala: así cada llegada no obliga a reenviar la vista de todos). */
        jugadores: number | null;
        racha: number;
        aciertos: number;
        /** Lo que ha respondido en la pregunta abierta (sin decir si acierta). */
        respondida: { indice: number; opcion: number } | null;
        /**
         * Cómo le fue en la última pregunta cerrada. Se mantiene al abrir la
         * siguiente para que la vista no cambie (y no haya que reenviarla a
         * todos); el móvil solo lo enseña si coincide con la pregunta cerrada.
         */
        resultado: { indice: number; acierto: boolean; puntos: number; ms: number | null; opcion: number | null } | null;
    };

export function vistaComun(estado: EstadoPartida, ahora: number): VistaComun {
    const { partida, indice } = estado;
    const total = partida.preguntas.length;
    const p = partida.preguntas[indice];
    switch (estado.fase) {
        case 'sala':
            return { fase: 'sala', titulo: partida.mazo.titulo, total, segundos: partida.segundos };
        case 'pregunta':
            return {
                fase: 'pregunta', indice, total, categoria: p.categoria, enunciado: p.enunciado,
                opciones: [...p.opciones], segundos: partida.segundos,
                restanteMs: Math.max(0, estado.abiertaEn! + limiteMs(estado) - ahora),
            };
        case 'respuesta':
            return {
                fase: 'respuesta', indice, total, enunciado: p.enunciado, opciones: [...p.opciones], correcta: p.correcta,
                ...(partida.mostrarExplicacion && p.explicacion && { explicacion: p.explicacion }),
            };
        case 'podio':
        case 'tabla':
            return { fase: 'final', titulo: partida.mazo.titulo };
    }
}

export function vistaJugador(estado: EstadoPartida, id: string): VistaJugador {
    if (estado.expulsados.includes(id)) return { estado: 'expulsado' };
    const jugador = buscarJugador(estado, id);
    const final = estado.fase === 'podio' || estado.fase === 'tabla';
    if (!jugador) return { estado: final ? 'cerrada' : 'fuera' };

    const tabla = clasificacion(estado);
    const m = tabla.find(x => x.id === id)!;
    const r = estado.indice >= 0 ? estado.respuestas[estado.indice][id] : undefined;
    const ultima = preguntasJugadas(estado).at(-1);
    const ru = ultima !== undefined ? estado.respuestas[ultima][id] : undefined;
    const bien = ultima !== undefined && ru?.opcion === estado.partida.preguntas[ultima].correcta;

    return {
        estado: 'dentro',
        nombre: jugador.nombre,
        puntos: m.puntos,
        puesto: m.puesto,
        jugadores: estado.fase === 'sala' ? null : tabla.length,
        racha: m.racha,
        aciertos: m.aciertos,
        respondida: estado.fase === 'pregunta' && r ? { indice: estado.indice, opcion: r.opcion } : null,
        resultado: ultima !== undefined && jugador.desde <= ultima
            ? {
                indice: ultima,
                acierto: bien,
                puntos: bien ? puntosPorAcierto(ru!.ms, limiteMs(estado)) : 0,
                ms: ru?.ms ?? null,
                opcion: ru?.opcion ?? null,
            }
            : null,
    };
}
