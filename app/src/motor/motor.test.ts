import { describe, it, expect } from 'vitest';
import { clasificacion, estadisticas, preguntasJugadas, puntosPorAcierto, tablaCsv, votos } from './calculos';
import { MARGEN_MS, generarPin, nombreUnico, normalizarNombre, reducir, type EstadoPartida } from './estado';
import { aplicar, correcta, estadoDePrueba, incorrecta, partidaDePrueba, responder, unirse } from './pruebas';
import { vistaComun, vistaJugador } from './vistas';

const T0 = 1_000_000;
const LIMITE = 20_000;

/** Sala con Ana, Bea y Carlos, y la primera pregunta abierta en T0. */
const conTres = (): EstadoPartida =>
    aplicar(estadoDePrueba(), unirse('ana', 'Ana'), unirse('bea', 'Bea'), unirse('carlos', 'Carlos'), { tipo: 'empezar', ahora: T0 });

describe('puntuación', () => {
    it('round(1000 × (1 − t / límite ÷ 2))', () => {
        expect(puntosPorAcierto(0, LIMITE)).toBe(1000);
        expect(puntosPorAcierto(5_000, LIMITE)).toBe(875);
        expect(puntosPorAcierto(10_000, LIMITE)).toBe(750);
        expect(puntosPorAcierto(LIMITE, LIMITE)).toBe(500);
        expect(puntosPorAcierto(1_234, LIMITE)).toBe(Math.round(1000 * (1 - 1234 / LIMITE / 2)));
    });

    it('dentro del margen cuenta como en el límite: 500', () => {
        expect(puntosPorAcierto(LIMITE + 400, LIMITE)).toBe(500);
    });

    it('fallo y sin respuesta: 0; la racha no suma', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', correcta(e), T0 + 2_000), responder(e, 'bea', incorrecta(e), T0 + 1_000));
        e = aplicar(e, { tipo: 'tick', ahora: T0 + LIMITE + MARGEN_MS });
        const t = clasificacion(e);
        expect(t.find(m => m.id === 'ana')!.puntos).toBe(950);
        expect(t.find(m => m.id === 'bea')!.puntos).toBe(0);
        expect(t.find(m => m.id === 'carlos')!.puntos).toBe(0);

        // Segundo acierto de Ana, al mismo tiempo: suma lo mismo aunque lleve racha.
        e = aplicar(e, { tipo: 'siguiente', ahora: T0 + 30_000 });
        e = aplicar(e, responder(e, 'ana', correcta(e), T0 + 32_000), { tipo: 'tick', ahora: T0 + 60_000 });
        const ana = clasificacion(e).find(m => m.id === 'ana')!;
        expect(ana.puntos).toBe(1900);
        expect(ana.racha).toBe(2);
    });
});

describe('flujo completo', () => {
    it('sala → preguntas → podio → tabla, con puntos, rachas y puestos', () => {
        let e = aplicar(estadoDePrueba(partidaDePrueba(10)), unirse('ana', 'Ana'), unirse('bea', 'Bea'));
        expect(e.fase).toBe('sala');
        e = reducir(e, { tipo: 'empezar', ahora: T0 });
        let reloj = T0;
        for (let i = 0; i < 10; i++) {
            expect(e.fase).toBe('pregunta');
            expect(e.indice).toBe(i);
            // Ana acierta siempre a los 4 s; Bea acierta las pares a los 10 s y falla las impares.
            e = reducir(e, responder(e, 'ana', correcta(e), reloj + 4_000));
            e = reducir(e, responder(e, 'bea', i % 2 === 0 ? correcta(e) : incorrecta(e), reloj + 10_000));
            expect(e.fase).toBe('respuesta');
            reloj += 30_000;
            e = reducir(e, { tipo: 'siguiente', ahora: reloj });
        }
        expect(e.fase).toBe('podio');
        const [primera, segunda] = clasificacion(e);
        expect(primera).toMatchObject({ nombre: 'Ana', puntos: 9000, aciertos: 10, racha: 10, mejorRacha: 10, puesto: 1 });
        expect(segunda).toMatchObject({ nombre: 'Bea', puntos: 3750, aciertos: 5, racha: 0, mejorRacha: 1, puesto: 2 });
        expect(estadisticas(e)).toMatchObject({ aciertoClase: 0.75, mejorRacha: { valor: 10, nombres: ['Ana'] } });
        expect(estadisticas(e).masDificil!.indice).toBe(1);
        e = reducir(e, { tipo: 'verTabla' });
        expect(e.fase).toBe('tabla');
        expect(reducir(e, { tipo: 'verPodio' }).fase).toBe('podio');
    });

    it('no se puede empezar sin jugadores', () => {
        const e = estadoDePrueba();
        expect(reducir(e, { tipo: 'empezar', ahora: T0 })).toBe(e);
    });

    it('subidas y bajadas: puesto antes de la última pregunta', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', correcta(e), T0 + 1_000), responder(e, 'bea', incorrecta(e), T0 + 1_000),
            responder(e, 'carlos', incorrecta(e), T0 + 1_000));
        e = aplicar(e, { tipo: 'siguiente', ahora: T0 + 30_000 });
        e = aplicar(e, responder(e, 'bea', correcta(e), T0 + 30_000), responder(e, 'ana', incorrecta(e), T0 + 30_000),
            responder(e, 'carlos', correcta(e), T0 + 40_000));
        const t = clasificacion(e);
        expect(t.map(m => [m.nombre, m.puesto, m.puestoAnterior])).toEqual([['Bea', 1, 2], ['Ana', 2, 1], ['Carlos', 3, 2]]);
    });

    it('empatados a puntos comparten puesto', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', correcta(e), T0 + 1_000), responder(e, 'bea', correcta(e), T0 + 1_000),
            responder(e, 'carlos', incorrecta(e), T0 + 1_000));
        expect(clasificacion(e).map(m => m.puesto)).toEqual([1, 1, 3]);
    });
});

