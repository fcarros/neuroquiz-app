// Prueba contra Ably de verdad (no entra en `npm test`): `npm run prueba:ably`.
// Necesita ABLY_API_KEY y AULA_QUIZ_SECRETO_SALA en app/.env.local. Juega una
// partida de 10 preguntas con 30 jugadores simulados (cada uno con su propia
// conexión), recarga un móvil en la 4.ª y el profesor en la 7.ª, y mide
// latencias y mensajes (informe en capturas/prueba-ably.txt). Consume unos
// pocos miles de mensajes de la cuenta.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { almacenIdentidades, crearCliente, type Cliente } from '../src/alumno/cliente';
import { clasificacion } from '../src/motor/calculos';
import { crearEstado } from '../src/motor/estado';
import { partidaDePrueba } from '../src/motor/pruebas';
import { crearArbitro, type Arbitro } from '../src/profesor/arbitro';
import { cargarPartida, guardarPartida } from '../src/profesor/persistencia';
import { almacenEnMemoria } from '../src/profesor/pruebas';
import { crearTransporteAbly, type Contadores } from '../src/transporte/ably';
import { pedirAFuncion } from './ablyFalso';

const JUGADORES = 30;
const PREGUNTAS = 10;
const entorno = { claveAbly: process.env.ABLY_API_KEY, secretoSala: process.env.AULA_QUIZ_SECRETO_SALA };
const pedir = pedirAFuncion(entorno);
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

async function esperarA(cond: () => boolean, ms: number, que: string) {
    const fin = Date.now() + ms;
    while (!cond()) {
        if (Date.now() > fin) throw new Error(`Tiempo agotado esperando: ${que}`);
        await espera(10);
    }
}

const percentil = (xs: number[], p: number) => {
    const o = [...xs].sort((a, b) => a - b);
    return o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))];
};
/** Momento en que cada móvil ve cada cosa por primera vez (para medir sin depender del sondeo). */
interface Marcas { pregunta: Map<number, number>; confirmada: Map<number, number>; resultado: Map<number, number> }
function observar(cliente: Cliente, marcas: Marcas) {
    const marcar = (m: Map<number, number>, q: number) => { if (!m.has(q)) m.set(q, Date.now()); };
    cliente.suscribir(() => {
        const { comun, personal } = cliente.estado();
        if (comun?.fase === 'pregunta') marcar(marcas.pregunta, comun.indice);
        if (personal?.estado === 'dentro') {
            if (personal.respondida) marcar(marcas.confirmada, personal.respondida.indice);
            if (personal.resultado && comun?.fase === 'respuesta' && comun.indice === personal.resultado.indice) {
                marcar(marcas.resultado, personal.resultado.indice);
                // La última respuesta cierra la pregunta: su confirmación es el resultado.
                marcar(marcas.confirmada, personal.resultado.indice);
            }
        }
    });
}

const resumen = (xs: number[]) => `mediana ${percentil(xs, 50)} ms · p95 ${percentil(xs, 95)} ms · máx ${Math.max(...xs)} ms (n=${xs.length})`;

