import { z } from 'zod';
import { IDS_COLOR } from '../mazo/colores';
import { DIFICULTADES } from '../mazo/mazo';
import type { EstadoPartida } from '../motor/estado';
import { SEGUNDOS } from '../partida/configuracion';

/**
 * La partida en curso se guarda en el navegador del profesor tras cada
 * cambio. Si recarga, se recupera; lo guardado se valida al leerlo.
 */

export const CLAVE_PARTIDA = 'aula-quiz:partida';

const esquemaPregunta = z.object({
    id: z.string(),
    color: z.enum(IDS_COLOR),
    categoria: z.string(),
    enunciado: z.string(),
    opciones: z.tuple([z.string(), z.string(), z.string(), z.string()]),
    correcta: z.number().int().min(0).max(3),
    dificultad: z.enum(DIFICULTADES).optional(),
    explicacion: z.string().optional(),
});

const esquemaEstado = z.object({
    version: z.literal(1),
    pin: z.string().regex(/^\d{6}$/),
    partida: z.object({
        mazo: z.object({ id: z.string(), titulo: z.string(), modulo: z.string() }),
        segundos: z.union(SEGUNDOS.map(s => z.literal(s))),
        mostrarExplicacion: z.boolean(),
        preguntas: z.array(esquemaPregunta).min(1),
    }),
    fase: z.enum(['sala', 'pregunta', 'respuesta', 'podio', 'tabla']),
    indice: z.number().int().min(-1),
    abiertaEn: z.number().nullable(),
    jugadores: z.array(z.object({ id: z.string(), secreto: z.string(), nombre: z.string(), desde: z.number().int().min(0) })),
    expulsados: z.array(z.string()),
    respuestas: z.array(z.record(z.string(), z.object({ opcion: z.number().int().min(0).max(3), ms: z.number().min(0) }))),
    saltadas: z.array(z.number().int().min(0)),
}).refine(e => e.respuestas.length === e.partida.preguntas.length && e.indice < e.partida.preguntas.length
    && (e.fase === 'sala') === (e.indice === -1) && (e.fase !== 'pregunta' || e.abiertaEn !== null));

export function guardarPartida(estado: EstadoPartida, almacen: Storage = localStorage): void {
    try {
        almacen.setItem(CLAVE_PARTIDA, JSON.stringify(estado));
    } catch {
        // Sin espacio o almacenamiento bloqueado: la partida sigue, solo que no sobrevivirá a una recarga.
    }
}

export function cargarPartida(almacen: Storage = localStorage): EstadoPartida | null {
    try {
        const texto = almacen.getItem(CLAVE_PARTIDA);
        if (!texto) return null;
        const r = esquemaEstado.safeParse(JSON.parse(texto));
        return r.success ? (r.data as EstadoPartida) : null;
    } catch {
        return null;
    }
}

export function borrarPartida(almacen: Storage = localStorage): void {
    try {
        almacen.removeItem(CLAVE_PARTIDA);
    } catch {
        // Nada que hacer.
    }
}
