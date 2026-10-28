import { describe, it, expect } from 'vitest';
import { crearLimitador } from './limitador';

/** Reloj y temporizador falsos: `avanzar` dispara lo programado. */
function tiempoFalso() {
    let ahora = 0;
    let programado: { fn: () => void; en: number } | null = null;
    return {
        reloj: () => ahora,
        programar: (fn: () => void, ms: number) => { programado = { fn, en: ahora + ms }; return 1; },
        cancelar: () => { programado = null; },
        avanzar(ms: number) {
            ahora += ms;
            while (programado && programado.en <= ahora) { const p = programado; programado = null; p.fn(); }
        },
    };
}

describe('limitador de envíos', () => {
    it('como mucho N por segundo; el resto, en orden, al segundo siguiente', () => {
        const t = tiempoFalso();
        const l = crearLimitador({ porSegundo: 25, ...t });
        const enviados: number[] = [];
        for (let i = 0; i < 31; i++) l.enviar(`j${i}`, () => enviados.push(i));
        expect(enviados).toHaveLength(25);
        t.avanzar(999);
        expect(enviados).toHaveLength(25);
        t.avanzar(1);
        expect(enviados).toEqual(Array.from({ length: 31 }, (_, i) => i));
        expect(l.pendientes()).toBe(0);
    });

    it('si hay uno pendiente con la misma clave, el nuevo ocupa su sitio', () => {
        const t = tiempoFalso();
        const l = crearLimitador({ porSegundo: 2, ...t });
        const enviados: string[] = [];
        l.enviar('a', () => enviados.push('a1'));
        l.enviar('b', () => enviados.push('b1'));
        l.enviar('c', () => enviados.push('c1'));
        l.enviar('d', () => enviados.push('d1'));
        l.enviar('c', () => enviados.push('c2'));
        expect(l.pendientes()).toBe(2);
        t.avanzar(1000);
        expect(enviados).toEqual(['a1', 'b1', 'c2', 'd1']);
    });

    it('nunca pasa de N en cualquier ventana de un segundo', () => {
        const t = tiempoFalso();
        const l = crearLimitador({ porSegundo: 25, ...t });
        const momentos: number[] = [];
        for (let paso = 0; paso < 300; paso++) {
            for (let k = 0; k < 3; k++) l.enviar(`m${paso}-${k}`, () => momentos.push(t.reloj()));
            t.avanzar(10);
        }
        for (let i = 0; i < 600; i++) t.avanzar(100);
        expect(momentos).toHaveLength(900);
        for (const m of momentos) expect(momentos.filter(x => x > m - 1000 && x <= m).length).toBeLessThanOrEqual(25);
    });

    it('parar vacía la cola', () => {
        const t = tiempoFalso();
        const l = crearLimitador({ porSegundo: 1, ...t });
        let n = 0;
        l.enviar('a', () => n++);
        l.enviar('b', () => n++);
        l.parar();
        t.avanzar(5000);
        expect(n).toBe(1);
    });
});
