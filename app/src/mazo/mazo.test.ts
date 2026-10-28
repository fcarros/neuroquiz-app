import { describe, it, expect } from 'vitest';
import { validarMazo, contarPorColor, nombresCategorias } from './mazo';
import { crearMazo } from './pruebas';

/** Copia profunda para modificar sin tocar el original. */
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Valida y devuelve los errores como un solo texto, para buscar en él. */
const errores = (datos: unknown) => validarMazo(datos).errores.join('\n');

describe('validarMazo: mazo válido', () => {
    it('acepta un mazo correcto sin errores ni avisos', () => {
        const r = validarMazo(crearMazo());
        expect(r.errores).toEqual([]);
        expect(r.avisos).toEqual([]);
        expect(r.valido).toBe(true);
        expect(r.mazo?.preguntas).toHaveLength(60);
    });

    it('acepta los campos opcionales', () => {
        const m = crearMazo();
        m.descripcion = 'Descripción';
        m.preguntas[0].dificultad = 'facil';
        m.preguntas[0].explicacion = 'Porque sí.';
        expect(validarMazo(m).valido).toBe(true);
    });

    it('cuenta preguntas y nombres por color', () => {
        const m = crearMazo(10);
        expect(contarPorColor(m).marron).toBe(10);
        expect(nombresCategorias(m).azul).toBe('Tema azul');
    });
});

describe('validarMazo: errores', () => {
    it('rechaza algo que no es un objeto', () => {
        for (const datos of [null, 42, 'texto', [1, 2]]) {
            const r = validarMazo(datos);
            expect(r.valido).toBe(false);
            expect(r.errores[0]).toMatch(/no contiene un mazo/);
        }
    });

    it('formato distinto de 1', () => {
        const m = copia(crearMazo()) as Record<string, unknown>;
        m.formato = 2;
        expect(errores(m)).toMatch(/«formato» debe ser 1/);
        delete m.formato;
        expect(errores(m)).toMatch(/falta el campo «formato»/i);
    });

    it.each(['id', 'titulo', 'modulo'])('campo obligatorio «%s» ausente o vacío', campo => {
        const m = copia(crearMazo()) as Record<string, unknown>;
        m[campo] = '   ';
        expect(errores(m)).toMatch(new RegExp(`«${campo}» está vacío`));
        delete m[campo];
        expect(errores(m)).toMatch(new RegExp(`falta el campo «${campo}»`, 'i'));
    });

    it.each(['categorias', 'preguntas'])('lista obligatoria «%s» ausente', campo => {
        const m = copia(crearMazo()) as Record<string, unknown>;
        delete m[campo];
        expect(errores(m)).toMatch(new RegExp(`falta el campo «${campo}»`, 'i'));
    });

    it.each(['id', 'enunciado'])('campo obligatorio de pregunta «%s» vacío', campo => {
        const m = copia(crearMazo()) as unknown as { preguntas: Record<string, unknown>[] };
        m.preguntas[2][campo] = '';
        expect(errores(m)).toMatch(new RegExp(`Pregunta n\\.º 3.*«${campo}» está vacío`));
    });

    it('categoría con nombre vacío', () => {
        const m = copia(crearMazo());
        m.categorias[1].nombre = '';
        expect(errores(m)).toMatch(/Categoría n\.º 2: el campo «nombre» está vacío/);
    });

    it('falta una categoría', () => {
        const m = copia(crearMazo());
        m.categorias = m.categorias.filter(c => c.color !== 'verde');
        expect(errores(m)).toMatch(/falta la categoría del color verde/);
    });

    it('categoría repetida', () => {
        const m = copia(crearMazo());
        m.categorias.push({ color: 'azul', nombre: 'Otra' });
        expect(errores(m)).toMatch(/el color azul aparece más de una vez/);
    });

    it('categoría con un color inexistente', () => {
        const m = copia(crearMazo()) as unknown as { categorias: { color: string }[] };
        m.categorias[3].color = 'morado';
        const e = errores(m);
        expect(e).toMatch(/el color «morado» no existe/);
        expect(e).toMatch(/falta la categoría del color marrón/);
    });

    it('pregunta con un color inexistente', () => {
        const m = copia(crearMazo()) as unknown as { preguntas: { color: string }[] };
        m.preguntas[0].color = 'lila';
        expect(errores(m)).toMatch(/Pregunta n\.º 1 \(p001\): el color «lila» no existe/);
    });

    it('opciones que no son exactamente 4', () => {
        const m = copia(crearMazo());
        m.preguntas[0].opciones = ['a', 'b', 'c'];
        m.preguntas[1].opciones = ['a', 'b', 'c', 'd', 'e'];
        const e = errores(m);
        expect(e).toMatch(/Pregunta n\.º 1 \(p001\): tiene 3 opciones; deben ser exactamente 4/);
        expect(e).toMatch(/Pregunta n\.º 2 \(p002\): tiene 5 opciones; deben ser exactamente 4/);
    });

    it('opción vacía', () => {
        const m = copia(crearMazo());
        m.preguntas[0].opciones[2] = '  ';
        expect(errores(m)).toMatch(/Pregunta n\.º 1 \(p001\), opción 3: está vacía/);
    });

    it('opciones repetidas (sin distinguir mayúsculas ni espacios)', () => {
        const m = copia(crearMazo());
        m.preguntas[0].opciones = ['Router', 'Switch', '  router ', 'Hub'];
        expect(errores(m)).toMatch(/Pregunta n\.º 1 \(p001\): hay opciones repetidas/);
    });

    it.each([4, -1, 1.5, '2'])('«correcta» fuera de 0-3: %s', valor => {
        const m = copia(crearMazo()) as unknown as { preguntas: { correcta: unknown }[] };
        m.preguntas[0].correcta = valor;
        expect(errores(m)).toMatch(/Pregunta n\.º 1 \(p001\): «correcta» debe ser/);
    });

    it('ids de pregunta repetidos', () => {
        const m = copia(crearMazo());
        m.preguntas[5].id = 'p001';
        expect(errores(m)).toMatch(/El id de pregunta «p001» está repetido \(preguntas n\.º 1, 6\)/);
    });

    it('categoría sin preguntas', () => {
        const m = copia(crearMazo());
        m.preguntas = m.preguntas.filter(p => p.color !== 'naranja');
        expect(errores(m)).toMatch(/La categoría naranja \(Tema naranja\) no tiene preguntas/);
    });

    it.each(['Pregunta vacía', 'pregunta vacia', '  PREGUNTA VACÍA. ', 'Lorem ipsum dolor sit amet'])(
        'enunciado de relleno: «%s»', enunciado => {
            const m = copia(crearMazo());
            m.preguntas[0].enunciado = enunciado;
            expect(errores(m)).toMatch(/Pregunta n\.º 1 \(p001\): el enunciado .* es un texto de relleno/);
        });

    it('opciones de relleno A, B, C, D', () => {
        const m = copia(crearMazo());
        m.preguntas[0].opciones = ['A', 'B', 'C', 'D'];
        expect(errores(m)).toMatch(/Pregunta n\.º 1 \(p001\): las opciones son «A», «B», «C» y «D»/);
    });

    it('dificultad no admitida', () => {
        const m = copia(crearMazo()) as unknown as { preguntas: { dificultad?: string }[] };
        m.preguntas[0].dificultad = 'media-alta';
        expect(errores(m)).toMatch(/«dificultad» debe ser facil, media o dificil/);
    });

    it('informa de varios errores a la vez', () => {
        const m = copia(crearMazo()) as unknown as Record<string, unknown> & { preguntas: Record<string, unknown>[] };
        m.formato = 3;
        m.preguntas[0].correcta = 9;
        m.preguntas[1].enunciado = 'Pregunta vacía';
        const r = validarMazo(m);
        expect(r.valido).toBe(false);
        expect(r.mazo).toBeNull();
        expect(r.errores.length).toBeGreaterThanOrEqual(3);
    });
});

