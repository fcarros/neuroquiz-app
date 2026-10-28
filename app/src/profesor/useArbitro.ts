import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EstadoPartida } from '../motor/estado';
import { crearTransporte } from '../transporte/elegir';
import { crearArbitro, type AccionProfesor, type Arbitro } from './arbitro';
import { cargarPartida, guardarPartida } from './persistencia';

const TICK_MS = 250;
const sinSuscripcion = () => () => {};

/**
 * Pone en marcha el árbitro de una partida en esta pestaña: conecta el
 * transporte, comprueba el tiempo cuatro veces por segundo y guarda cada
 * cambio. Si el componente se vuelve a montar, sigue desde lo guardado.
 */
export function useArbitro(inicial: EstadoPartida) {
    const [arbitro, setArbitro] = useState<Arbitro | null>(null);

    useEffect(() => {
        const guardada = cargarPartida();
        const base = guardada?.pin === inicial.pin ? guardada : inicial;
        guardarPartida(base);
        const a = crearArbitro(base, { transporte: crearTransporte(), reloj: Date.now, guardar: guardarPartida });
        let vivo = true;
        void a.iniciar().then(() => { if (vivo) setArbitro(a); });
        const t = setInterval(() => a.tick(), TICK_MS);
        return () => {
            vivo = false;
            clearInterval(t);
            a.detener();
        };
    }, [inicial]);

    const estado = useSyncExternalStore(arbitro?.suscribir ?? sinSuscripcion, () => arbitro?.estado() ?? inicial);
    const despachar = (accion: AccionProfesor) => arbitro?.despachar(accion);
    return { estado, despachar, listo: arbitro !== null };
}
