// Utilidades compartidas por los tests del motor (no se usan en el juego).
import { crearMazo } from '../mazo/pruebas';
import { CONFIGURACION_INICIAL, prepararPartida, type PartidaPreparada, type Segundos } from '../partida/configuracion';
import { crearEstado, reducir, type Accion, type EstadoPartida } from './estado';

/** Partida de `n` preguntas (10, 15, 20 o 30) del mazo de prueba. */
export function partidaDePrueba(n: 10 | 15 | 20 | 30 = 10, segundos: Segundos = 20): PartidaPreparada {
    return prepararPartida(crearMazo(), { ...CONFIGURACION_INICIAL, cantidad: n, segundos }, 42);
}

export const PIN = '123456';
export const estadoDePrueba = (partida = partidaDePrueba()) => crearEstado(partida, PIN);

/** Aplica varias acciones seguidas. */
export const aplicar = (estado: EstadoPartida, ...acciones: Accion[]) => acciones.reduce(reducir, estado);

export const unirse = (id: string, nombre = id): Accion => ({ tipo: 'unirse', id, secreto: `s-${id}`, nombre });

/** Respuesta de `id` a la pregunta actual del estado. */
export const responder = (estado: EstadoPartida, id: string, opcion: number, ahora: number): Extract<Accion, { tipo: 'responder' }> =>
    ({ tipo: 'responder', id, secreto: `s-${id}`, indice: estado.indice, opcion, ahora });

export const correcta = (estado: EstadoPartida, indice = estado.indice) => estado.partida.preguntas[indice].correcta;
export const incorrecta = (estado: EstadoPartida, indice = estado.indice) => (correcta(estado, indice) + 1) % 4;
