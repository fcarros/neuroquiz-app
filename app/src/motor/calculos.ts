import { limiteMs, type EstadoPartida } from './estado';

/** Puntos por un acierto: round(1000 × (1 − t / límite ÷ 2)), entre 500 y 1000. */
export function puntosPorAcierto(ms: number, limite: number): number {
    const t = Math.min(Math.max(ms, 0), limite);
    return Math.round(1000 * (1 - t / limite / 2));
}

/** Preguntas ya cerradas y no saltadas, en orden. Son las que cuentan. */
export function preguntasJugadas(estado: EstadoPartida): number[] {
    const ultima = estado.fase === 'pregunta' ? estado.indice - 1 : estado.indice;
    const jugadas: number[] = [];
    for (let i = 0; i <= ultima; i++) if (!estado.saltadas.includes(i)) jugadas.push(i);
    return jugadas;
}

export interface Marcador {
    id: string;
    nombre: string;
    puntos: number;
    aciertos: number;
    /** Aciertos seguidos hasta la última pregunta jugada. No suma puntos. */
    racha: number;
    mejorRacha: number;
    /** Empatados a puntos comparten puesto. */
    puesto: number;
    /** Puesto antes de la última pregunta jugada (null si no había ninguna). */
    puestoAnterior: number | null;
}

interface Cuenta { puntos: number; aciertos: number; racha: number; mejorRacha: number }

function contar(estado: EstadoPartida, jugadas: readonly number[]): Map<string, Cuenta> {
    const limite = limiteMs(estado);
    const cuentas = new Map<string, Cuenta>();
    for (const j of estado.jugadores) {
        const c: Cuenta = { puntos: 0, aciertos: 0, racha: 0, mejorRacha: 0 };
        for (const i of jugadas) {
            if (i < j.desde) continue;
            const r = estado.respuestas[i][j.id];
            if (r && r.opcion === estado.partida.preguntas[i].correcta) {
                c.puntos += puntosPorAcierto(r.ms, limite);
                c.aciertos++;
                c.racha++;
                c.mejorRacha = Math.max(c.mejorRacha, c.racha);
            } else {
                c.racha = 0;
            }
        }
        cuentas.set(j.id, c);
    }
    return cuentas;
}

function puestos(estado: EstadoPartida, cuentas: Map<string, Cuenta>): Map<string, number> {
    const lista = [...cuentas.values()].map(c => c.puntos);
    return new Map(estado.jugadores.map(j => {
        const p = cuentas.get(j.id)!.puntos;
        return [j.id, 1 + lista.filter(x => x > p).length];
    }));
}

/** Clasificación de todos: más puntos primero; a igualdad, por orden de llegada. */
export function clasificacion(estado: EstadoPartida): Marcador[] {
    const jugadas = preguntasJugadas(estado);
    const cuentas = contar(estado, jugadas);
    const ahora = puestos(estado, cuentas);
    const antes = jugadas.length > 0 ? puestos(estado, contar(estado, jugadas.slice(0, -1))) : null;
    return estado.jugadores
        .map((j): Marcador => ({
            id: j.id,
            nombre: j.nombre,
            ...cuentas.get(j.id)!,
            puesto: ahora.get(j.id)!,
            puestoAnterior: antes?.get(j.id) ?? null,
        }))
        .sort((a, b) => a.puesto - b.puesto);
}

/** Cuántos eligieron cada opción (A-D) en una pregunta. */
export function votos(estado: EstadoPartida, indice: number): [number, number, number, number] {
    const v: [number, number, number, number] = [0, 0, 0, 0];
    for (const r of Object.values(estado.respuestas[indice])) v[r.opcion]++;
    return v;
}

export interface Estadisticas {
    /** Aciertos / (jugadores × preguntas en las que podían responder), de 0 a 1. */
    aciertoClase: number | null;
    masDificil: { indice: number; enunciado: string; acierto: number } | null;
    mejorRacha: { valor: number; nombres: string[] } | null;
}

export function estadisticas(estado: EstadoPartida): Estadisticas {
    const jugadas = preguntasJugadas(estado);
    let aciertos = 0;
    let oportunidades = 0;
    let masDificil: Estadisticas['masDificil'] = null;
    for (const i of jugadas) {
        const pregunta = estado.partida.preguntas[i];
        const posibles = estado.jugadores.filter(j => j.desde <= i);
        if (posibles.length === 0) continue;
        const bien = posibles.filter(j => estado.respuestas[i][j.id]?.opcion === pregunta.correcta).length;
        aciertos += bien;
        oportunidades += posibles.length;
        const acierto = bien / posibles.length;
        if (!masDificil || acierto < masDificil.acierto) masDificil = { indice: i, enunciado: pregunta.enunciado, acierto };
    }
    const tabla = clasificacion(estado);
    const valor = Math.max(0, ...tabla.map(m => m.mejorRacha));
    return {
        aciertoClase: oportunidades > 0 ? aciertos / oportunidades : null,
        masDificil,
        mejorRacha: valor > 0 ? { valor, nombres: tabla.filter(m => m.mejorRacha === valor).map(m => m.nombre) } : null,
    };
}

/** Celda de CSV: entre comillas si hace falta y sin fórmulas (Excel ejecuta lo que empieza por = + - @). */
function celda(valor: string | number): string {
    let texto = String(valor);
    if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Tabla final en CSV para Excel en español: separador «;», BOM UTF-8 y saltos CRLF. */
export function tablaCsv(estado: EstadoPartida): string {
    const total = preguntasJugadas(estado).length;
    const filas = [
        ['Puesto', 'Nombre', 'Puntos', `Aciertos (de ${total})`, 'Mejor racha'],
        ...clasificacion(estado).map(m => [m.puesto, m.nombre, m.puntos, m.aciertos, m.mejorRacha]),
    ];
    return '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n') + '\r\n';
}
