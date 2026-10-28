import { describe, it, expect, afterEach } from 'vitest';
import type { Cliente } from '../alumno/cliente';
import { clasificacion } from '../motor/calculos';
import { MARGEN_MS } from '../motor/estado';
import type { MensajeMovil } from '../transporte/mensajes';
import { crearTransporteLocal, type Transporte } from '../transporte/transporte';
import type { Arbitro } from './arbitro';
import { CLAVE_PARTIDA, cargarPartida } from './persistencia';
import { crearMovil, espera, montarProfesor, recargarProfesor, relojFalso } from './pruebas';

const abiertos: { detener(): void }[] = [];
afterEach(() => { abiertos.splice(0).forEach(x => x.detener()); });

const vigilar = <T extends { detener(): void }>(x: T) => { abiertos.push(x); return x; };

async function entrar(pin: string, nombre: string) {
    const movil = crearMovil();
    vigilar(movil.cliente);
    await movil.cliente.entrar(pin, nombre);
    await espera();
    return movil;
}

const correctaActual = (a: Arbitro) => a.estado().partida.preguntas[a.estado().indice].correcta;
const personal = (c: Cliente) => c.estado().personal;

describe('partida a través del transporte', () => {
    it('los móviles entran, responden y ven su resultado; la correcta solo llega al cerrar', async () => {
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin } = await montarProfesor({ reloj });
        vigilar(arbitro);
        const ana = await entrar(pin, 'Ana');
        const bea = await entrar(pin, 'Ana');
        expect(arbitro.estado().jugadores.map(j => j.nombre)).toEqual(['Ana', 'Ana 2']);
        expect(personal(bea.cliente)).toMatchObject({ estado: 'dentro', nombre: 'Ana 2', puntos: 0 });
        expect(ana.cliente.estado().comun).toMatchObject({ fase: 'sala', total: 10 });

        arbitro.despachar({ tipo: 'empezar' });
        await espera();
        const comun = ana.cliente.estado().comun!;
        expect(comun).toMatchObject({ fase: 'pregunta', indice: 0, restanteMs: 20_000 });
        expect(comun).not.toHaveProperty('correcta');

        avanzar(5_000);
        ana.cliente.responder(correctaActual(arbitro));
        await espera();
        expect(personal(ana.cliente)).toMatchObject({ respondida: { indice: 0 } });
        expect(arbitro.estado().fase).toBe('pregunta');

        avanzar(5_000);
        bea.cliente.responder((correctaActual(arbitro) + 1) % 4);
        await espera();
        expect(arbitro.estado().fase).toBe('respuesta');
        expect(ana.cliente.estado().comun).toMatchObject({ fase: 'respuesta', correcta: correctaActual(arbitro) });
        expect(personal(ana.cliente)).toMatchObject({ puntos: 875, puesto: 1, resultado: { acierto: true, puntos: 875 } });
        expect(personal(bea.cliente)).toMatchObject({ puntos: 0, puesto: 2, resultado: { acierto: false } });
    });

    it('cierre por tiempo con el tick del profesor', async () => {
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin } = await montarProfesor({ reloj });
        vigilar(arbitro);
        const ana = await entrar(pin, 'Ana');
        await entrar(pin, 'Bea');
        arbitro.despachar({ tipo: 'empezar' });
        await espera();
        ana.cliente.responder(0);
        avanzar(20_000);
        arbitro.tick();
        expect(arbitro.estado().fase).toBe('pregunta');
        avanzar(MARGEN_MS);
        arbitro.tick();
        await espera();
        expect(arbitro.estado().fase).toBe('respuesta');
        expect(ana.cliente.estado().comun?.fase).toBe('respuesta');
    });

    it('un PIN que no existe: el móvil avisa de que no hay respuesta', async () => {
        const movil = await entrar('999999', 'Ana');
        await espera(150);
        expect(movil.cliente.estado().conexion).toBe('sin-respuesta');
    });

    it('expulsado: lo ve en el móvil, también al recargar', async () => {
        const { arbitro, pin } = await montarProfesor();
        vigilar(arbitro);
        const troll = await entrar(pin, 'Troll');
        arbitro.despachar({ tipo: 'expulsar', id: arbitro.estado().jugadores[0].id });
        await espera();
        expect(personal(troll.cliente)).toEqual({ estado: 'expulsado' });
        troll.cliente.detener();
        const otra = vigilar(crearMovil(troll.almacen).cliente);
        await otra.reanudar();
        await espera();
        expect(personal(otra)).toEqual({ estado: 'expulsado' });
        expect(arbitro.estado().jugadores).toEqual([]);
    });
});

