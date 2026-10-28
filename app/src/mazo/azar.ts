/**
 * Azar determinista: el estado del generador es un número (la «semilla») que
 * se guarda en el estado de la partida. Con la misma semilla y las mismas
 * acciones, la partida evoluciona siempre igual.
 */

/** Siguiente número en [0, 1) y nueva semilla (algoritmo mulberry32). */
export function siguienteAzar(azar: number): { valor: number; azar: number } {
    const nuevo = (azar + 0x6d2b79f5) >>> 0;
    let t = nuevo;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return { valor: ((t ^ (t >>> 14)) >>> 0) / 4294967296, azar: nuevo };
}

/** Entero entre 1 y `caras`, ambos incluidos. */
export function tirarDado(azar: number, caras = 6): { valor: number; azar: number } {
    const r = siguienteAzar(azar);
    return { valor: Math.floor(r.valor * caras) + 1, azar: r.azar };
}

/** Baraja una copia de la lista (Fisher-Yates). */
export function barajar<T>(lista: readonly T[], azar: number): { lista: T[]; azar: number } {
    const copia = [...lista];
    let estado = azar;
    for (let i = copia.length - 1; i > 0; i--) {
        const r = siguienteAzar(estado);
        estado = r.azar;
        const j = Math.floor(r.valor * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return { lista: copia, azar: estado };
}

/** Semilla inicial no determinista, para empezar una partida real. */
export function nuevaSemilla(): number {
    return Math.floor(Math.random() * 4294967296) >>> 0;
}
