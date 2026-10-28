import { describe, it, expect } from 'vitest';
import { cargarIncluidos } from '../biblioteca/biblioteca';
import { IDS_COLOR, type ColorId } from '../mazo/colores';
import type { Mazo } from '../mazo/mazo';
import { crearMazo } from '../mazo/pruebas';
import {
    CANTIDADES, CONFIGURACION_INICIAL, FILTROS_DIFICULTAD, SEGUNDOS, ajustarConfiguracion, esPosible,
    opcionesCantidad, opcionesDificultad, prepararPartida, preguntasDisponibles, type Configuracion,
} from './configuracion';

const MAZOS_REALES = cargarIncluidos().map(e => e.validacion.mazo!);
const porId = (id: string) => MAZOS_REALES.find(m => m.id === id)!;
const CDI1 = porId('cdi-t1-marco-global');
const INDUSTRIA = porId('industria-4-0');

/** Mazo de prueba con 10 preguntas por color y dificultades repartidas: 4 fáciles, 3 medias y 3 difíciles. */
function mazoConDificultades(): Mazo {
    const m = crearMazo(10);
    m.preguntas.forEach((p, i) => { p.dificultad = (['facil', 'facil', 'media', 'dificil', 'facil', 'media', 'dificil', 'facil', 'media', 'dificil'] as const)[i % 10]; });
    return m;
}

const config = (parcial: Partial<Configuracion>): Configuracion => ({ ...CONFIGURACION_INICIAL, ...parcial });

/** Todos los subconjuntos no vacíos de las seis categorías (63). */
const SUBCONJUNTOS: ColorId[][] = Array.from({ length: 63 }, (_, k) => IDS_COLOR.filter((_, i) => ((k + 1) >> i) & 1));

describe('filtros', () => {
    const m = mazoConDificultades();

    it('categorías: solo entran las elegidas', () => {
        const d = preguntasDisponibles(m, ['azul', 'rosa'], 'todas');
        expect(d).toHaveLength(20);
        expect(new Set(d.map(p => p.color))).toEqual(new Set(['azul', 'rosa']));
    });

    it('dificultad: solo entran las de esa dificultad', () => {
        expect(preguntasDisponibles(m, IDS_COLOR, 'facil')).toHaveLength(24);
        expect(preguntasDisponibles(m, IDS_COLOR, 'media')).toHaveLength(18);
        expect(preguntasDisponibles(m, ['verde'], 'dificil').every(p => p.color === 'verde' && p.dificultad === 'dificil')).toBe(true);
    });

    it('número: se ofrecen solo los que caben en las categorías elegidas', () => {
        const ofrecidos = (cats: readonly ColorId[]) => opcionesCantidad(m, cats).filter(o => o.posible).map(o => o.valor);
        expect(ofrecidos(['azul'])).toEqual([10, 'todas']);
        expect(ofrecidos(['azul', 'rosa'])).toEqual([10, 15, 20, 'todas']);
        expect(ofrecidos(IDS_COLOR)).toEqual([10, 15, 20, 30, 'todas']);
        expect(opcionesCantidad(m, ['azul']).find(o => o.valor === 'todas')!.preguntas).toBe(10);
    });

    it('dificultad: se ofrecen solo las que cubren el número elegido', () => {
        const ofrecidas = (cats: readonly ColorId[], n: number | 'todas') =>
            opcionesDificultad(m, cats, n).filter(o => o.posible).map(o => o.valor);
        expect(ofrecidas(IDS_COLOR, 20)).toEqual(['todas', 'facil']); // 24 fáciles, 18 medias, 18 difíciles
        expect(ofrecidas(IDS_COLOR, 10)).toEqual(['todas', 'facil', 'media', 'dificil']);
        expect(ofrecidas(['azul'], 10)).toEqual(['todas']);
        expect(ofrecidas(['azul'], 'todas')).toEqual(['todas', 'facil', 'media', 'dificil']);
    });

    it('un mazo sin dificultades solo ofrece «Todas»', () => {
        const ofrecidas = opcionesDificultad(INDUSTRIA, IDS_COLOR, 'todas').filter(o => o.posible).map(o => o.valor);
        expect(ofrecidas).toEqual(['todas']);
    });
});

describe('ajustes', () => {
    const m = mazoConDificultades();

    it('no toca una configuración posible', () => {
        // El mazo de prueba no tiene explicaciones: «mostrar» se apagaría.
        const c = config({ cantidad: 15, dificultad: 'facil', mostrarExplicacion: false });
        expect(ajustarConfiguracion(m, c)).toEqual({ config: c, cambios: [] });
    });

    it('al quitar categorías baja el número al mayor que quepa y lo avisa', () => {
        const r = ajustarConfiguracion(m, config({ categorias: ['azul', 'rosa'], cantidad: 30 }));
        expect(r.config.cantidad).toBe(20);
        expect(r.cambios).toHaveLength(1);
    });

    it('si el número deja fuera la dificultad, pasa a «Todas» y lo avisa', () => {
        const r = ajustarConfiguracion(m, config({ cantidad: 20, dificultad: 'media' }));
        expect(r.config.dificultad).toBe('todas');
        expect(r.cambios[0]).toMatch(/dificultad/);
    });

    it('desactiva la explicación si el mazo no tiene ninguna', () => {
        expect(ajustarConfiguracion(INDUSTRIA, config({ mostrarExplicacion: true })).config.mostrarExplicacion).toBe(false);
        expect(ajustarConfiguracion(CDI1, config({ mostrarExplicacion: true })).config.mostrarExplicacion).toBe(true);
    });

    it('sin categorías vuelve a todas', () => {
        expect(ajustarConfiguracion(m, config({ categorias: [] })).config.categorias).toEqual([...IDS_COLOR]);
    });
});