describe('anti-trampas', () => {
    /** Un móvil «a mano» que envía lo que quiera. */
    async function tramposo(pin: string): Promise<Transporte> {
        const t = crearTransporteLocal();
        vigilar({ detener: () => t.desconectar() });
        await t.conectar(pin, { rol: 'jugador', id: 'tramposo-0001' });
        return t;
    }

    async function preparar() {
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin } = await montarProfesor({ reloj });
        vigilar(arbitro);
        const ana = await entrar(pin, 'Ana');
        await entrar(pin, 'Bea');
        arbitro.despachar({ tipo: 'empezar' });
        await espera();
        const { id, secreto } = arbitro.estado().jugadores[0];
        return { arbitro, pin, avanzar, ana, id, secreto };
    }

    it('respuesta doble: solo cuenta la primera', async () => {
        const { arbitro, pin, avanzar, id, secreto } = await preparar();
        const t = await tramposo(pin);
        const buena = correctaActual(arbitro);
        t.enviarAlProfesor({ tipo: 'responder', id, secreto, indice: 0, opcion: (buena + 1) % 4 });
        await espera();
        avanzar(1_000);
        t.enviarAlProfesor({ tipo: 'responder', id, secreto, indice: 0, opcion: buena });
        await espera();
        expect(arbitro.estado().respuestas[0][id]).toEqual({ opcion: (buena + 1) % 4, ms: 0 });
    });

    it('respuesta tardía: pasado el límite + 500 ms se ignora', async () => {
        const { arbitro, pin, avanzar, id, secreto } = await preparar();
        const t = await tramposo(pin);
        avanzar(20_000 + MARGEN_MS + 1);
        t.enviarAlProfesor({ tipo: 'responder', id, secreto, indice: 0, opcion: correctaActual(arbitro) });
        await espera();
        expect(arbitro.estado().respuestas[0]).toEqual({});
    });

    it('jugador desconocido o con el secreto de otro: se ignora', async () => {
        const { arbitro, pin, id } = await preparar();
        const t = await tramposo(pin);
        const otro = arbitro.estado().jugadores[1];
        t.enviarAlProfesor({ tipo: 'responder', id: 'desconocido-01', secreto: 'cualquiera-0001', indice: 0, opcion: 0 });
        t.enviarAlProfesor({ tipo: 'responder', id, secreto: otro.secreto, indice: 0, opcion: 0 });
        t.enviarAlProfesor({ tipo: 'hola', id, secreto: 'adivinado-00001' });
        await espera();
        expect(arbitro.estado().respuestas[0]).toEqual({});
        expect(arbitro.descartados()).toBe(2);
    });

    it('mensajes malformados: se descartan y la partida sigue igual', async () => {
        const { arbitro, pin, id, secreto } = await preparar();
        const t = await tramposo(pin);
        const antes = arbitro.estado();
        const basura: unknown[] = [
            'hola', 42, null, [], {}, { tipo: 'responder' },
            { tipo: 'responder', id, secreto, indice: 0, opcion: 7 },
            { tipo: 'responder', id, secreto, indice: 0, opcion: 0, puntos: 99999 },
            { tipo: 'responder', id, secreto, indice: '0', opcion: 0 },
            { tipo: 'unirse', id: 'nuevo-jugador-1', secreto, nombre: 'x'.repeat(500) },
            { tipo: 'empezar' }, { tipo: 'terminar' },
        ];
        for (const b of basura) t.enviarAlProfesor(b as MensajeMovil);
        await espera();
        expect(arbitro.estado()).toBe(antes);
        expect(arbitro.descartados()).toBe(basura.length);
    });
});

