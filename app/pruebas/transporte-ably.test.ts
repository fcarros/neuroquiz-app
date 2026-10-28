import { describe, it, expect, afterEach } from 'vitest';
import { almacenIdentidades, crearCliente, type Cliente } from '../src/alumno/cliente';
import { crearEstado } from '../src/motor/estado';
import { partidaDePrueba } from '../src/motor/pruebas';
import { crearArbitro, type Arbitro } from '../src/profesor/arbitro';
import { almacenEnMemoria, espera, relojFalso } from '../src/profesor/pruebas';
import { crearTransporteAbly } from '../src/transporte/ably';
import { canalJugador, canalProfesor, canalTodos, idDeSecreto } from '../src/transporte/canales';
import { crearAblyFalso, cubre, pedirAFuncion } from './ablyFalso';

const abiertos: { detener(): void }[] = [];
afterEach(() => { abiertos.splice(0).forEach(x => x.detener()); });

function montar() {
    const ably = crearAblyFalso();
    const pedir = pedirAFuncion();
    const nuevoTransporte = (almacen = almacenEnMemoria()) => crearTransporteAbly({ pedir, crearCliente: ably.crearCliente, almacen });
    return { ably, pedir, nuevoTransporte };
}

async function profesor(m: ReturnType<typeof montar>, reloj: () => number) {
    const almacen = almacenEnMemoria();
    const t = m.nuevoTransporte(almacen);
    const pin = await t.crearSala();
    const arbitro = crearArbitro(crearEstado(partidaDePrueba(10), pin), { transporte: t, reloj });
    await arbitro.iniciar();
    abiertos.push(arbitro);
    return { arbitro, pin, transporte: t, almacen };
}

async function movil(m: ReturnType<typeof montar>, pin: string, nombre: string, almacen = almacenEnMemoria()) {
    const cliente = crearCliente({ transporte: m.nuevoTransporte(), almacen: almacenIdentidades(almacen), reintentoMs: 30, avisoMs: 100 });
    abiertos.push(cliente);
    await cliente.entrar(pin, nombre);
    await espera(30);
    return { cliente, almacen };
}

const correcta = (a: Arbitro) => a.estado().partida.preguntas[a.estado().indice].correcta;

describe('comodines de los permisos (como Ably)', () => {
    it('aq:PIN:* cubre los canales de la sala y nada más', () => {
        expect(cubre('aq:123456:*', 'aq:123456:todos')).toBe(true);
        expect(cubre('aq:123456:*', 'aq:123456:j:abc')).toBe(true);
        expect(cubre('aq:123456:*', 'aq:654321:todos')).toBe(false);
        expect(cubre('aq:123456:*', 'aq:123456')).toBe(false);
        expect(cubre('aq:123456:todos', 'aq:123456:todos:x')).toBe(false);
    });
});