describe('validarMazo: avisos', () => {
    it('menos de 10 preguntas en una categoría', () => {
        const r = validarMazo(crearMazo(9));
        expect(r.valido).toBe(true);
        expect(r.avisos.join('\n')).toMatch(/La categoría azul \(Tema azul\) solo tiene 9 preguntas/);
    });

    it('enunciados duplicados', () => {
        const m = crearMazo();
        m.preguntas[7].enunciado = '  ¿PREGUNTA número 1? ';
        const r = validarMazo(m);
        expect(r.valido).toBe(true);
        expect(r.avisos.join('\n')).toMatch(/Las preguntas n\.º 1, 8 tienen el mismo enunciado/);
    });

    it('enunciado de más de 200 caracteres y opción de más de 80', () => {
        const m = crearMazo();
        m.preguntas[0].enunciado = '¿' + 'x'.repeat(205) + '?';
        m.preguntas[1].opciones[3] = 'y'.repeat(81);
        const avisos = validarMazo(m).avisos.join('\n');
        expect(avisos).toMatch(/Pregunta n\.º 1 \(p001\): el enunciado tiene 207 caracteres/);
        expect(avisos).toMatch(/Pregunta n\.º 2 \(p002\), opción 4: tiene 81 caracteres/);
    });

    it('categorías muy descompensadas (la mayor el doble o más que la menor)', () => {
        const m = crearMazo(10);
        let extra = 1000;
        for (let i = 0; i < 10; i++) {
            m.preguntas.push({ ...m.preguntas[0], id: `x${extra++}`, enunciado: `¿Extra ${extra}?` });
        }
        const r = validarMazo(m);
        expect(r.valido).toBe(true);
        expect(r.avisos.join('\n')).toMatch(/muy descompensadas: van de 10 a 20/);

        const casi = crearMazo(10);
        for (let i = 0; i < 9; i++) {
            casi.preguntas.push({ ...casi.preguntas[0], id: `y${i}`, enunciado: `¿Casi ${i}?` });
        }
        expect(validarMazo(casi).avisos.join('\n')).not.toMatch(/descompensadas/);
    });
});
