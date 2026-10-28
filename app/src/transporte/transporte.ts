import { nuevaSemilla } from '../mazo/azar';
import { generarPin } from '../motor/estado';
import type { MensajeMovil, MensajeProfesor } from './mensajes';

/**
 * Capa de transporte propia. El resto del juego solo conoce esta interfaz.
 * Dos versiones: la local (BroadcastChannel, pestañas del mismo navegador,
 * para desarrollo) y la de Ably (`ably.ts`, móviles reales).
 *
 * Los móviles solo hablan con el profesor, nunca entre ellos. Lo recibido es
 * `unknown`: quien lo recibe lo valida con los esquemas de `mensajes.ts`.
 */

export type Identidad = { rol: 'profesor' } | { rol: 'jugador'; id: string; secreto: string };

/** Para el aviso «Reconectando…». */
export type EstadoRed = 'conectando' | 'conectado' | 'reconectando' | 'sin-conexion';

export interface Transporte {
    /** Profesor: abre una sala nueva y devuelve su PIN. */
    crearSala(): Promise<string>;
    /** Entra en la sala (el PIN). */
    conectar(sala: string, yo: Identidad): Promise<void>;
    /** Profesor → todos los móviles de la sala. */
    enviarATodos(mensaje: MensajeProfesor): void;
    /** Profesor → un móvil. */
    enviarAJugador(id: string, mensaje: MensajeProfesor): void;
    /** Móvil → profesor. */
    enviarAlProfesor(mensaje: MensajeMovil): void;
    /** Devuelve la función para dejar de escuchar. */
    alRecibir(fn: (datos: unknown) => void): () => void;
    estadoRed(): EstadoRed;
    /** Avisa de cada cambio de conexión. Devuelve la función para dejar de escuchar. */
    alCambiarRed(fn: (estado: EstadoRed) => void): () => void;
    desconectar(): void;
}

/** Lo que viaja de verdad por el canal local. */
type Sobre =
    | { de: 'profesor'; para: 'todos' | { id: string }; datos: unknown }
    | { de: 'jugador'; datos: unknown };

export const nombreCanal = (sala: string) => `aula-quiz:sala:${sala}`;

/** Transporte entre pestañas del mismo navegador. `crearCanal` se sustituye en los tests si hace falta. */
export function crearTransporteLocal(crearCanal: (nombre: string) => BroadcastChannel = n => new BroadcastChannel(n)): Transporte {
    let canal: BroadcastChannel | null = null;
    let yo: Identidad | null = null;
    const oyentes = new Set<(datos: unknown) => void>();

    const publicar = (rol: Identidad['rol'], sobre: Sobre) => {
        if (!canal || yo?.rol !== rol) throw new Error(`Solo el ${rol === 'profesor' ? 'profesor' : 'jugador'} conectado puede enviar este mensaje.`);
        canal.postMessage(sobre);
    };

    const paraMi = (sobre: unknown): unknown => {
        if (typeof sobre !== 'object' || sobre === null || !yo) return undefined;
        const s = sobre as Partial<Record<'de' | 'para' | 'datos', unknown>>;
        if (yo.rol === 'profesor') return s.de === 'jugador' ? s.datos : undefined;
        if (s.de !== 'profesor') return undefined;
        const para = s.para;
        const miId = yo.id;
        const esMio = para === 'todos'
            || (typeof para === 'object' && para !== null && (para as { id?: unknown }).id === miId);
        return esMio ? s.datos : undefined;
    };

    return {
        // En local no hay servidor: el PIN se elige aquí (6 cifras, sin cero delante).
        crearSala: async () => generarPin(nuevaSemilla()),
        async conectar(sala, identidad) {
            canal?.close();
            yo = identidad;
            canal = crearCanal(nombreCanal(sala));
            canal.onmessage = ev => {
                const datos = paraMi(ev.data);
                if (datos !== undefined) for (const fn of oyentes) fn(datos);
            };
        },
        enviarATodos: mensaje => publicar('profesor', { de: 'profesor', para: 'todos', datos: mensaje }),
        enviarAJugador: (id, mensaje) => publicar('profesor', { de: 'profesor', para: { id }, datos: mensaje }),
        enviarAlProfesor: mensaje => publicar('jugador', { de: 'jugador', datos: mensaje }),
        alRecibir(fn) {
            oyentes.add(fn);
            return () => oyentes.delete(fn);
        },
        // Entre pestañas no se pierde la conexión.
        estadoRed: () => 'conectado',
        alCambiarRed: () => () => {},
        desconectar() {
            canal?.close();
            canal = null;
            yo = null;
        },
    };
}
