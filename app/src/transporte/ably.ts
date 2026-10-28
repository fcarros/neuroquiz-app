import { CLIENTE_PROFESOR, canalJugador, canalProfesor, canalTodos } from './canales';
import { crearLimitador, type Limitador } from './limitador';
import type { MensajeProfesor } from './mensajes';
import type { EstadoRed, Identidad, Transporte } from './transporte';

/**
 * Transporte con Ably. Cada sala usa tres tipos de canal (ver `canales.ts`):
 * `todos` (profesor → móviles), `profesor` (móviles → profesor) y uno por
 * jugador (profesor → ese móvil). Las credenciales las firma la función
 * `api/ably-token` con permisos mínimos por rol; la clave nunca llega aquí.
 *
 * Además de lo que ya impide Ably con los permisos, se descarta todo mensaje
 * cuyo remitente (`clientId`, que pone Ably y no se puede falsificar) no
 * cuadre: el profesor solo acepta de un jugador lo que lleva su propio id.
 *
 * Los envíos del profesor pasan por un limitador (25 por segundo, la mitad
 * del límite del plan gratuito) que, si hay uno pendiente para el mismo
 * destino y tipo, lo sustituye por el nuevo.
 */

/** Lo mínimo de Ably que se usa; en los tests se sustituye por un doble. */
export interface MensajeAbly { clientId?: string; data?: unknown }
export interface CanalAbly {
    subscribe(fn: (m: MensajeAbly) => void): Promise<unknown>;
    publish(nombre: string, datos: unknown): Promise<unknown>;
    unsubscribe(): void;
}
export interface ClienteAbly {
    canal(nombre: string, modo: 'publicar' | 'escuchar'): CanalAbly;
    estado(): string;
    alCambiarEstado(fn: (estado: string) => void): void;
    cerrar(): void;
}
export type PedirCredenciales = (cuerpo: object) => Promise<unknown>;
export type CrearClienteAbly = (credenciales: () => Promise<unknown>) => Promise<ClienteAbly>;

export interface OpcionesAbly {
    /** Llama a la función de credenciales. Por defecto, POST a /api/ably-token. */
    pedir?: PedirCredenciales;
    /** Crea la conexión. Por defecto, la librería oficial de Ably (se carga solo si se usa). */
    crearCliente?: CrearClienteAbly;
    /** Dónde se guarda la prueba de cada sala del profesor. */
    almacen?: Storage;
    porSegundo?: number;
}

export const CLAVE_PRUEBA = (pin: string) => `aula-quiz:sala:${pin}`;

/** Cuenta de mensajes, para medir el consumo. */
export interface Contadores { publicados: number; recibidos: number; descartados: number }

