// Utilidades para los tests del árbitro y la simulación (no se usan en el juego).
import { almacenSesion, crearCliente, type Cliente } from '../alumno/cliente';
import { crearEstado } from '../motor/estado';
import { partidaDePrueba } from '../motor/pruebas';
import { crearTransporteLocal } from '../transporte/transporte';
import { crearArbitro, type Arbitro } from './arbitro';
import { cargarPartida, guardarPartida } from './persistencia';

/** Storage en memoria (los tests se ejecutan en Node). */
export function almacenEnMemoria(): Storage {
    const datos = new Map<string, string>();
    return {
        getItem: k => datos.get(k) ?? null,
        setItem: (k, v) => { datos.set(k, String(v)); },
        removeItem: k => { datos.delete(k); },
        clear: () => datos.clear(),
        key: i => [...datos.keys()][i] ?? null,
        get length() { return datos.size; },
    };
}

/** Deja pasar los mensajes del BroadcastChannel (son asíncronos). */
export const espera = (ms = 15) => new Promise(r => setTimeout(r, ms));

/** Reloj falso que avanza a mano. */
export function relojFalso(inicio = 1_000_000) {
    let ahora = inicio;
    return { reloj: () => ahora, avanzar: (ms: number) => { ahora += ms; }, ahora: () => ahora };
}

let sala = 0;

/** Profesor con su almacén y su reloj, en una sala nueva para cada test. */
export async function montarProfesor(opciones: { preguntas?: 10 | 15 | 20 | 30; reloj?: () => number; almacen?: Storage } = {}) {
    const almacen = opciones.almacen ?? almacenEnMemoria();
    const reloj = opciones.reloj ?? relojFalso().reloj;
    const pin = String(900000 + (sala++ % 99999));
    const arbitro = crearArbitro(crearEstado(partidaDePrueba(opciones.preguntas ?? 10), pin), {
        transporte: crearTransporteLocal(), reloj, guardar: e => guardarPartida(e, almacen),
    });
    await arbitro.iniciar();
    return { arbitro, almacen, pin, reloj };
}

/** El profesor «recarga»: se cierra su pestaña y se abre otra que recupera la partida guardada. */
export async function recargarProfesor(anterior: Arbitro, almacen: Storage, reloj: () => number) {
    anterior.detener();
    const guardada = cargarPartida(almacen);
    if (!guardada) throw new Error('No había partida guardada');
    const arbitro = crearArbitro(guardada, { transporte: crearTransporteLocal(), reloj, guardar: e => guardarPartida(e, almacen) });
    await arbitro.iniciar();
    return arbitro;
}

/** Un móvil con su propia «pestaña» (sessionStorage en memoria). */
export function crearMovil(almacen = almacenEnMemoria()): { cliente: Cliente; almacen: Storage } {
    const cliente = crearCliente({ transporte: crearTransporteLocal(), almacen: almacenSesion(almacen), reintentoMs: 30, avisoMs: 100 });
    return { cliente, almacen };
}
