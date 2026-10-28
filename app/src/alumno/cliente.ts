import type { VistaComun, VistaJugador } from '../motor/vistas';
import { leerMensajeProfesor } from '../transporte/mensajes';
import { idDeSecreto } from '../transporte/canales';
import type { Transporte } from '../transporte/transporte';

/**
 * El móvil del alumno, sin interfaz: guarda su identidad (id público y
 * secreto) para volver con sus puntos si recarga, pide su vista al profesor
 * y envía las respuestas. Lo que recibe se valida antes de usarlo.
 */

export interface Identificacion {
    pin: string;
    id: string;
    secreto: string;
}

/** Dónde se guarda la identidad. En esta fase, sessionStorage (una por pestaña). */
export interface AlmacenIdentidad {
    leer(): Identificacion | null;
    guardar(identificacion: Identificacion): void;
    borrar(): void;
}

export type Conexion =
    /** Aún no ha elegido sala. */
    | 'sin-sala'
    /** Esperando la primera respuesta del profesor. */
    | 'conectando'
    | 'conectado'
    /** El profesor no contesta (PIN equivocado o su pantalla cerrada). Se sigue intentando. */
    | 'sin-respuesta';

export interface EstadoCliente {
    conexion: Conexion;
    pin: string | null;
    comun: VistaComun | null;
    personal: VistaJugador | null;
    /** Reloj local al recibir `comun` (para la cuenta atrás). */
    recibidaEn: number;
    /** Respuesta enviada a la pregunta abierta, a la espera de que la confirme el profesor. */
    elegida: { indice: number; opcion: number } | null;
}

export interface OpcionesCliente {
    transporte: Transporte;
    almacen: AlmacenIdentidad;
    reloj?: () => number;
    /** Clave aleatoria para el secreto (el id sale de él). */
    nuevaClave?: () => string;
    /** Cada cuánto se repite el saludo mientras el profesor no contesta. */
    reintentoMs?: number;
    /** Tras cuánto se avisa de que el profesor no contesta. */
    avisoMs?: number;
}

export interface Cliente {
    estado(): EstadoCliente;
    suscribir(fn: () => void): () => void;
    /** Vuelve a la sala guardada, si la hay (al cargar la página). */
    reanudar(): Promise<boolean>;
    entrar(pin: string, nombre: string): Promise<void>;
    responder(opcion: number): void;
    /** Olvida la identidad y deja la sala. */
    salir(): void;
    detener(): void;
}

