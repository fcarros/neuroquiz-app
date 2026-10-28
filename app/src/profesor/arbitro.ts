import { esJugador, reducir, buscarJugador, type Accion, type EstadoPartida } from '../motor/estado';
import { vistaComun, vistaJugador, type VistaComun } from '../motor/vistas';
import { leerMensajeMovil, type MensajeProfesor } from '../transporte/mensajes';
import type { Transporte } from '../transporte/transporte';

/**
 * El árbitro: une el motor con el transporte en el navegador del profesor.
 * Recibe los mensajes de los móviles (validados), aplica las acciones con
 * su reloj, guarda el estado y envía a cada móvil solo lo que ha cambiado de
 * su vista.
 */

export interface OpcionesArbitro {
    transporte: Transporte;
    /** Reloj del profesor en ms (Date.now en el juego; uno falso en los tests). */
    reloj: () => number;
    /** Se llama tras cada cambio (persistencia). */
    guardar?: (estado: EstadoPartida) => void;
}

export interface Arbitro {
    iniciar(): Promise<void>;
    detener(): void;
    estado(): EstadoPartida;
    /** Acciones del profesor (empezar, siguiente…). El reloj lo pone el árbitro. */
    despachar(accion: AccionProfesor): void;
    /** Comprueba si se ha acabado el tiempo. Se llama varias veces por segundo. */
    tick(): void;
    suscribir(fn: () => void): () => void;
    /** Mensajes descartados por no cumplir el esquema (para diagnóstico). */
    descartados(): number;
}

type SinReloj<A> = A extends { ahora: number } ? Omit<A, 'ahora'> : A;
export type AccionProfesor = SinReloj<Exclude<Accion, { tipo: 'unirse' | 'responder' | 'tick' }>>;

/** Firma de una vista para saber si ha cambiado (el tiempo restante no cuenta). */
const firmaComun = (v: VistaComun) => JSON.stringify(v.fase === 'pregunta' ? { ...v, restanteMs: 0 } : v);

export function crearArbitro(inicial: EstadoPartida, { transporte, reloj, guardar }: OpcionesArbitro): Arbitro {
    let estado = inicial;
    let ultimaComun: string | null = null;
    const ultimaPersonal = new Map<string, string>();
    const oyentes = new Set<() => void>();
    let descartados = 0;
    let dejarDeEscuchar: (() => void) | null = null;

    const enviarPersonal = (id: string, forzar = false) => {
        const vista = vistaJugador(estado, id);
        const firma = JSON.stringify(vista);
        if (!forzar && ultimaPersonal.get(id) === firma) return;
        ultimaPersonal.set(id, firma);
        transporte.enviarAJugador(id, { tipo: 'personal', vista });
    };

    /** Envía a todos lo que haya cambiado desde el último envío. */
    const sincronizar = () => {
        const comun = vistaComun(estado, reloj());
        const firma = firmaComun(comun);
        if (firma !== ultimaComun) {
            ultimaComun = firma;
            transporte.enviarATodos({ tipo: 'comun', vista: comun });
        }
        for (const j of estado.jugadores) enviarPersonal(j.id);
        for (const id of estado.expulsados) enviarPersonal(id);
    };

    /** Respuesta completa a un móvil que llega o vuelve. */
    const saludar = (id: string) => {
        const comun: MensajeProfesor = { tipo: 'comun', vista: vistaComun(estado, reloj()) };
        transporte.enviarAJugador(id, comun);
        enviarPersonal(id, true);
    };

    const aplicar = (accion: Accion) => {
        const nuevo = reducir(estado, accion);
        if (nuevo === estado) return false;
        estado = nuevo;
        guardar?.(estado);
        sincronizar();
        for (const fn of oyentes) fn();
        return true;
    };

    const recibir = (datos: unknown) => {
        const m = leerMensajeMovil(datos);
        if (!m) { descartados++; return; }
        const conocido = buscarJugador(estado, m.id);
        // Un id que ya existe solo se acepta con su secreto: nadie habla por otro.
        if (conocido && !esJugador(estado, m.id, m.secreto)) { descartados++; return; }
        switch (m.tipo) {
            case 'hola':
                saludar(m.id);
                break;
            case 'unirse':
                if (conocido || !aplicar(m)) saludar(m.id);
                else transporte.enviarAJugador(m.id, { tipo: 'comun', vista: vistaComun(estado, reloj()) });
                break;
            case 'responder':
                aplicar({ ...m, ahora: reloj() });
                break;
        }
    };

    return {
        async iniciar() {
            await transporte.conectar(estado.pin, { rol: 'profesor' });
            dejarDeEscuchar = transporte.alRecibir(recibir);
            // Tras recargar, los móviles que siguen abiertos reciben su vista sin pedirla.
            ultimaComun = null;
            ultimaPersonal.clear();
            sincronizar();
        },
        detener() {
            dejarDeEscuchar?.();
            transporte.desconectar();
        },
        estado: () => estado,
        despachar(accion) {
            aplicar({ ...accion, ahora: reloj() } as Accion);
        },
        tick() {
            aplicar({ tipo: 'tick', ahora: reloj() });
        },
        suscribir(fn) {
            oyentes.add(fn);
            return () => oyentes.delete(fn);
        },
        descartados: () => descartados,
    };
}