describe.skipIf(!entorno.claveAbly || !entorno.secretoSala)('Ably de verdad', () => {
    it('partida de 10 preguntas con 30 jugadores, recarga de móvil y de profesor', async () => {
        const inicio = Date.now();
        const contadores: (() => Contadores)[] = [];
        const nuevoTransporte = (almacen: Storage) => {
            const t = crearTransporteAbly({ pedir, almacen });
            contadores.push(t.contadores);
            return t;
        };

        // Profesor
        const almacenProfe = almacenEnMemoria();
        let tProfe = nuevoTransporte(almacenProfe);
        const pin = await tProfe.crearSala();
        let arbitro: Arbitro = crearArbitro(crearEstado(partidaDePrueba(PREGUNTAS, 20), pin), {
            transporte: tProfe, reloj: Date.now, guardar: e => guardarPartida(e, almacenProfe),
        });
        await arbitro.iniciar();
        // Lee `arbitro` en cada vuelta: sigue valiendo tras recargar el profesor.
        const tick = setInterval(() => arbitro.tick(), 250);

        // 30 móviles, cada uno con su conexión (sin pasar de 42 conexiones nuevas por segundo)
        const moviles: { cliente: Cliente; almacen: Storage; marcas: Marcas }[] = [];
        const entrada: number[] = [];
        for (let i = 0; i < JUGADORES; i++) {
            const almacen = almacenEnMemoria();
            const cliente = crearCliente({ transporte: nuevoTransporte(almacen), almacen: almacenIdentidades(almacen) });
            const marcas: Marcas = { pregunta: new Map(), confirmada: new Map(), resultado: new Map() };
            observar(cliente, marcas);
            moviles.push({ cliente, almacen, marcas });
            const t0 = Date.now();
            void cliente.entrar(pin, `Alumno ${i + 1}`).then(() =>
                esperarA(() => cliente.estado().personal?.estado === 'dentro', 20_000, 'entrar').then(() => entrada.push(Date.now() - t0)));
            await espera(60);
        }
        await esperarA(() => moviles.every(m => m.cliente.estado().personal?.estado === 'dentro'), 30_000, 'que entren todos');
        expect(arbitro.estado().jugadores).toHaveLength(JUGADORES);

        const apertura: number[] = [];
        const confirmacion: number[] = [];
        const resultado: number[] = [];
        const aperturas = new Map<number, number>();

        // Momento real de cada cierre, visto desde el profesor.
        const cierres = new Map<number, number>();
        const vigilarCierres = (a: Arbitro) => a.suscribir(() => {
            const e = a.estado();
            if (e.fase === 'respuesta' && !cierres.has(e.indice)) cierres.set(e.indice, Date.now());
        });
        vigilarCierres(arbitro);

        aperturas.set(0, Date.now());
        arbitro.despachar({ tipo: 'empezar' });
        for (let q = 0; q < PREGUNTAS; q++) {
            const t0 = aperturas.get(q) ?? Date.now();
            // Llega la pregunta a cada móvil
            await Promise.all(moviles.map(m => esperarA(() => m.marcas.pregunta.has(q), 15_000, `pregunta ${q + 1}`)));
            for (const m of moviles) apertura.push(m.marcas.pregunta.get(q)! - t0);

            // Recarga de un móvil a mitad de la 4.ª (antes de responder)
            if (q === 3) {
                const m = moviles[7];
                m.cliente.detener();
                m.cliente = crearCliente({ transporte: nuevoTransporte(m.almacen), almacen: almacenIdentidades(m.almacen) });
                observar(m.cliente, m.marcas);
                expect(await m.cliente.reanudar(pin)).toBe(true);
                await esperarA(() => m.cliente.estado().personal?.estado === 'dentro' && m.cliente.estado().comun?.fase === 'pregunta', 15_000, 'recarga del móvil');
            }

            // Responden todos, repartidos en ~1,5 s; se mide hasta que el profesor confirma.
            const correcta = arbitro.estado().partida.preguntas[q].correcta;
            await Promise.all(moviles.map(async (m, i) => {
                await espera(i * 50);
                const t = Date.now();
                m.cliente.responder(i % 3 === 0 ? (correcta + 1) % 4 : correcta);
                await esperarA(() => m.marcas.confirmada.has(q), 15_000, `confirmación ${q + 1}`);
                confirmacion.push(m.marcas.confirmada.get(q)! - t);
            }));

            // Recarga del profesor en la 7.ª, con la pregunta ya cerrada o a punto
            if (q === 6) {
                arbitro.detener();
                const guardada = cargarPartida(almacenProfe);
                expect(guardada?.pin).toBe(pin);
                tProfe = nuevoTransporte(almacenProfe);
                arbitro = crearArbitro(guardada!, { transporte: tProfe, reloj: Date.now, guardar: e => guardarPartida(e, almacenProfe) });
                vigilarCierres(arbitro);
                await arbitro.iniciar();
            }

            await esperarA(() => arbitro.estado().fase === 'respuesta', 25_000, `cierre ${q + 1}`);
            const tCierre = cierres.get(q) ?? Date.now();
            await Promise.all(moviles.map(m => esperarA(() => m.marcas.resultado.has(q), 15_000, `resultado ${q + 1}`)));
            for (const m of moviles) resultado.push(m.marcas.resultado.get(q)! - tCierre);
            // Como en clase: unos segundos mirando la respuesta antes de pasar.
            await espera(1_500);
            aperturas.set(q + 1, Date.now());
            arbitro.despachar({ tipo: 'siguiente' });
        }
        await Promise.all(moviles.map(m => esperarA(() => m.cliente.estado().comun?.fase === 'final', 15_000, 'final')));
        const tabla = clasificacion(arbitro.estado());
        expect(tabla).toHaveLength(JUGADORES);
        for (const m of moviles) {
            const p = m.cliente.estado().personal;
            const fila = tabla.find(f => p?.estado === 'dentro' && f.nombre === p.nombre)!;
            expect(p).toMatchObject({ estado: 'dentro', puntos: fila.puntos, puesto: fila.puesto });
        }
        // A 1 de cada 3 le salió mal siempre: 0 puntos y racha 0.
        expect(tabla.filter(f => f.puntos === 0)).toHaveLength(JUGADORES / 3);

        const total = contadores.reduce((a, c) => {
            const x = c();
            return { publicados: a.publicados + x.publicados, recibidos: a.recibidos + x.recibidos, descartados: a.descartados + x.descartados };
        }, { publicados: 0, recibidos: 0, descartados: 0 });
        const informe = [
            `Ably real: ${JUGADORES} jugadores, ${PREGUNTAS} preguntas, ${((Date.now() - inicio) / 1000).toFixed(0)} s.`,
            `  Entrar en la sala:             ${resumen(entrada)}`,
            `  Pregunta abierta → móvil:      ${resumen(apertura)}`,
            `  Respuesta → confirmación:      ${resumen(confirmacion)}`,
            `  Cierre → resultado en el móvil: ${resumen(resultado)}`,
            `  Mensajes publicados: ${total.publicados}; recibidos: ${total.recibidos}; descartados: ${total.descartados}.`,
            `  Consumo estimado (publicados + entregados): ${total.publicados + total.recibidos} mensajes.`,
        ].join('\n');
        console.info(informe);
        mkdirSync('capturas', { recursive: true });
        writeFileSync('capturas/prueba-ably.txt', `${new Date().toISOString()}\n${informe}\n`);

        clearInterval(tick);
        arbitro.detener();
        moviles.forEach(m => m.cliente.detener());
    }, 300_000);
});
