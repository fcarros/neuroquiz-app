// Doble de Ably para los tests: un «servidor» en memoria que aplica los
// permisos de los TokenRequest que firma la función de credenciales (los de
// verdad), entrega los mensajes de forma asíncrona con el clientId del
// remitente y permite cortar y restablecer la conexión de un cliente.
import { atender, type Entorno } from '../api/_credenciales';
import type { ClienteAbly, CrearClienteAbly, MensajeAbly, PedirCredenciales } from '../src/transporte/ably';

export const ENTORNO_PRUEBA: Entorno = { claveAbly: 'appPrueba.claveId:secretoDePruebaNoReal', secretoSala: 'x'.repeat(48) };

/** La función de credenciales, llamada directamente (sin HTTP). */
export const pedirAFuncion = (entorno = ENTORNO_PRUEBA): PedirCredenciales => async cuerpo => {
    const r = await atender(cuerpo, entorno);
    if (r.estado !== 200) throw new Error(`Credenciales rechazadas (${r.estado})`);
    return r.cuerpo;
};

/** ¿El recurso de un permiso cubre este canal? Comodín por segmentos «:», como Ably. */
export function cubre(patron: string, canal: string): boolean {
    if (patron === '*') return true;
    const p = patron.split(':');
    const c = canal.split(':');
    for (let i = 0; i < p.length; i++) {
        if (p[i] === '*') {
            if (i === p.length - 1) return c.length > i;
            if (c[i] === undefined) return false;
            continue;
        }
        if (p[i] !== c[i]) return false;
    }
    return p.length === c.length;
}

interface Suscripcion { cliente: ClienteFalso; fn: (m: MensajeAbly) => void }
interface ClienteFalso { clientId: string; estado: string; avisar(estado: string): void }

export function crearAblyFalso({ retardoMs = 0 } = {}) {
    const canales = new Map<string, Set<Suscripcion>>();
    const clientes: ClienteFalso[] = [];
    const cuenta = { publicados: 0, entregados: 0, rechazados: 0 };

    const crearCliente: CrearClienteAbly = async credenciales => {
        const token = await credenciales() as { clientId: string; capability: string };
        const permisos = JSON.parse(token.capability) as Record<string, string[]>;
        const permite = (canal: string, op: string) =>
            Object.entries(permisos).some(([patron, ops]) => cubre(patron, canal) && (ops.includes(op) || ops.includes('*')));
        const oyentes: ((estado: string) => void)[] = [];
        const yo: ClienteFalso = {
            clientId: token.clientId,
            estado: 'connected',
            avisar(estado) { yo.estado = estado; oyentes.forEach(fn => fn(estado)); },
        };
        clientes.push(yo);

        const cliente: ClienteAbly = {
            canal(nombre) {
                return {
                    async subscribe(fn) {
                        if (!permite(nombre, 'subscribe')) { cuenta.rechazados++; throw new Error(`40160: sin permiso para escuchar ${nombre}`); }
                        if (!canales.has(nombre)) canales.set(nombre, new Set());
                        canales.get(nombre)!.add({ cliente: yo, fn });
                    },
                    async publish(_, datos) {
                        if (yo.estado !== 'connected') throw new Error('80003: desconectado');
                        if (!permite(nombre, 'publish')) { cuenta.rechazados++; throw new Error(`40160: sin permiso para publicar en ${nombre}`); }
                        cuenta.publicados++;
                        const copia = structuredClone(datos);
                        setTimeout(() => {
                            for (const s of canales.get(nombre) ?? []) {
                                // echoMessages: false, y a quien está desconectado no le llega (se pierde).
                                if (s.cliente === yo || s.cliente.estado !== 'connected') continue;
                                cuenta.entregados++;
                                s.fn({ clientId: yo.clientId, data: copia });
                            }
                        }, retardoMs);
                    },
                    unsubscribe() {
                        const subs = canales.get(nombre);
                        if (subs) for (const s of subs) if (s.cliente === yo) subs.delete(s);
                    },
                };
            },
            estado: () => yo.estado,
            alCambiarEstado: fn => { oyentes.push(fn); },
            cerrar() {
                yo.estado = 'closed';
                for (const subs of canales.values()) for (const s of subs) if (s.cliente === yo) subs.delete(s);
            },
        };
        return cliente;
    };

    const buscar = (clientId: string) => {
        const c = [...clientes].reverse().find(x => x.clientId === clientId && x.estado !== 'closed');
        if (!c) throw new Error(`No hay cliente ${clientId}`);
        return c;
    };

    return {
        crearCliente,
        cuenta,
        /** Corta la conexión de un cliente (los mensajes que le lleguen se pierden). */
        cortar: (clientId: string) => buscar(clientId).avisar('disconnected'),
        restablecer: (clientId: string) => buscar(clientId).avisar('connected'),
        suscriptores: (canal: string) => [...(canales.get(canal) ?? [])].map(s => s.cliente.clientId),
    };
}
