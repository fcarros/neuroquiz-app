import { describe, it, expect } from 'vitest';
import { canalJugador, canalProfesor, canalTodos, idDeSecreto } from '../src/transporte/canales';
import { DURACION_PRUEBA_MS, atender, atenderPeticion, firmarSala, type Entorno } from './_credenciales';

// Clave inventada con el formato de Ably: solo sirve para firmar aquí.
const ENTORNO: Entorno = { claveAbly: 'appPrueba.claveId:secretoDePruebaNoReal', secretoSala: 'x'.repeat(48) };
const AHORA = 1_800_000_000_000;
const opciones = { ahora: AHORA, elegirPin: () => '482913' };
const SECRETO = 'secreto-de-ana-0001';

interface TokenRequest { keyName: string; clientId: string; capability: string; ttl: number; mac: string }
const token = (cuerpo: unknown) => cuerpo as TokenRequest;
/** Permisos firmados (Ably ordena las operaciones). */
const permisos = (cuerpo: unknown) => Object.fromEntries(Object.entries(JSON.parse(token(cuerpo).capability) as Record<string, string[]>)
    .map(([canal, ops]) => [canal, [...ops].sort()]));

async function crearSala() {
    const r = await atender({ accion: 'crear-sala' }, ENTORNO, opciones);
    expect(r.estado).toBe(200);
    return r.cuerpo as { pin: string; caduca: number; prueba: string };
}

describe('crear sala', () => {
    it('la función elige el PIN y firma la prueba con caducidad de 12 h', async () => {
        const sala = await crearSala();
        expect(sala).toEqual({ pin: '482913', caduca: AHORA + DURACION_PRUEBA_MS, prueba: firmarSala(ENTORNO.secretoSala!, '482913', sala.caduca) });
        expect(sala.prueba).toMatch(/^[0-9a-f]{64}$/);
    });

    it('el PIN por defecto es de 6 cifras y cambia', async () => {
        const pins = new Set<string>();
        for (let i = 0; i < 20; i++) pins.add(((await atender({ accion: 'crear-sala' }, ENTORNO)).cuerpo as { pin: string }).pin);
        expect([...pins].every(p => /^[1-9]\d{5}$/.test(p))).toBe(true);
        expect(pins.size).toBeGreaterThan(15);
    });
});

describe('permisos del profesor', () => {
    it('con prueba válida: todo en su sala y nada más', async () => {
        const sala = await crearSala();
        const r = await atender({ accion: 'profesor', ...sala }, ENTORNO, opciones);
        expect(r.estado).toBe(200);
        expect(token(r.cuerpo)).toMatchObject({ keyName: 'appPrueba.claveId', clientId: 'profesor', ttl: 3_600_000 });
        expect(permisos(r.cuerpo)).toEqual({ 'aq:482913:*': ['presence', 'publish', 'subscribe'] });
        expect(JSON.stringify(r.cuerpo)).not.toContain('secretoDePruebaNoReal');
    });

    it.each([
        ['sin prueba', (s: { pin: string; caduca: number; prueba: string }) => ({ accion: 'profesor', pin: s.pin, caduca: s.caduca })],
        ['con la prueba de otra sala', (s: { pin: string; caduca: number; prueba: string }) => ({ ...s, accion: 'profesor', pin: '111111' })],
        ['con la caducidad cambiada', (s: { pin: string; caduca: number; prueba: string }) => ({ ...s, accion: 'profesor', caduca: s.caduca + 1 })],
        ['con la prueba manipulada', (s: { pin: string; caduca: number; prueba: string }) => ({ ...s, accion: 'profesor', prueba: s.prueba.replace(/^./, c => (c === '0' ? '1' : '0')) })],
        ['con una prueba firmada con otro secreto', (s: { pin: string; caduca: number; prueba: string }) => ({ ...s, accion: 'profesor', prueba: firmarSala('y'.repeat(48), s.pin, s.caduca) })],
    ])('se rechaza %s', async (_, peticion) => {
        const r = await atender(peticion(await crearSala()), ENTORNO, opciones);
        expect([400, 403]).toContain(r.estado);
        expect(r.cuerpo).not.toHaveProperty('capability');
    });

    it('se rechaza la prueba caducada', async () => {
        const sala = await crearSala();
        const r = await atender({ accion: 'profesor', ...sala }, ENTORNO, { ahora: sala.caduca + 1 });
        expect(r.estado).toBe(403);
    });

    it('un jugador no puede pedir permisos de profesor colando campos', async () => {
        const r = await atender({ accion: 'jugador', pin: '482913', secreto: SECRETO, rol: 'profesor' }, ENTORNO, opciones);
        expect(r.estado).toBe(400);
    });
});