describe('cierre de la pregunta', () => {
    it('por tiempo: al pasar el límite más el margen', () => {
        const e = conTres();
        expect(reducir(e, { tipo: 'tick', ahora: T0 + LIMITE })).toBe(e);
        expect(reducir(e, { tipo: 'tick', ahora: T0 + LIMITE + MARGEN_MS - 1 })).toBe(e);
        expect(reducir(e, { tipo: 'tick', ahora: T0 + LIMITE + MARGEN_MS }).fase).toBe('respuesta');
    });

    it('cuando han respondido todos, aunque quede tiempo', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', 0, T0 + 1_000), responder(e, 'bea', 1, T0 + 2_000));
        expect(e.fase).toBe('pregunta');
        e = reducir(e, responder(e, 'carlos', 2, T0 + 3_000));
        expect(e.fase).toBe('respuesta');
        expect(votos(e, 0)).toEqual([1, 1, 1, 0]);
    });

    it('«Siguiente» solo funciona con la pregunta cerrada', () => {
        const e = conTres();
        expect(reducir(e, { tipo: 'siguiente', ahora: T0 + 1 })).toBe(e);
    });
});

describe('saltar y terminar', () => {
    it('saltar anula la pregunta: nadie suma ni pierde racha', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', correcta(e), T0 + 1_000), responder(e, 'bea', correcta(e), T0 + 1_000),
            responder(e, 'carlos', correcta(e), T0 + 1_000), { tipo: 'siguiente', ahora: T0 + 30_000 });
        e = reducir(e, responder(e, 'ana', correcta(e), T0 + 31_000));
        e = reducir(e, { tipo: 'saltar', ahora: T0 + 35_000 });
        expect(e).toMatchObject({ fase: 'pregunta', indice: 2, abiertaEn: T0 + 35_000, saltadas: [1] });
        expect(e.respuestas[1]).toEqual({});
        expect(preguntasJugadas(e)).toEqual([0]);
        e = aplicar(e, responder(e, 'ana', correcta(e), T0 + 35_000), { tipo: 'tick', ahora: T0 + 60_000 });
        const ana = clasificacion(e).find(m => m.id === 'ana')!;
        expect(ana).toMatchObject({ puntos: 1975, racha: 2 });
        expect(clasificacion(e).find(m => m.id === 'bea')!.racha).toBe(0);
    });

    it('saltar la última pregunta lleva al podio', () => {
        let e = aplicar(estadoDePrueba(partidaDePrueba(10)), unirse('ana'), { tipo: 'empezar', ahora: T0 });
        for (let i = 0; i < 9; i++) e = aplicar(e, { tipo: 'saltar', ahora: T0 });
        expect(e.indice).toBe(9);
        e = reducir(e, { tipo: 'saltar', ahora: T0 });
        expect(e.fase).toBe('podio');
        expect(preguntasJugadas(e)).toEqual([]);
        expect(estadisticas(e)).toEqual({ aciertoClase: null, masDificil: null, mejorRacha: null });
    });

    it('terminar con la pregunta abierta: va al podio y esa pregunta no cuenta', () => {
        let e = conTres();
        e = reducir(e, responder(e, 'ana', correcta(e), T0 + 1_000));
        e = reducir(e, { tipo: 'terminar' });
        expect(e.fase).toBe('podio');
        expect(preguntasJugadas(e)).toEqual([]);
        expect(clasificacion(e)[0].puntos).toBe(0);
    });

    it('terminar con la pregunta cerrada: esa pregunta sí cuenta', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', correcta(e), T0), { tipo: 'tick', ahora: T0 + 30_000 }, { tipo: 'terminar' });
        expect(e.fase).toBe('podio');
        expect(clasificacion(e)[0]).toMatchObject({ nombre: 'Ana', puntos: 1000 });
    });

    it('terminar en la sala no hace nada', () => {
        const e = aplicar(estadoDePrueba(), unirse('ana'));
        expect(reducir(e, { tipo: 'terminar' })).toBe(e);
    });
});

