import { describe, it, expect, afterEach } from 'vitest';
import { leerMensajeMovil, leerMensajeProfesor, type MensajeMovil, type MensajeProfesor } from './mensajes';
import { crearTransporteLocal, nombreCanal, type Transporte } from './transporte';

const ID = 'jugador-ana-0001';
const SECRETO = 'secreto-ana-00000001';
const espera = (ms = 20) => new Promise(r => setTimeout(r, ms));

describe('mensajes del móvil', () => {
    it('acepta los válidos', () => {
        expect(leerMensajeMovil({ tipo: 'hola', id: ID, secreto: SECRETO })).not.toBeNull();
        expect(leerMensajeMovil({ tipo: 'unirse', id: ID, secreto: SECRETO, nombre: '  Ana ' })).toMatchObject({ nombre: 'Ana' });
        expect(leerMensajeMovil({ tipo: 'responder', id: ID, secreto: SECRETO, indice: 3, opcion: 2 })).not.toBeNull();
    });

    it.each([
        ['nada', undefined],
        ['texto', 'hola'],
        ['tipo desconocido', { tipo: 'trampa', id: ID, secreto: SECRETO }],
        ['sin secreto', { tipo: 'responder', id: ID, indice: 0, opcion: 0 }],
        ['id con caracteres raros', { tipo: 'hola', id: 'ana<script>', secreto: SECRETO }],
        ['id corto', { tipo: 'hola', id: 'a', secreto: SECRETO }],
        ['opción 4', { tipo: 'responder', id: ID, secreto: SECRETO, indice: 0, opcion: 4 }],
        ['opción decimal', { tipo: 'responder', id: ID, secreto: SECRETO, indice: 0, opcion: 1.5 }],
        ['opción como texto', { tipo: 'responder', id: ID, secreto: SECRETO, indice: 0, opcion: '1' }],
        ['índice negativo', { tipo: 'responder', id: ID, secreto: SECRETO, indice: -1, opcion: 0 }],
        ['nombre vacío', { tipo: 'unirse', id: ID, secreto: SECRETO, nombre: '   ' }],
        ['nombre de 16', { tipo: 'unirse', id: ID, secreto: SECRETO, nombre: 'a'.repeat(16) }],
        ['campo de más (p. ej. puntos)', { tipo: 'responder', id: ID, secreto: SECRETO, indice: 0, opcion: 0, puntos: 1000 }],
        ['campo de más (p. ej. ms)', { tipo: 'responder', id: ID, secreto: SECRETO, indice: 0, opcion: 0, ms: 0 }],
    ])('descarta: %s', (_, datos) => {
        expect(leerMensajeMovil(datos)).toBeNull();
    });
});

describe('mensajes del profesor', () => {
    it('acepta vistas válidas y descarta las malformadas', () => {
        expect(leerMensajeProfesor({ tipo: 'comun', vista: { fase: 'final', titulo: 'Mazo' } })).not.toBeNull();
        expect(leerMensajeProfesor({ tipo: 'personal', vista: { estado: 'fuera' } })).not.toBeNull();
        expect(leerMensajeProfesor({ tipo: 'comun', vista: { fase: 'pregunta' } })).toBeNull();
        expect(leerMensajeProfesor({ tipo: 'personal', vista: { estado: 'dentro', nombre: 'Ana' } })).toBeNull();
    });
});

describe('transporte local (BroadcastChannel)', () => {
    const abiertos: Transporte[] = [];
    afterEach(() => { abiertos.splice(0).forEach(t => t.desconectar()); });

    async function conectar(sala: string, rol: 'profesor' | string) {
        const t = crearTransporteLocal();
        abiertos.push(t);
        await t.conectar(sala, rol === 'profesor' ? { rol: 'profesor' } : { rol: 'jugador', id: rol, secreto: 'secreto-de-prueba' });
        const recibidos: unknown[] = [];
        t.alRecibir(d => recibidos.push(d));
        return { t, recibidos };
    }

    const comun: MensajeProfesor = { tipo: 'comun', vista: { fase: 'final', titulo: 'x' } };
    const personal: MensajeProfesor = { tipo: 'personal', vista: { estado: 'fuera' } };
    const hola = (id: string): MensajeMovil => ({ tipo: 'hola', id, secreto: SECRETO });

    it('el profesor envía a todos o a uno; los móviles solo hablan con el profesor', async () => {
        const profe = await conectar('111111', 'profesor');
        const ana = await conectar('111111', 'ana-00000001');
        const bea = await conectar('111111', 'bea-00000001');

        profe.t.enviarATodos(comun);
        profe.t.enviarAJugador('ana-00000001', personal);
        ana.t.enviarAlProfesor(hola('ana-00000001'));
        await espera();

        expect(ana.recibidos).toEqual([comun, personal]);
        expect(bea.recibidos).toEqual([comun]);
        expect(profe.recibidos).toEqual([hola('ana-00000001')]);
    });

    it('cada sala va aparte', async () => {
        const profe = await conectar('111111', 'profesor');
        const otro = await conectar('222222', 'ana-00000001');
        profe.t.enviarATodos(comun);
        await espera();
        expect(otro.recibidos).toEqual([]);
    });

    it('cada rol solo puede enviar lo suyo', async () => {
        const profe = await conectar('111111', 'profesor');
        const ana = await conectar('111111', 'ana-00000001');
        expect(() => profe.t.enviarAlProfesor(hola('x'))).toThrow();
        expect(() => ana.t.enviarATodos(comun)).toThrow();
        expect(() => crearTransporteLocal().enviarATodos(comun)).toThrow();
    });

    it('un móvil que se hace pasar por el profesor no llega a nadie', async () => {
        const profe = await conectar('111111', 'profesor');
        const bea = await conectar('111111', 'bea-00000001');
        // Mensaje «a mano» por el canal, con un sobre falso de jugador→jugador.
        const falso = new BroadcastChannel(nombreCanal('111111'));
        falso.postMessage({ de: 'jugador', para: 'todos', datos: comun });
        falso.postMessage('basura');
        falso.postMessage(null);
        await espera();
        falso.close();
        expect(bea.recibidos).toEqual([]);
        // El profesor sí lo recibe como mensaje de jugador, y lo descartará al validarlo.
        expect(profe.recibidos).toEqual([comun]);
        expect(leerMensajeMovil(profe.recibidos[0])).toBeNull();
    });

    it('al desconectar deja de recibir', async () => {
        const profe = await conectar('111111', 'profesor');
        const ana = await conectar('111111', 'ana-00000001');
        ana.t.desconectar();
        profe.t.enviarATodos(comun);
        await espera();
        expect(ana.recibidos).toEqual([]);
    });
});