describe('permisos del jugador', () => {
    it('escuchar «todos» y su canal; publicar solo al profesor', async () => {
        const r = await atender({ accion: 'jugador', pin: '482913', secreto: SECRETO }, ENTORNO, opciones);
        expect(r.estado).toBe(200);
        const id = await idDeSecreto(SECRETO);
        expect(token(r.cuerpo).clientId).toBe(id);
        expect(permisos(r.cuerpo)).toEqual({
            [canalTodos('482913')]: ['subscribe'],
            [canalJugador('482913', id)]: ['subscribe'],
            [canalProfesor('482913')]: ['publish'],
        });
    });

    it('el id sale del secreto: otro secreto, otro canal', async () => {
        const a = await idDeSecreto(SECRETO);
        const b = await idDeSecreto('secreto-de-bea-0001');
        expect(a).toMatch(/^[0-9a-f]{32}$/);
        expect(a).not.toBe(b);
        expect(await idDeSecreto(SECRETO)).toBe(a);
    });

    it('los nombres de canal no llevan datos personales', async () => {
        const r = await atender({ accion: 'jugador', pin: '482913', secreto: SECRETO }, ENTORNO, opciones);
        for (const canal of Object.keys(permisos(r.cuerpo))) expect(canal).toMatch(/^aq:482913:(todos|profesor|j:[0-9a-f]{32})$/);
    });
});

describe('peticiones no válidas', () => {
    it.each([
        ['nada', undefined], ['texto', 'hola'], ['acción desconocida', { accion: 'admin' }],
        ['PIN corto', { accion: 'jugador', pin: '123', secreto: SECRETO }],
        ['PIN con comodín', { accion: 'jugador', pin: '12345*', secreto: SECRETO }],
        ['secreto con caracteres raros', { accion: 'jugador', pin: '482913', secreto: 'a:b*c:defgh' }],
        ['secreto corto', { accion: 'jugador', pin: '482913', secreto: 'abc' }],
    ])('400 con %s', async (_, datos) => {
        expect((await atender(datos, ENTORNO, opciones)).estado).toBe(400);
    });

    it('500 sin variables de entorno o con un secreto corto, sin dar detalles', async () => {
        expect((await atender({ accion: 'crear-sala' }, {}, opciones)).estado).toBe(500);
        expect((await atender({ accion: 'crear-sala' }, { ...ENTORNO, secretoSala: 'corto' }, opciones)).estado).toBe(500);
    });

    it('la petición web: solo POST, JSON y pequeña', async () => {
        const url = 'https://aula-quiz.test/api/ably-token';
        expect((await atenderPeticion(new Request(url), ENTORNO)).status).toBe(405);
        expect((await atenderPeticion(new Request(url, { method: 'POST', body: '{roto' }), ENTORNO)).status).toBe(400);
        expect((await atenderPeticion(new Request(url, { method: 'POST', body: 'x'.repeat(3000) }), ENTORNO)).status).toBe(413);
        const ok = await atenderPeticion(new Request(url, { method: 'POST', body: JSON.stringify({ accion: 'jugador', pin: '482913', secreto: SECRETO }) }), ENTORNO);
        expect(ok.status).toBe(200);
        expect(ok.headers.get('cache-control')).toBe('no-store');
    });
});