export function claveAleatoria(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

const INICIAL: EstadoCliente = { conexion: 'sin-sala', pin: null, comun: null, personal: null, recibidaEn: 0, elegida: null };

export function crearCliente({
    transporte, almacen, reloj = () => performance.now(), nuevaClave = claveAleatoria, reintentoMs = 1500, avisoMs = 4000,
}: OpcionesCliente): Cliente {
    let estado: EstadoCliente = INICIAL;
    let yo: Identificacion | null = null;
    let saludo: (() => void) | null = null;
    let temporizador: ReturnType<typeof setInterval> | null = null;
    let conectadoDesde = 0;
    let dejarDeEscuchar: (() => void) | null = null;
    const oyentes = new Set<() => void>();
    /** Sube con cada `detener`: una conexión que termina después ya no vale. */
    let generacion = 0;

    const cambiar = (parcial: Partial<EstadoCliente>) => {
        estado = { ...estado, ...parcial };
        for (const fn of oyentes) fn();
    };

    const pararReintentos = () => {
        if (temporizador) clearInterval(temporizador);
        temporizador = null;
    };

    /** Envía el saludo ahora y lo repite hasta que el profesor conteste. */
    const saludarHastaRespuesta = () => {
        pararReintentos();
        conectadoDesde = reloj();
        saludo?.();
        temporizador = setInterval(() => {
            if (estado.conexion === 'conectando' && reloj() - conectadoDesde >= avisoMs) cambiar({ conexion: 'sin-respuesta' });
            saludo?.();
        }, reintentoMs);
    };

    const recibir = (datos: unknown) => {
        const m = leerMensajeProfesor(datos);
        if (!m) return;
        if (m.tipo === 'comun') {
            const v = m.vista;
            // La respuesta pendiente solo vale para la pregunta en la que se dio.
            const sigue = estado.elegida && v.fase === 'pregunta' && v.indice === estado.elegida.indice;
            cambiar({ comun: v, recibidaEn: reloj(), elegida: sigue ? estado.elegida : null });
            return;
        }
        pararReintentos();
        const v = m.vista;
        let elegida = estado.elegida;
        // El profesor no tiene nuestra respuesta (p. ej. recargó justo entonces): se puede volver a responder.
        if (v.estado === 'dentro' && elegida && v.respondida === null && estado.comun?.fase === 'pregunta') elegida = null;
        if (v.estado === 'dentro' && v.respondida) elegida = null;
        cambiar({ personal: v, conexion: 'conectado', elegida });
    };

    const detener = () => {
        generacion++;
        pararReintentos();
        dejarDeEscuchar?.();
        dejarDeEscuchar = null;
        transporte.desconectar();
        yo = null;
        saludo = null;
    };

    /** Conecta a la sala; `false` si mientras tanto se ha detenido el cliente. */
    const conectar = async (identificacion: Identificacion) => {
        const mia = generacion;
        dejarDeEscuchar?.();
        await transporte.conectar(identificacion.pin, { rol: 'jugador', id: identificacion.id, secreto: identificacion.secreto });
        if (mia !== generacion) { transporte.desconectar(); return false; }
        yo = identificacion;
        dejarDeEscuchar = transporte.alRecibir(recibir);
        cambiar({ ...INICIAL, conexion: 'conectando', pin: identificacion.pin });
        return true;
    };

    return {
        estado: () => estado,
        suscribir(fn) {
            oyentes.add(fn);
            return () => oyentes.delete(fn);
        },

        async reanudar() {
            const guardada = almacen.leer();
            if (!guardada) return false;
            if (!await conectar(guardada)) return false;
            saludo = () => transporte.enviarAlProfesor({ tipo: 'hola', id: guardada.id, secreto: guardada.secreto });
            saludarHastaRespuesta();
            return true;
        },

        async entrar(pin, nombre) {
            const guardada = almacen.leer();
            let identificacion = guardada?.pin === pin ? guardada : null;
            if (!identificacion) {
                const secreto = nuevaClave();
                identificacion = { pin, id: await idDeSecreto(secreto), secreto };
            }
            almacen.guardar(identificacion);
            if (!await conectar(identificacion)) return;
            const { id, secreto } = identificacion;
            saludo = () => transporte.enviarAlProfesor({ tipo: 'unirse', id, secreto, nombre });
            saludarHastaRespuesta();
        },

        responder(opcion) {
            const { comun, personal, elegida } = estado;
            if (!yo || comun?.fase !== 'pregunta' || personal?.estado !== 'dentro') return;
            if (elegida || personal.respondida?.indice === comun.indice) return;
            transporte.enviarAlProfesor({ tipo: 'responder', id: yo.id, secreto: yo.secreto, indice: comun.indice, opcion });
            cambiar({ elegida: { indice: comun.indice, opcion } });
        },

        salir() {
            almacen.borrar();
            detener();
            cambiar(INICIAL);
        },

        detener,
    };
}

/** Identidad en sessionStorage: sobrevive a recargar la pestaña, y cada pestaña tiene la suya. */
export function almacenSesion(almacen: Storage = sessionStorage, clave = 'aula-quiz:jugador'): AlmacenIdentidad {
    return {
        leer() {
            try {
                const d = JSON.parse(almacen.getItem(clave) ?? 'null');
                return d && typeof d.pin === 'string' && typeof d.id === 'string' && typeof d.secreto === 'string'
                    ? { pin: d.pin, id: d.id, secreto: d.secreto } : null;
            } catch {
                return null;
            }
        },
        guardar(i) {
            try { almacen.setItem(clave, JSON.stringify(i)); } catch { /* sin almacenamiento: no se podrá reanudar */ }
        },
        borrar() {
            try { almacen.removeItem(clave); } catch { /* nada que hacer */ }
        },
    };
}
