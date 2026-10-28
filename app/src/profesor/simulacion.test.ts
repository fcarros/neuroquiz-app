import { describe, it, expect, afterAll } from 'vitest';
import type { Cliente } from '../alumno/cliente';
import { siguienteAzar } from '../mazo/azar';
import { clasificacion, puntosPorAcierto } from '../motor/calculos';
import { nombreCanal } from '../transporte/transporte';
import { crearMovil, espera, montarProfesor, recargarProfesor, relojFalso } from './pruebas';

/**
 * Una clase entera: 30 móviles y el proyector sobre BroadcastChannel (el
 * mismo transporte que usan las pestañas), con reloj falso y azar fijo.
 * Se comprueba que todos acaban con los puntos que dicta la fórmula, que la
 * correcta nunca viaja con la pregunta abierta y que sobreviven recargas.
 */

const JUGADORES = 30;
const PREGUNTAS = 10;
const LIMITE = 20_000;

describe('partida simulada con 30 jugadores', () => {
    const cerrar: { detener(): void }[] = [];
    afterAll(() => cerrar.forEach(x => x.detener()));

    it('juega 10 preguntas completas', async () => {
        const { reloj, avanzar } = relojFalso();
        const montado = await montarProfesor({ reloj, preguntas: PREGUNTAS });
        let arbitro = montado.arbitro;
        const { pin, almacen } = montado;

        // Espía: todo lo que circula por la sala.
        const espia = new BroadcastChannel(nombreCanal(pin));
        const sobres: { de: string; datos: { tipo: string; vista?: Record<string, unknown> } }[] = [];
        espia.onmessage = ev => sobres.push(ev.data);
        cerrar.push({ detener: () => espia.close() });

        const moviles: { cliente: Cliente; almacen: Storage }[] = [];
        for (let i = 0; i < JUGADORES; i++) {
            const m = crearMovil();
            moviles.push(m);
            void m.cliente.entrar(pin, `Alumno ${i + 1}`);
        }
        await espera(60);
        expect(arbitro.estado().jugadores).toHaveLength(JUGADORES);

        arbitro.despachar({ tipo: 'empezar' });
        await espera();
        const idDe = (i: number) => arbitro.estado().jugadores.find(j => j.nombre === `Alumno ${i + 1}`)!.id;

        // Lo que esperamos, calculado aparte con la fórmula.
        const esperado = new Map<string, number>();
        let azar = 2026;
        const tirar = () => { const r = siguienteAzar(azar); azar = r.azar; return r.valor; };

        for (let q = 0; q < PREGUNTAS; q++) {
            const estado = arbitro.estado();
            expect(estado).toMatchObject({ fase: 'pregunta', indice: q });
            const correcta = estado.partida.preguntas[q].correcta;
            // En las preguntas impares, un 20 % no responde y la pregunta se cierra por tiempo.
            const planes = moviles.map((_, i) => ({
                i,
                responde: q % 2 === 0 || tirar() > 0.2,
                opcion: tirar() < 0.6 ? correcta : (correcta + 1 + Math.floor(tirar() * 3)) % 4,
                ms: Math.floor(tirar() * (LIMITE - 1_000)),
            })).filter(p => p.responde).sort((a, b) => a.ms - b.ms);

            const inicio = reloj();
            for (const plan of planes) {
                avanzar(inicio + plan.ms - reloj());
                const m = moviles[plan.i];
                m.cliente.responder(plan.opcion);
                await espera(2);
                const id = idDe(plan.i);
                if (plan.opcion === correcta) esperado.set(id, (esperado.get(id) ?? 0) + puntosPorAcierto(plan.ms, LIMITE));
            }
            await espera();

            // A mitad de partida: recarga un móvil y, en la 6.ª, también el profesor.
            if (q === 3) {
                moviles[7].cliente.detener();
                moviles[7] = { ...moviles[7], cliente: crearMovil(moviles[7].almacen).cliente };
                await moviles[7].cliente.reanudar();
                await espera();
            }
            if (q === 5 && arbitro.estado().fase === 'pregunta') {
                arbitro = await recargarProfesor(arbitro, almacen, reloj);
                await espera();
            }

            if (planes.length < JUGADORES) {
                expect(arbitro.estado().fase).toBe('pregunta');
                avanzar(inicio + LIMITE + 500 - reloj());
                arbitro.tick();
            }
            await espera();
            expect(arbitro.estado().fase).toBe('respuesta');
            for (const m of moviles) {
                expect(m.cliente.estado().comun).toMatchObject({ fase: 'respuesta', indice: q, correcta });
            }
            avanzar(5_000);
            arbitro.despachar({ tipo: 'siguiente' });
            await espera();
        }
        cerrar.push(arbitro, ...moviles.map(m => m.cliente));

        // Final: puntos según la fórmula, y cada móvil ve lo mismo que el proyector.
        const final = arbitro.estado();
        expect(final.fase).toBe('podio');
        const tabla = clasificacion(final);
        expect(tabla).toHaveLength(JUGADORES);
        for (const m of tabla) expect(m.puntos).toBe(esperado.get(m.id) ?? 0);
        moviles.forEach((m, i) => {
            const fila = tabla.find(x => x.id === idDe(i))!;
            expect(m.cliente.estado().comun?.fase).toBe('final');
            expect(m.cliente.estado().personal).toMatchObject({ estado: 'dentro', puntos: fila.puntos, puesto: fila.puesto });
        });

        // La correcta nunca viajó con una pregunta abierta, y ningún secreto salió del profesor.
        const delProfesor = sobres.filter(s => s.de === 'profesor').map(s => s.datos);
        for (const d of delProfesor) {
            if (d.tipo === 'comun' && d.vista?.fase === 'pregunta') expect(d.vista).not.toHaveProperty('correcta');
        }
        const secretos = final.jugadores.map(j => j.secreto);
        const texto = JSON.stringify(delProfesor);
        expect(secretos.some(s => texto.includes(s))).toBe(false);

        // Para dimensionar Ably (fase 3B): mensajes del profesor por pregunta.
        console.info(`Simulación: ${delProfesor.length} mensajes del profesor en ${PREGUNTAS} preguntas con ${JUGADORES} jugadores `
            + `(${Math.round(delProfesor.length / PREGUNTAS)} por pregunta); ${sobres.length - delProfesor.length} de los móviles.`);
    }, 30_000);
});
