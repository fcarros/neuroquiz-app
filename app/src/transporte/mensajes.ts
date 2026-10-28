import { z } from 'zod';
import { MAX_NOMBRE } from '../motor/estado';
import type { VistaComun, VistaJugador } from '../motor/vistas';

/**
 * Mensajes entre los móviles y el profesor. Todo lo que llega por el
 * transporte es `unknown` hasta pasar por estos esquemas: lo que no cumple
 * se descarta sin más.
 */

const clave = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const indice = z.number().int().min(0).max(999);
const opcion = z.number().int().min(0).max(3);
const texto = z.string().max(2000);

// --- Del móvil al profesor ---

export const esquemaMensajeMovil = z.discriminatedUnion('tipo', [
    /** Al conectar o recargar: «¿qué me toca ver?». */
    z.strictObject({ tipo: z.literal('hola'), id: clave, secreto: clave }),
    z.strictObject({ tipo: z.literal('unirse'), id: clave, secreto: clave, nombre: z.string().trim().min(1).max(MAX_NOMBRE) }),
    z.strictObject({ tipo: z.literal('responder'), id: clave, secreto: clave, indice, opcion }),
]);
export type MensajeMovil = z.infer<typeof esquemaMensajeMovil>;

// --- Del profesor a los móviles ---

const opciones = z.array(texto).length(4);

export const esquemaVistaComun = z.discriminatedUnion('fase', [
    z.strictObject({ fase: z.literal('sala'), titulo: texto, total: indice, segundos: z.number().int().positive() }),
    z.strictObject({
        fase: z.literal('pregunta'), indice, total: indice, categoria: texto, enunciado: texto, opciones,
        segundos: z.number().int().positive(), restanteMs: z.number().min(0),
    }),
    z.strictObject({
        fase: z.literal('respuesta'), indice, total: indice, enunciado: texto, opciones, correcta: opcion,
        explicacion: texto.optional(),
    }),
    z.strictObject({ fase: z.literal('final'), titulo: texto }),
]) satisfies z.ZodType<VistaComun>;

const cifra = z.number().int().min(0);

export const esquemaVistaJugador = z.discriminatedUnion('estado', [
    z.strictObject({ estado: z.literal('fuera') }),
    z.strictObject({ estado: z.literal('expulsado') }),
    z.strictObject({ estado: z.literal('cerrada') }),
    z.strictObject({
        estado: z.literal('dentro'),
        nombre: z.string().max(MAX_NOMBRE),
        puntos: cifra,
        puesto: cifra,
        jugadores: cifra,
        racha: cifra,
        aciertos: cifra,
        respondida: z.strictObject({ indice, opcion }).nullable(),
        resultado: z.strictObject({
            indice, acierto: z.boolean(), puntos: cifra, ms: z.number().min(0).nullable(), opcion: opcion.nullable(),
        }).nullable(),
    }),
]) satisfies z.ZodType<VistaJugador>;

export const esquemaMensajeProfesor = z.discriminatedUnion('tipo', [
    z.strictObject({ tipo: z.literal('comun'), vista: esquemaVistaComun }),
    z.strictObject({ tipo: z.literal('personal'), vista: esquemaVistaJugador }),
]);
export type MensajeProfesor = z.infer<typeof esquemaMensajeProfesor>;

/** Valida lo que llega de un móvil. `null` si no cumple. */
export function leerMensajeMovil(datos: unknown): MensajeMovil | null {
    const r = esquemaMensajeMovil.safeParse(datos);
    return r.success ? r.data : null;
}

/** Valida lo que llega del profesor. `null` si no cumple. */
export function leerMensajeProfesor(datos: unknown): MensajeProfesor | null {
    const r = esquemaMensajeProfesor.safeParse(datos);
    return r.success ? r.data : null;
}