describe('jugadores', () => {
    it('nombres: espacios, longitud y repetidos', () => {
        expect(normalizarNombre('  Ana   María  ')).toBe('Ana María');
        expect(normalizarNombre('Abcdefghijklmnopqrs')).toBe('Abcdefghijklmno');
        expect(normalizarNombre('\u0007 ')).toBe('');
        expect(nombreUnico('Ana', ['Bea'])).toBe('Ana');
        expect(nombreUnico('Ana', ['ana'])).toBe('Ana 2');
        expect(nombreUnico('Ana', ['Ana', 'Ana 2'])).toBe('Ana 3');
        expect(nombreUnico('Abcdefghijklmno', ['abcdefghijklmno'])).toBe('Abcdefghijklm 2');
    });

    it('al unirse se numera el nombre repetido y se ignoran los vacíos', () => {
        const e = aplicar(estadoDePrueba(), unirse('a', 'Ana'), unirse('b', 'ana'), unirse('c', '   '));
        expect(e.jugadores.map(j => j.nombre)).toEqual(['Ana', 'ana 2']);
    });

    it('volver a unirse con el mismo id no duplica ni cambia nada', () => {
        const e = aplicar(estadoDePrueba(), unirse('ana', 'Ana'));
        expect(reducir(e, unirse('ana', 'Otra'))).toBe(e);
    });

    it('entrar con la partida empezada: 0 puntos, y puede responder la pregunta abierta', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', correcta(e), T0), responder(e, 'bea', correcta(e), T0), responder(e, 'carlos', correcta(e), T0));
        e = reducir(e, unirse('dani', 'Dani'));
        expect(e.jugadores.at(-1)!.desde).toBe(1);
        expect(vistaJugador(e, 'dani')).toMatchObject({ estado: 'dentro', puntos: 0, resultado: null });
        e = reducir(e, { tipo: 'siguiente', ahora: T0 + 30_000 });
        e = reducir(e, unirse('eva', 'Eva'));
        expect(e.jugadores.at(-1)!.desde).toBe(1);
        e = aplicar(e, responder(e, 'eva', correcta(e), T0 + 30_000), { tipo: 'tick', ahora: T0 + 60_000 });
        expect(clasificacion(e).find(m => m.id === 'eva')!.puntos).toBe(1000);
        // La 1.ª solo cuenta para los tres que estaban (3 de 3); la 2.ª, para los cinco (1 de 5).
        e = reducir(e, { tipo: 'terminar' });
        expect(estadisticas(e).aciertoClase).toBe(0.5);
    });

    it('no se entra con la partida terminada', () => {
        const e = aplicar(conTres(), { tipo: 'terminar' });
        expect(reducir(e, unirse('tarde'))).toBe(e);
        expect(vistaJugador(e, 'tarde')).toEqual({ estado: 'cerrada' });
    });

    it('expulsar: solo en la sala, y no puede volver con el mismo id', () => {
        let e = aplicar(estadoDePrueba(), unirse('ana'), unirse('troll'));
        e = reducir(e, { tipo: 'expulsar', id: 'troll' });
        expect(e.jugadores.map(j => j.id)).toEqual(['ana']);
        expect(reducir(e, unirse('troll'))).toBe(e);
        expect(vistaJugador(e, 'troll')).toEqual({ estado: 'expulsado' });
        e = reducir(e, { tipo: 'empezar', ahora: T0 });
        expect(reducir(e, { tipo: 'expulsar', id: 'ana' })).toBe(e);
    });
});