const pedirPorDefecto: PedirCredenciales = async cuerpo => {
    const r = await fetch('/api/ably-token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const datos: unknown = await r.json().catch(() => null);
    if (!r.ok) throw new Error((datos as { error?: string } | null)?.error ?? `Error ${r.status} al pedir credenciales`);
    return datos;
};

/** Conexión real con la librería de Ably. */
export const clienteAblyReal: CrearClienteAbly = async credenciales => {
    const Ably = await import('ably');
    let cerrando = false;
    // Ably también cierra la conexión al recargar o cerrar la página (lo que quede en cola se reenvía al volver).
    for (const evento of ['pagehide', 'beforeunload']) globalThis.addEventListener?.(evento, () => { cerrando = true; });
    const realtime = new Ably.Realtime({
        // Al cerrar a propósito (recargar, salir), Ably avisa de los envíos que quedaban en cola: no es un error.
        logHandler: (mensaje, nivel) => { if (!cerrando && nivel <= 1) console.error(mensaje); },
        authCallback: (_, listo) => {
            credenciales().then(t => listo(null, t as never), (e: unknown) => listo(String(e), null));
        },
        echoMessages: false,
    });
    return {
        canal(nombre, modo) {
            const c = realtime.channels.get(nombre, { modes: [modo === 'publicar' ? 'publish' : 'subscribe'] });
            return {
                subscribe: fn => c.subscribe(m => fn({ clientId: m.clientId, data: m.data })),
                publish: (n, d) => c.publish(n, d),
                unsubscribe: () => c.unsubscribe(),
            };
        },
        estado: () => realtime.connection.state,
        alCambiarEstado: fn => realtime.connection.on(cambio => fn(cambio.current)),
        cerrar: () => { cerrando = true; realtime.close(); },
    };
};

/** Estado de la conexión de Ably → lo que se enseña al usuario. */
export function estadoRedDeAbly(estado: string, yaConectado: boolean): EstadoRed {
    if (estado === 'connected') return 'conectado';
    if (estado === 'failed') return 'sin-conexion';
    return yaConectado ? 'reconectando' : 'conectando';
}

export function crearTransporteAbly({
    pedir = pedirPorDefecto, crearCliente = clienteAblyReal, almacen = globalThis.localStorage, porSegundo = 25,
}: OpcionesAbly = {}): Transporte & { contadores(): Contadores } {
    let cliente: ClienteAbly | null = null;
    let yo: Identidad | null = null;
    let sala: string | null = null;
    let red: EstadoRed = 'conectando';
    let yaConectado = false;
    let limitador: Limitador | null = null;
    const canales = new Map<string, CanalAbly>();
    const oyentes = new Set<(datos: unknown) => void>();
    const oyentesRed = new Set<(estado: EstadoRed) => void>();
    const cuenta: Contadores = { publicados: 0, recibidos: 0, descartados: 0 };

    const canal = (nombre: string, modo: 'publicar' | 'escuchar') => {
        let c = canales.get(nombre);
        if (!c) {
            c = cliente!.canal(nombre, modo);
            canales.set(nombre, c);
        }
        return c;
    };

    const publicar = (nombre: string, datos: unknown) => {
        cuenta.publicados++;
        // Si falla (sin conexión, sin permiso…), el reintento lo hace la capa de arriba: saludos y resincronización.
        canal(nombre, 'publicar').publish('m', datos).catch(() => {});
    };

    const exigir = (rol: Identidad['rol']) => {
        if (!cliente || !sala || yo?.rol !== rol) throw new Error(`Solo el ${rol} conectado puede enviar este mensaje.`);
        return sala;
    };

    const entregar = (datos: unknown) => {
        cuenta.recibidos++;
        for (const fn of oyentes) fn(datos);
    };

    const credenciales = (pin: string, identidad: Identidad) => async () => {
        if (identidad.rol === 'jugador') return pedir({ accion: 'jugador', pin, secreto: identidad.secreto });
        const prueba = leerPrueba(pin);
        if (!prueba) throw new Error('No hay prueba de profesor para esta sala.');
        return pedir({ accion: 'profesor', pin, ...prueba });
    };

    const leerPrueba = (pin: string): { caduca: number; prueba: string } | null => {
        try {
            const d = JSON.parse(almacen.getItem(CLAVE_PRUEBA(pin)) ?? 'null');
            return d && typeof d.caduca === 'number' && typeof d.prueba === 'string' ? { caduca: d.caduca, prueba: d.prueba } : null;
        } catch {
            return null;
        }
    };

    const cambiarRed = (estadoAbly: string) => {
        const nuevo = estadoRedDeAbly(estadoAbly, yaConectado);
        if (nuevo === 'conectado') yaConectado = true;
        if (nuevo === red) return;
        red = nuevo;
        for (const fn of oyentesRed) fn(red);
    };

    const desconectar = () => {
        limitador?.parar();
        limitador = null;
        for (const c of canales.values()) c.unsubscribe();
        canales.clear();
        cliente?.cerrar();
        cliente = null;
        sala = null;
        yo = null;
    };

    return {
        async crearSala() {
            const r = await pedir({ accion: 'crear-sala' }) as { pin?: unknown; caduca?: unknown; prueba?: unknown };
            if (typeof r?.pin !== 'string' || typeof r.caduca !== 'number' || typeof r.prueba !== 'string') {
                throw new Error('La función de credenciales no ha devuelto una sala.');
            }
            almacen.setItem(CLAVE_PRUEBA(r.pin), JSON.stringify({ caduca: r.caduca, prueba: r.prueba }));
            return r.pin;
        },

        async conectar(pin, identidad) {
            desconectar();
            if (identidad.rol === 'profesor' && !leerPrueba(pin)) throw new Error('Esta sala no se creó en este navegador.');
            sala = pin;
            yo = identidad;
            red = 'conectando';
            yaConectado = false;
            const nuevo = await crearCliente(credenciales(pin, identidad));
            if (sala !== pin || yo !== identidad) { nuevo.cerrar(); return; }
            cliente = nuevo;
            cliente.alCambiarEstado(cambiarRed);
            cambiarRed(cliente.estado());

            if (identidad.rol === 'profesor') {
                limitador = crearLimitador({ porSegundo });
                await canal(canalProfesor(pin), 'escuchar').subscribe(m => {
                    const datos = m.data as { id?: unknown } | null;
                    // Un jugador solo puede hablar en su nombre.
                    if (!m.clientId || typeof datos !== 'object' || datos === null || datos.id !== m.clientId) { cuenta.descartados++; return; }
                    entregar(datos);
                });
            } else {
                const delProfesor = (m: MensajeAbly) => {
                    if (m.clientId !== CLIENTE_PROFESOR) { cuenta.descartados++; return; }
                    entregar(m.data);
                };
                await Promise.all([
                    canal(canalTodos(pin), 'escuchar').subscribe(delProfesor),
                    canal(canalJugador(pin, identidad.id), 'escuchar').subscribe(delProfesor),
                ]);
            }
        },

        enviarATodos(mensaje: MensajeProfesor) {
            const pin = exigir('profesor');
            limitador!.enviar(`todos:${mensaje.tipo}`, () => publicar(canalTodos(pin), mensaje));
        },
        enviarAJugador(id, mensaje) {
            const pin = exigir('profesor');
            limitador!.enviar(`${id}:${mensaje.tipo}`, () => publicar(canalJugador(pin, id), mensaje));
        },
        enviarAlProfesor(mensaje) {
            const pin = exigir('jugador');
            publicar(canalProfesor(pin), mensaje);
        },
        alRecibir(fn) {
            oyentes.add(fn);
            return () => oyentes.delete(fn);
        },
        estadoRed: () => red,
        alCambiarRed(fn) {
            oyentesRed.add(fn);
            return () => oyentesRed.delete(fn);
        },
        desconectar,
        contadores: () => ({ ...cuenta }),
    };
}
