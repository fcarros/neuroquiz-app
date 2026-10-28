import { describe, it, expect } from 'vitest';
import { ARCHIVOS_INCLUIDOS } from '../biblioteca/incluidos';
import { validarMazo } from './mazo';

describe('mazos incluidos (app/mazos/)', () => {
    it('hay al menos un mazo', () => {
        expect(ARCHIVOS_INCLUIDOS.length).toBeGreaterThan(0);
    });

    it.each(ARCHIVOS_INCLUIDOS.map(a => [a.archivo, a.datos] as const))('%s es válido', (_archivo, datos) => {
        const r = validarMazo(datos);
        expect(r.errores).toEqual([]);
        expect(r.valido).toBe(true);
    });

    it('no repiten id', () => {
        const ids = ARCHIVOS_INCLUIDOS.map(a => (a.datos as { id: string }).id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
