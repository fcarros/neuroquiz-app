import { crearTransporteAbly } from './ably';
import { crearTransporteLocal, type Transporte } from './transporte';

/**
 * Qué transporte usa esta página. Por defecto, el local (pestañas) en
 * `npm run dev` y Ably en la web compilada; `?transporte=local` o
 * `?transporte=ably` en la dirección fuerzan uno u otro.
 */
export type TipoTransporte = 'local' | 'ably';

export function tipoTransporte(busqueda = globalThis.location?.search ?? '', desarrollo = import.meta.env.DEV): TipoTransporte {
    const pedido = new URLSearchParams(busqueda).get('transporte');
    if (pedido === 'local' || pedido === 'ably') return pedido;
    return desarrollo ? 'local' : 'ably';
}

export const crearTransporte = (tipo = tipoTransporte()): Transporte =>
    tipo === 'ably' ? crearTransporteAbly() : crearTransporteLocal();
