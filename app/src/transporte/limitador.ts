/**
 * Limita los envíos a `porSegundo` en cualquier ventana de un segundo. Los
 * pendientes salen en orden de llegada; si llega otro con la misma clave
 * mientras espera, ocupa su sitio (solo importa la vista más reciente).
 */

export interface Limitador {
    enviar(clave: string, accion: () => void): void;
    pendientes(): number;
    parar(): void;
}

export interface OpcionesLimitador {
    porSegundo: number;
    reloj?: () => number;
    programar?: (fn: () => void, ms: number) => unknown;
    cancelar?: (t: unknown) => void;
}

export function crearLimitador({
    porSegundo, reloj = Date.now, programar = (fn, ms) => setTimeout(fn, ms), cancelar = t => clearTimeout(t as ReturnType<typeof setTimeout>),
}: OpcionesLimitador): Limitador {
    const cola = new Map<string, () => void>();
    const recientes: number[] = [];
    let temporizador: unknown = null;

    const vaciar = () => {
        temporizador = null;
        const ahora = reloj();
        while (recientes.length && recientes[0] <= ahora - 1000) recientes.shift();
        while (cola.size && recientes.length < porSegundo) {
            const [clave, accion] = cola.entries().next().value!;
            cola.delete(clave);
            recientes.push(ahora);
            accion();
        }
        if (cola.size) temporizador = programar(vaciar, Math.max(1, recientes[0] + 1000 - ahora));
    };

    return {
        enviar(clave, accion) {
            // Map conserva el orden de la primera inserción: el nuevo ocupa el sitio del viejo.
            cola.set(clave, accion);
            if (temporizador === null) vaciar();
        },
        pendientes: () => cola.size,
        parar() {
            if (temporizador !== null) cancelar(temporizador);
            temporizador = null;
            cola.clear();
        },
    };
}
