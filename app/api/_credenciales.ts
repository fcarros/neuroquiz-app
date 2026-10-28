import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import * as Ably from 'ably';
import { z } from 'zod';
import {
    CLIENTE_PROFESOR, PATRON_CLAVE, PATRON_PIN, canalJugador, canalProfesor, canalTodos, canalesSala, idDeSecreto,
} from '../src/transporte/canales.js';

/**
 * Credenciales temporales de Ably (lógica de `api/ably-token.ts`, aparte
 * para poder probarla). La clave de Ably nunca sale de aquí: se firman
 * TokenRequest con permisos mínimos y el navegador los canjea en Ably.
 *
 * - Crear sala: la función elige el PIN y entrega al profesor una prueba
 *   firmada (HMAC con AULA_QUIZ_SECRETO_SALA) que caduca a las 12 h.
 * - Profesor: con esa prueba, todo lo que permite la clave en `aq:PIN:*`.
 * - Jugador: escuchar `aq:PIN:todos` y su canal, publicar en
 *   `aq:PIN:profesor`. Su id sale de su secreto, así que nadie puede
 *   pedir el canal de otro.
 */

export const DURACION_PRUEBA_MS = 12 * 60 * 60 * 1000;
export const DURACION_TOKEN_MS = 60 * 60 * 1000;

export interface Entorno {
    claveAbly?: string;
    secretoSala?: string;
}

export interface Respuesta {
    estado: number;
    cuerpo: unknown;
}

const pin = z.string().regex(PATRON_PIN);
const esquemaPeticion = z.discriminatedUnion('accion', [
    z.strictObject({ accion: z.literal('crear-sala') }),
    z.strictObject({ accion: z.literal('profesor'), pin, caduca: z.number().int().positive(), prueba: z.string().regex(/^[0-9a-f]{64}$/) }),
    z.strictObject({ accion: z.literal('jugador'), pin, secreto: z.string().regex(PATRON_CLAVE) }),
]);
export type Peticion = z.infer<typeof esquemaPeticion>;

export const firmarSala = (secreto: string, pinSala: string, caduca: number) =>
    createHmac('sha256', secreto).update(`aula-quiz:profesor:${pinSala}:${caduca}`).digest('hex');

function pruebaValida(secreto: string, pinSala: string, caduca: number, prueba: string, ahora: number): boolean {
    if (caduca < ahora || caduca > ahora + DURACION_PRUEBA_MS) return false;
    const esperada = Buffer.from(firmarSala(secreto, pinSala, caduca), 'hex');
    const dada = Buffer.from(prueba, 'hex');
    return dada.length === esperada.length && timingSafeEqual(dada, esperada);
}

export type Permisos = Record<string, string[]>;

export const permisosProfesor = (pinSala: string): Permisos => ({ [canalesSala(pinSala)]: ['publish', 'subscribe', 'presence'] });

export const permisosJugador = (pinSala: string, id: string): Permisos => ({
    [canalTodos(pinSala)]: ['subscribe'],
    [canalJugador(pinSala, id)]: ['subscribe'],
    [canalProfesor(pinSala)]: ['publish'],
});

const error = (estado: number, mensaje: string): Respuesta => ({ estado, cuerpo: { error: mensaje } });

/** Atiende una petición ya leída como JSON. `ahora` y `elegirPin` se inyectan en los tests. */
export async function atender(
    datos: unknown,
    entorno: Entorno,
    { ahora = Date.now(), elegirPin = () => String(randomInt(100000, 1000000)) }: { ahora?: number; elegirPin?: () => string } = {},
): Promise<Respuesta> {
    if (!entorno.claveAbly || !entorno.secretoSala) return error(500, 'Faltan variables de entorno en el servidor.');
    if (entorno.secretoSala.length < 32) return error(500, 'El secreto de las salas es demasiado corto.');
    const r = esquemaPeticion.safeParse(datos);
    if (!r.success) return error(400, 'Petición no válida.');
    const p = r.data;

    if (p.accion === 'crear-sala') {
        const nuevo = elegirPin();
        const caduca = ahora + DURACION_PRUEBA_MS;
        return { estado: 200, cuerpo: { pin: nuevo, caduca, prueba: firmarSala(entorno.secretoSala, nuevo, caduca) } };
    }

    let clientId: string;
    let permisos: Permisos;
    if (p.accion === 'profesor') {
        if (!pruebaValida(entorno.secretoSala, p.pin, p.caduca, p.prueba, ahora)) return error(403, 'La prueba de esta sala no es válida.');
        clientId = CLIENTE_PROFESOR;
        permisos = permisosProfesor(p.pin);
    } else {
        clientId = await idDeSecreto(p.secreto);
        permisos = permisosJugador(p.pin, clientId);
    }

    const rest = new Ably.Rest({ key: entorno.claveAbly, queryTime: false });
    const tokenRequest = await rest.auth.createTokenRequest({
        clientId,
        capability: JSON.stringify(permisos),
        ttl: DURACION_TOKEN_MS,
        timestamp: ahora,
    });
    return { estado: 200, cuerpo: tokenRequest };
}

/** Adaptador para la petición web (Vercel y el servidor de Vite). */
export async function atenderPeticion(peticion: Request, entorno: Entorno): Promise<Response> {
    const cabeceras = { 'content-type': 'application/json', 'cache-control': 'no-store' };
    if (peticion.method !== 'POST') return new Response(JSON.stringify({ error: 'Usa POST.' }), { status: 405, headers: { ...cabeceras, allow: 'POST' } });
    let datos: unknown;
    try {
        const texto = await peticion.text();
        if (texto.length > 2000) return new Response(JSON.stringify({ error: 'Petición demasiado grande.' }), { status: 413, headers: cabeceras });
        datos = JSON.parse(texto);
    } catch {
        return new Response(JSON.stringify({ error: 'Petición no válida.' }), { status: 400, headers: cabeceras });
    }
    try {
        const r = await atender(datos, entorno);
        return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: cabeceras });
    } catch {
        // Sin detalles: el error podría mencionar la clave.
        return new Response(JSON.stringify({ error: 'Error al firmar las credenciales.' }), { status: 500, headers: cabeceras });
    }
}

export const entornoDeProceso = (): Entorno => ({
    claveAbly: process.env.ABLY_API_KEY,
    secretoSala: process.env.AULA_QUIZ_SECRETO_SALA,
});