describe('reconexión', () => {
    it('del alumno: al recargar vuelve con sus puntos y su respuesta', async () => {
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin } = await montarProfesor({ reloj });
        vigilar(arbitro);
        const ana = await entrar(pin, 'Ana');
        await entrar(pin, 'Bea');
        arbitro.despachar({ tipo: 'empezar' });
        await espera();
        ana.cliente.responder(correctaActual(arbitro));
        await espera();
        avanzar(30_000);
        arbitro.tick();
        arbitro.despachar({ tipo: 'siguiente' });
        await espera();
        avanzar(2_000);
        ana.cliente.responder(correctaActual(arbitro));
        await espera();

        // Recarga: la pestaña se cierra y se abre con el mismo sessionStorage.
        ana.cliente.detener();
        const recargada = vigilar(crearMovil(ana.almacen).cliente);
        expect(await recargada.reanudar()).toBe(true);
        await espera();
        expect(arbitro.estado().jugadores).toHaveLength(2);
        expect(recargada.estado().comun).toMatchObject({ fase: 'pregunta', indice: 1 });
        expect(personal(recargada)).toMatchObject({ estado: 'dentro', nombre: 'Ana', puntos: 1000, respondida: { indice: 1 } });

        // No puede volver a responder la misma pregunta.
        recargada.responder((correctaActual(arbitro) + 1) % 4);
        await espera();
        expect(arbitro.estado().respuestas[1][arbitro.estado().jugadores[0].id].opcion).toBe(correctaActual(arbitro));
    });

    it('del alumno: sin identidad guardada no hay nada que reanudar', async () => {
        const movil = crearMovil();
        expect(await movil.cliente.reanudar()).toBe(false);
    });

    it('del profesor: recarga a mitad de pregunta y la partida sigue con su reloj', async () => {
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin, almacen } = await montarProfesor({ reloj });
        const ana = await entrar(pin, 'Ana');
        const bea = await entrar(pin, 'Bea');
        arbitro.despachar({ tipo: 'empezar' });
        await espera();
        avanzar(4_000);
        ana.cliente.responder(correctaActual(arbitro));
        await espera();
        expect(almacen.getItem(CLAVE_PARTIDA)).toContain('"fase":"pregunta"');

        // El profesor recarga; mientras tanto Bea responde y su mensaje se pierde.
        arbitro.detener();
        bea.cliente.responder(0);
        await espera();
        expect(bea.cliente.estado().elegida).not.toBeNull();
        avanzar(3_000);
        const nuevo = vigilar(await recargarProfesor(arbitro, almacen, reloj));
        await espera();

        expect(nuevo.estado().jugadores.map(j => j.nombre)).toEqual(['Ana', 'Bea']);
        expect(nuevo.estado().respuestas[0][nuevo.estado().jugadores[0].id]).toEqual({ opcion: correctaActual(nuevo), ms: 4_000 });
        // Los móviles reciben su vista sin pedirla; el tiempo sigue contando desde que se abrió la pregunta.
        expect(bea.cliente.estado().comun).toMatchObject({ fase: 'pregunta', restanteMs: 13_000 });
        // Bea ve que su respuesta no llegó y puede volver a responder.
        expect(bea.cliente.estado().elegida).toBeNull();
        bea.cliente.responder(correctaActual(nuevo));
        await espera();
        expect(nuevo.estado().fase).toBe('respuesta');
        expect(clasificacion(nuevo.estado()).map(m => [m.nombre, m.puntos])).toEqual([['Ana', 900], ['Bea', 825]]);
        expect(cargarPartida(almacen)?.fase).toBe('respuesta');
    });

    it('del profesor: si la pregunta caducó mientras recargaba, se cierra al primer tick', async () => {
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin, almacen } = await montarProfesor({ reloj });
        const ana = await entrar(pin, 'Ana');
        arbitro.despachar({ tipo: 'empezar' });
        avanzar(60_000);
        const nuevo = vigilar(await recargarProfesor(arbitro, almacen, reloj));
        nuevo.tick();
        await espera();
        expect(nuevo.estado().fase).toBe('respuesta');
        expect(ana.cliente.estado().comun?.fase).toBe('respuesta');
    });

    it('lo guardado se valida: un estado manipulado no se carga', async () => {
        const { arbitro, almacen } = await montarProfesor();
        vigilar(arbitro);
        const texto = almacen.getItem(CLAVE_PARTIDA) ?? JSON.stringify(arbitro.estado());
        almacen.setItem(CLAVE_PARTIDA, texto.replace('"fase":"sala"', '"fase":"ganador"'));
        expect(cargarPartida(almacen)).toBeNull();
        almacen.setItem(CLAVE_PARTIDA, '{roto');
        expect(cargarPartida(almacen)).toBeNull();
    });
});