describe('transporte Ably (con un doble que aplica los permisos firmados)', () => {
    it('partida por Ably: entrar, responder, resultado; la correcta no viaja antes de tiempo', async () => {
        const m = montar();
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin } = await profesor(m, reloj);
        const ana = await movil(m, pin, 'Ana');
        const bea = await movil(m, pin, 'Bea');
        expect(arbitro.estado().jugadores.map(j => j.nombre)).toEqual(['Ana', 'Bea']);
        // El id del jugador es el que firma Ably (sale de su secreto).
        const id = arbitro.estado().jugadores[0].id;
        expect(id).toBe(await idDeSecreto(arbitro.estado().jugadores[0].secreto));
        expect(m.ably.suscriptores(canalJugador(pin, id))).toEqual([id]);
        expect(m.ably.suscriptores(canalProfesor(pin))).toEqual(['profesor']);

        arbitro.despachar({ tipo: 'empezar' });
        await espera(20);
        expect(ana.cliente.estado().comun).toMatchObject({ fase: 'pregunta', indice: 0 });
        expect(ana.cliente.estado().comun).not.toHaveProperty('correcta');
        avanzar(2_000);
        ana.cliente.responder(correcta(arbitro));
        bea.cliente.responder((correcta(arbitro) + 1) % 4);
        await espera(30);
        expect(arbitro.estado().fase).toBe('respuesta');
        expect(ana.cliente.estado().personal).toMatchObject({ puntos: 950, puesto: 1, resultado: { acierto: true } });
        expect(bea.cliente.estado().comun).toMatchObject({ fase: 'respuesta', correcta: correcta(arbitro) });
        expect(m.ably.cuenta.rechazados).toBe(0);
    });

    it('un jugador no puede escuchar el canal del profesor, ni el de otro, ni otra sala', async () => {
        const m = montar();
        const { pin } = await profesor(m, Date.now);
        const otro = await idDeSecreto('secreto-de-otro-0001');
        const cliente = await m.ably.crearCliente(() => m.pedir({ accion: 'jugador', pin, secreto: 'secreto-mio-000001' }));
        await expect(cliente.canal(canalProfesor(pin), 'escuchar').subscribe(() => {})).rejects.toThrow(/sin permiso/);
        await expect(cliente.canal(canalJugador(pin, otro), 'escuchar').subscribe(() => {})).rejects.toThrow(/sin permiso/);
        await expect(cliente.canal(canalTodos('111111'), 'escuchar').subscribe(() => {})).rejects.toThrow(/sin permiso/);
        await expect(cliente.canal(canalTodos(pin), 'publicar').publish('m', { falso: true })).rejects.toThrow(/sin permiso/);
        await expect(cliente.canal(canalTodos(pin), 'escuchar').subscribe(() => {})).resolves.toBeUndefined();
    });

    it('el profesor necesita la prueba de su sala: sin ella, o para otra sala, no conecta', async () => {
        const m = montar();
        const { pin, almacen } = await profesor(m, Date.now);
        // Otro navegador (sin la prueba guardada) no puede hacerse profesor de esa sala.
        await expect(m.nuevoTransporte().conectar(pin, { rol: 'profesor' })).rejects.toThrow(/no se creó en este navegador/);
        // Con la prueba de esta sala copiada a otra: la función la rechaza.
        const robada = almacenEnMemoria();
        robada.setItem('aula-quiz:sala:111111', almacen.getItem(`aula-quiz:sala:${pin}`)!);
        await expect(m.nuevoTransporte(robada).conectar('111111', { rol: 'profesor' })).rejects.toThrow(/rechazadas \(403\)/);
    });

    it('nadie habla en nombre de otro: el profesor descarta los mensajes cuyo clientId no cuadra', async () => {
        const m = montar();
        const { reloj } = relojFalso();
        const { arbitro, pin, transporte } = await profesor(m, reloj);
        const ana = await movil(m, pin, 'Ana');
        arbitro.despachar({ tipo: 'empezar' });
        await espera(20);
        const anaId = arbitro.estado().jugadores[0].id;
        const secretoAna = arbitro.estado().jugadores[0].secreto;
        // Un tramposo con credenciales propias envía la respuesta de Ana (aunque supiera su secreto).
        const tramposo = await m.ably.crearCliente(() => m.pedir({ accion: 'jugador', pin, secreto: 'secreto-tramposo-01' }));
        await tramposo.canal(canalProfesor(pin), 'publicar').publish('m', { tipo: 'responder', id: anaId, secreto: secretoAna, indice: 0, opcion: 0 });
        await espera(20);
        expect(arbitro.estado().respuestas[0]).toEqual({});
        expect((transporte as ReturnType<typeof crearTransporteAbly>).contadores().descartados).toBe(1);
        ana.cliente.responder(0);
        await espera(20);
        expect(arbitro.estado().respuestas[0][anaId]).toBeDefined();
    });

    it('limita los envíos del profesor: con 30 jugadores, el cierre sale en dos tandas', async () => {
        const m = montar();
        const { reloj } = relojFalso();
        const { arbitro, pin } = await profesor(m, reloj);
        const moviles: Cliente[] = [];
        for (let i = 0; i < 30; i++) moviles.push((await movil(m, pin, `A${i}`)).cliente);
        // 30 llegadas = unos 60 envíos del profesor: a 25 por segundo, menos de 3 s.
        await espera(2600);
        expect(moviles.every(c => c.estado().personal?.estado === 'dentro')).toBe(true);
        arbitro.despachar({ tipo: 'empezar' });
        await espera(1100);
        const antes = m.ably.cuenta.publicados;
        moviles.forEach(c => c.responder(0));
        await espera(50);
        expect(arbitro.estado().fase).toBe('respuesta');
        // 30 respuestas + como mucho 25 envíos del profesor en el primer segundo…
        expect(m.ably.cuenta.publicados - antes).toBeLessThanOrEqual(30 + 25);
        await espera(2200);
        // …y el resto después: todos acaban con su resultado.
        for (const c of moviles) expect(c.estado().personal).toMatchObject({ resultado: { indice: 0 } });
    }, 15_000);

    it('reconexión: el móvil avisa, y al volver recupera lo que se perdió', async () => {
        const m = montar();
        const { reloj } = relojFalso();
        const { arbitro, pin } = await profesor(m, reloj);
        const ana = await movil(m, pin, 'Ana');
        await movil(m, pin, 'Bea');
        const idAna = arbitro.estado().jugadores[0].id;
        m.ably.cortar(idAna);
        expect(ana.cliente.estado().red).toBe('reconectando');
        // Mientras está cortada, empieza la partida: ese mensaje no le llega.
        arbitro.despachar({ tipo: 'empezar' });
        await espera(20);
        expect(ana.cliente.estado().comun?.fase).toBe('sala');
        m.ably.restablecer(idAna);
        await espera(40);
        expect(ana.cliente.estado().red).toBe('conectado');
        expect(ana.cliente.estado().comun).toMatchObject({ fase: 'pregunta', indice: 0 });
    });

    it('reconexión del profesor: al volver reenvía todo y la respuesta perdida se puede repetir', async () => {
        const m = montar();
        const { reloj, avanzar } = relojFalso();
        const { arbitro, pin } = await profesor(m, reloj);
        const ana = await movil(m, pin, 'Ana');
        await movil(m, pin, 'Bea');
        arbitro.despachar({ tipo: 'empezar' });
        await espera(20);
        m.ably.cortar('profesor');
        expect(arbitro.red()).toBe('reconectando');
        ana.cliente.responder(0);
        await espera(20);
        expect(ana.cliente.estado().elegida).not.toBeNull();
        m.ably.restablecer('profesor');
        await espera(40);
        expect(arbitro.red()).toBe('conectado');
        // El profesor no recibió la respuesta (en el doble se pierde; Ably la reentregaría): Ana puede repetirla.
        expect(ana.cliente.estado().elegida).toBeNull();
        avanzar(1_000);
        ana.cliente.responder(0);
        await espera(20);
        expect(arbitro.estado().respuestas[0][arbitro.estado().jugadores[0].id]).toEqual({ opcion: 0, ms: 1_000 });
    });

    it('recarga del móvil con Ably: vuelve con la identidad guardada en su almacén', async () => {
        const m = montar();
        const { reloj } = relojFalso();
        const { arbitro, pin } = await profesor(m, reloj);
        const ana = await movil(m, pin, 'Ana');
        ana.cliente.detener();
        const otra = crearCliente({ transporte: m.nuevoTransporte(), almacen: almacenIdentidades(ana.almacen), reintentoMs: 30 });
        abiertos.push(otra);
        expect(await otra.reanudar(pin)).toBe(true);
        await espera(30);
        expect(otra.estado().personal).toMatchObject({ estado: 'dentro', nombre: 'Ana' });
        expect(arbitro.estado().jugadores).toHaveLength(1);
    });
});