describe('selección de preguntas', () => {
    const m = mazoConDificultades();

    it('elige el número exacto, sin repetir y respetando los filtros', () => {
        const c = config({ categorias: ['azul', 'verde', 'naranja'], dificultad: 'facil', cantidad: 10 });
        const p = prepararPartida(m, c, 1234);
        expect(p.preguntas).toHaveLength(10);
        expect(new Set(p.preguntas.map(q => q.id)).size).toBe(10);
        expect(p.preguntas.every(q => c.categorias.includes(q.color) && q.dificultad === 'facil')).toBe(true);
    });

    it('«Todas» incluye todas las disponibles', () => {
        const p = prepararPartida(m, config({ categorias: ['rosa'], cantidad: 'todas' }), 1);
        expect(p.preguntas).toHaveLength(10);
    });

    it('baraja las opciones sin perder cuál es la correcta', () => {
        const p = prepararPartida(CDI1, config({ cantidad: 30 }), 99);
        const originales = new Map(CDI1.preguntas.map(q => [q.id, q]));
        const posiciones = new Set<number>();
        for (const q of p.preguntas) {
            const o = originales.get(q.id)!;
            expect([...q.opciones].sort()).toEqual([...o.opciones].sort());
            expect(q.opciones[q.correcta]).toBe(o.opciones[o.correcta]);
            posiciones.add(q.correcta);
        }
        expect(posiciones.size).toBeGreaterThan(1);
    });

    it('con la misma semilla sale lo mismo y con otra, otra selección', () => {
        const c = config({ cantidad: 10 });
        expect(prepararPartida(CDI1, c, 7)).toEqual(prepararPartida(CDI1, c, 7));
        expect(prepararPartida(CDI1, c, 7).preguntas.map(q => q.id))
            .not.toEqual(prepararPartida(CDI1, c, 8).preguntas.map(q => q.id));
    });

    it('lleva el nombre de la categoría, la explicación y la configuración', () => {
        const p = prepararPartida(CDI1, config({ segundos: 30, mostrarExplicacion: false }), 5);
        expect(p.segundos).toBe(30);
        expect(p.mostrarExplicacion).toBe(false);
        expect(p.mazo).toEqual({ id: CDI1.id, titulo: CDI1.titulo, modulo: CDI1.modulo });
        const nombres = new Set(CDI1.categorias.map(c => c.nombre));
        expect(p.preguntas.every(q => nombres.has(q.categoria) && q.explicacion)).toBe(true);
    });

    it('rechaza una configuración imposible', () => {
        expect(() => prepararPartida(m, config({ categorias: ['azul'], cantidad: 30 }), 1)).toThrow();
    });
});

describe('nunca se ofrece una combinación imposible', () => {
    // Recorre todas las combinaciones de categorías × número × dificultad en
    // cada mazo. Lo que la interfaz ofrece debe poder prepararse; y cualquier
    // combinación, una vez ajustada, debe ser una de las ofrecidas.
    const mazos: [string, Mazo][] = [...MAZOS_REALES.map(m => [m.id, m] as [string, Mazo]), ['prueba', mazoConDificultades()]];

    it.each(mazos)('%s', (_id, mazo) => {
        let ofrecidas = 0;
        for (const categorias of SUBCONJUNTOS) {
            const cantidades = opcionesCantidad(mazo, categorias);
            for (const cantidad of CANTIDADES) {
                const dificultades = opcionesDificultad(mazo, categorias, cantidad);
                for (const dificultad of FILTROS_DIFICULTAD) {
                    const c = config({ categorias, cantidad, dificultad, segundos: SEGUNDOS[0] });
                    const ofrecida = cantidades.find(o => o.valor === cantidad)!.posible
                        && dificultades.find(o => o.valor === dificultad)!.posible;
                    expect(esPosible(mazo, c)).toBe(ofrecida);

                    if (ofrecida) {
                        ofrecidas++;
                        const p = prepararPartida(mazo, c, ofrecidas);
                        const disponibles = preguntasDisponibles(mazo, categorias, dificultad).length;
                        expect(p.preguntas).toHaveLength(cantidad === 'todas' ? disponibles : cantidad);
                        expect(new Set(p.preguntas.map(q => q.id)).size).toBe(p.preguntas.length);
                    }

                    const ajustada = ajustarConfiguracion(mazo, c);
                    expect(esPosible(mazo, ajustada.config)).toBe(true);
                    expect(ajustada.cambios.length === 0).toBe(ofrecida);
                }
            }
        }
        expect(ofrecidas).toBeGreaterThan(0);
    });
});
