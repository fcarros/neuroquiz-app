import { describe, it, expect, beforeEach } from 'vitest';
import { crearMazo } from '../mazo/pruebas';
import {
    CLAVE_ALMACEN, analizarImportacion, borrarImportado, cargarImportados, cargarIncluidos, guardarImportado,
} from './biblioteca';

/** localStorage en memoria (los tests se ejecutan en Node). */
function instalarAlmacen(): Map<string, string> {
    const datos = new Map<string, string>();
    globalThis.localStorage = {
        getItem: k => datos.get(k) ?? null,
        setItem: (k, v) => { datos.set(k, String(v)); },
        removeItem: k => { datos.delete(k); },
        clear: () => datos.clear(),
        key: i => [...datos.keys()][i] ?? null,
        get length() { return datos.size; },
    } satisfies Storage;
    return datos;
}

const mazoConId = (id: string) => ({ ...crearMazo(), id, titulo: `Mazo ${id}` });

describe('biblioteca de mazos', () => {
    let almacen: Map<string, string>;
    beforeEach(() => { almacen = instalarAlmacen(); });

    it('carga los incluidos y todos son válidos', () => {
        const incluidos = cargarIncluidos();
        expect(incluidos.map(e => e.id).sort()).toEqual([
            'cdi-t1-marco-global', 'cdi-t2-como-funciona-internet', 'cdi-t3-herramientas-digitales', 'industria-4-0',
        ]);
        expect(incluidos.every(e => e.origen === 'incluido' && e.validacion.valido)).toBe(true);
    });

    it('sin nada guardado no hay importados ni error', () => {
        expect(cargarImportados()).toEqual({ entradas: [], error: null });
    });

    it('rechaza un archivo que no es JSON', () => {
        expect(analizarImportacion('{ no es json', cargarIncluidos()).tipo).toBe('error-json');
    });

    it('rechaza un mazo inválido con sus errores', () => {
        const r = analizarImportacion(JSON.stringify({ ...crearMazo(), formato: 2 }), cargarIncluidos());
        expect(r.tipo).toBe('invalido');
        if (r.tipo === 'invalido') expect(r.validacion.errores.length).toBeGreaterThan(0);
    });

    it('no deja importar un mazo con el id de uno incluido', () => {
        const r = analizarImportacion(JSON.stringify(mazoConId('industria-4-0')), cargarIncluidos());
        expect(r).toEqual({ tipo: 'conflicto-incluido', id: 'industria-4-0' });
    });

    it('importa, avisa al sustituir uno con el mismo id y borra', () => {
        const texto = JSON.stringify(mazoConId('propio'));
        const r1 = analizarImportacion(texto, cargarIncluidos());
        expect(r1.tipo === 'listo' && !r1.reemplaza).toBe(true);
        if (r1.tipo === 'listo') expect(guardarImportado(r1.datos)).toBeNull();

        const r2 = analizarImportacion(texto, cargarIncluidos());
        expect(r2.tipo === 'listo' && r2.reemplaza).toBe(true);
        if (r2.tipo === 'listo') guardarImportado(r2.datos);
        expect(cargarImportados().entradas).toHaveLength(1);

        expect(borrarImportado(cargarImportados().entradas[0])).toBeNull();
        expect(cargarImportados().entradas).toHaveLength(0);
    });

    it('vuelve a validar los importados al cargarlos', () => {
        // Un mazo que se estropeó después de guardarse (p. ej. editado a mano).
        almacen.set(CLAVE_ALMACEN, JSON.stringify([{ ...mazoConId('roto'), preguntas: [] }]));
        const [entrada] = cargarImportados().entradas;
        expect(entrada.validacion.valido).toBe(false);
        expect(entrada.titulo).toBe('Mazo roto');
    });

    it('informa si lo guardado está dañado y no lo sobrescribe', () => {
        almacen.set(CLAVE_ALMACEN, '{"no":"es una lista"}');
        expect(cargarImportados().error).toMatch(/dañados/);
        expect(guardarImportado(mazoConId('nuevo'))).toMatch(/No se ha guardado/);
        expect(almacen.get(CLAVE_ALMACEN)).toBe('{"no":"es una lista"}');
    });
});
