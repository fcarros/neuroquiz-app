import type { VistaComun, VistaJugador } from '../motor/vistas';
import { leerMensajeProfesor } from '../transporte/mensajes';
import { idDeSecreto } from '../transporte/canales';
import type { EstadoRed, Transporte } from '../transporte/transporte';

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

/** Dónde se guarda la identidad (ver `almacenIdentidades`). */
export interface AlmacenIdentidad {
    /** La de esa sala o, sin PIN, la de la última sala. */
    leer(pin?: string): Identificacion | null;
    guardar(identificacion: Identificacion): void;
    borrar(pin: string): void;
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
    /** Estado de la conexión, para el aviso «Reconectando…». */
    red: EstadoRed;
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
    /** Vuelve a la sala guardada (la de ese PIN o la última), si la hay. */
    reanudar(pin?: string): Promise<boolean>;
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

const INICIAL: EstadoCliente = { conexion: 'sin-sala', pin: null, comun: null, personal: null, recibidaEn: 0, elegida: null, red: 'conectado' };

export function crearCliente({
    transporte, almacen, reloj = () => performance.now(), nuevaClave = claveAleatoria, reintentoMs = 1500, avisoMs = 4000,
}: OpcionesCliente): Cliente {
    let estado: EstadoCliente = INICIAL;
    let yo: Identificacion | null = null;
    let saludo: (() => void) | null = null;
    let temporizador: ReturnType<typeof setInterval> | null = null;
    let conectadoDesde = 0;
    let dejarDeEscuchar: (() => void) | null = null;
    let dejarRed: (() => void) | null = null;
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
        const { comun } = estado;
        // El profesor no tiene nuestra respuesta (p. ej. recargó justo entonces): se la reenvía.
        // Si ya no la admite (fuera de tiempo), su vista no cambia y no se repite más.
        if (v.estado === 'dentro' && elegida && v.respondida === null && comun?.fase === 'pregunta' && comun.indice === elegida.indice && yo) {
            transporte.enviarAlProfesor({ tipo: 'responder', id: yo.id, secreto: yo.secreto, indice: elegida.indice, opcion: elegida.opcion });
        }
        if (v.estado === 'dentro' && v.respondida) elegida = null;
        cambiar({ personal: v, conexion: 'conectado', elegida });
    };

    const detener = () => {
        generacion++;
        pararReintentos();
        dejarDeEscuchar?.();
        dejarDeEscuchar = null;
        dejarRed?.();
        dejarRed = null;
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
        dejarRed?.();
        dejarRed = transporte.alCambiarRed(red => {
            const volvio = red === 'conectado' && estado.red !== 'conectado';
            cambiar({ red });
            // Al recuperar la conexión se vuelve a saludar: lo que se perdió, llega en la respuesta.
            if (volvio && saludo) saludarHastaRespuesta();
        });
        cambiar({ ...INICIAL, conexion: 'conectando', pin: identificacion.pin, red: transporte.estadoRed() });
        return true;
    };

    return {
        estado: () => estado,
        suscribir(fn) {
            oyentes.add(fn);
            return () => oyentes.delete(fn);
        },

        async reanudar(pin) {
            const guardada = almacen.leer(pin);
            if (!guardada) return false;
            if (!await conectar(guardada)) return false;
            saludo = () => transporte.enviarAlProfesor({ tipo: 'hola', id: guardada.id, secreto: guardada.secreto });
            saludarHastaRespuesta();
            return true;
        },

        async entrar(pin, nombre) {
            let identificacion = almacen.leer(pin);
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
            if (estado.pin) almacen.borrar(estado.pin);
            detener();
            cambiar(INICIAL);
        },

        detener,
    };
}

const DIAS_GUARDADA = 3 * 24 * 60 * 60 * 1000;

/**
 * Identidad del alumno, una por sala (`aula-quiz:jugador:PIN`), más un
 * apunte a la última sala para volver aunque se abra la dirección sin PIN.
 * Con Ably va en localStorage (sobrevive a cerrar la pestaña al cambiar de
 * aplicación); con el transporte local, en sessionStorage (cada pestaña es
 * un alumno). Las de más de 3 días se borran.
 */
export function almacenIdentidades(almacen: Storage, prefijo = 'aula-quiz:jugador'): AlmacenIdentidad {
    const ULTIMA = `${prefijo}:ultima`;
    const clave = (pin: string) => `${prefijo}:${pin}`;
    const leerEn = (k: string): (Identificacion & { guardada?: number }) | null => {
        try {
            const d = JSON.parse(almacen.getItem(k) ?? 'null');
            return d && typeof d.pin === 'string' && typeof d.id === 'string' && typeof d.secreto === 'string' ? d : null;
        } catch {
            return null;
        }
    };
    return {
        leer(pin) {
            try {
                const destino = pin ?? almacen.getItem(ULTIMA);
                const d = destino ? leerEn(clave(destino)) : null;
                return d ? { pin: d.pin, id: d.id, secreto: d.secreto } : null;
            } catch {
                return null;
            }
        },
        guardar(i) {
            try {
                const ahora = Date.now();
                for (let n = almacen.length - 1; n >= 0; n--) {
                    const k = almacen.key(n);
                    if (k && k.startsWith(`${prefijo}:`) && k !== ULTIMA && (leerEn(k)?.guardada ?? 0) < ahora - DIAS_GUARDADA) almacen.removeItem(k);
                }
                almacen.setItem(clave(i.pin), JSON.stringify({ ...i, guardada: ahora }));
                almacen.setItem(ULTIMA, i.pin);
            } catch { /* sin almacenamiento: no se podrá reanudar */ }
        },
        borrar(pin) {
            try {
                almacen.removeItem(clave(pin));
                if (almacen.getItem(ULTIMA) === pin) almacen.removeItem(ULTIMA);
            } catch { /* nada que hacer */ }
        },
    };
}