describe('anti-trampas en el motor', () => {
    it('respuesta doble: vale solo la primera', () => {
        let e = conTres();
        e = reducir(e, responder(e, 'ana', incorrecta(e), T0 + 1_000));
        const tras = reducir(e, responder(e, 'ana', correcta(e), T0 + 2_000));
        expect(tras).toBe(e);
        expect(e.respuestas[0].ana.opcion).toBe(incorrecta(e));
    });

    it('respuesta tardía: se admite hasta el límite + 500 ms', () => {
        const e = conTres();
        expect(reducir(e, responder(e, 'ana', correcta(e), T0 + LIMITE + MARGEN_MS)).respuestas[0].ana).toBeDefined();
        expect(reducir(e, responder(e, 'ana', correcta(e), T0 + LIMITE + MARGEN_MS + 1))).toBe(e);
    });

    it('jugador desconocido o secreto equivocado: se ignora', () => {
        const e = conTres();
        expect(reducir(e, { ...responder(e, 'nadie', 0, T0 + 1), secreto: 's-nadie' })).toBe(e);
        expect(reducir(e, { ...responder(e, 'ana', 0, T0 + 1), secreto: 's-bea' })).toBe(e);
    });

    it('respuesta a otra pregunta u opción fuera de rango: se ignora', () => {
        const e = conTres();
        expect(reducir(e, { ...responder(e, 'ana', 0, T0 + 1), indice: 1 })).toBe(e);
        expect(reducir(e, responder(e, 'ana', 4, T0 + 1))).toBe(e);
        expect(reducir(e, responder(e, 'ana', 1.5, T0 + 1))).toBe(e);
        expect(reducir(e, responder(e, 'ana', -1, T0 + 1))).toBe(e);
    });

    it('respuesta con la pregunta ya cerrada: se ignora', () => {
        const e = aplicar(conTres(), { tipo: 'tick', ahora: T0 + 60_000 });
        expect(reducir(e, { tipo: 'responder', id: 'ana', secreto: 's-ana', indice: 0, opcion: 0, ahora: T0 + 60_001 })).toBe(e);
    });
});

describe('vistas para los móviles', () => {
    it('con la pregunta abierta no viaja la correcta ni ningún secreto', () => {
        let e = conTres();
        e = reducir(e, responder(e, 'ana', correcta(e), T0 + 3_000));
        const comun = vistaComun(e, T0 + 5_000);
        const personal = vistaJugador(e, 'ana');
        expect(comun).toMatchObject({ fase: 'pregunta', indice: 0, total: 10, restanteMs: 15_000 });
        expect(comun).not.toHaveProperty('correcta');
        expect(comun).not.toHaveProperty('explicacion');
        expect(personal).toMatchObject({ respondida: { indice: 0, opcion: correcta(e) }, resultado: null, puntos: 0 });
        const texto = JSON.stringify([comun, personal]);
        expect(texto).not.toMatch(/"correcta"|"acierto"|s-ana/);
    });

    it('al cerrar se revela la correcta y el resultado de cada uno', () => {
        let e = conTres();
        e = aplicar(e, responder(e, 'ana', correcta(e), T0 + 5_000), { tipo: 'tick', ahora: T0 + 30_000 });
        expect(vistaComun(e, T0 + 30_000)).toMatchObject({ fase: 'respuesta', correcta: correcta(e) });
        expect(vistaJugador(e, 'ana')).toMatchObject({
            puntos: 875, puesto: 1, racha: 1, resultado: { acierto: true, puntos: 875, ms: 5_000, opcion: correcta(e) },
        });
        expect(vistaJugador(e, 'bea')).toMatchObject({ puesto: 2, resultado: { acierto: false, puntos: 0, ms: null, opcion: null } });
    });

    it('la explicación solo viaja si está activada', () => {
        const partida = partidaDePrueba();
        partida.preguntas[0].explicacion = 'Porque sí.';
        const cerrar = (p: typeof partida) => {
            let e = aplicar(estadoDePrueba(p), unirse('ana'), { tipo: 'empezar', ahora: T0 });
            e = reducir(e, { tipo: 'tick', ahora: T0 + 30_000 });
            return vistaComun(e, T0 + 30_000);
        };
        expect(cerrar({ ...partida, mostrarExplicacion: true })).toMatchObject({ explicacion: 'Porque sí.' });
        expect(cerrar({ ...partida, mostrarExplicacion: false })).not.toHaveProperty('explicacion');
    });

    it('quien no está: «fuera» durante la partida', () => {
        expect(vistaJugador(conTres(), 'nadie')).toEqual({ estado: 'fuera' });
    });
});

describe('utilidades', () => {
    it('PIN de 6 cifras, determinista', () => {
        for (let s = 0; s < 500; s++) expect(generarPin(s * 7919)).toMatch(/^[1-9]\d{5}$/);
        expect(generarPin(1)).toBe(generarPin(1));
    });

    it('CSV: BOM, «;», comillas y sin fórmulas', () => {
        let e = aplicar(estadoDePrueba(), unirse('a', 'Ana; "la mejor"'), unirse('b', '=1+1'), { tipo: 'empezar', ahora: T0 });
        e = aplicar(e, responder(e, 'a', correcta(e), T0), { tipo: 'tick', ahora: T0 + 30_000 }, { tipo: 'terminar' });
        expect(tablaCsv(e)).toBe(
            '﻿Puesto;Nombre;Puntos;Aciertos (de 1);Mejor racha\r\n'
            + '1;"Ana; ""la mejor""";1000;1;1\r\n'
            + "2;'=1+1;0;0;0\r\n");
    });
});
