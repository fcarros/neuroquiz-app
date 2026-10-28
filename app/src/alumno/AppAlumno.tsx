import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { MAX_NOMBRE } from '../motor/estado';
import type { VistaComun, VistaJugador } from '../motor/vistas';
import { crearTransporte, tipoTransporte } from '../transporte/elegir';
import { AvisoRed, BotonPrincipal, BotonSecundario, FONDO_OPCION, Letra, Logo, letra, puntos, segundosConComa, useAhora } from '../ui/comunes';
import { almacenIdentidades, crearCliente, type Cliente, type EstadoCliente } from './cliente';

type Dentro = Extract<VistaJugador, { estado: 'dentro' }>;
const relojLocal = () => performance.now();

/** La pestaña del alumno (el móvil). `pinRuta` viene del QR: #/jugar/123456. */
export function AppAlumno({ pinRuta }: { pinRuta: string | null }) {
    // Con Ably, localStorage: algunos móviles cierran la pestaña al cambiar de aplicación.
    // En local, sessionStorage: cada pestaña del navegador es un alumno distinto.
    const [cliente] = useState(() => crearCliente({
        transporte: crearTransporte(),
        almacen: almacenIdentidades(tipoTransporte() === 'ably' ? localStorage : sessionStorage),
    }));
    const e = useSyncExternalStore(cliente.suscribir, cliente.estado);

    useEffect(() => {
        void cliente.reanudar(pinRuta ?? undefined);
        return () => cliente.detener();
    }, [cliente, pinRuta]);

    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-5 p-5">
            {e.conexion !== 'sin-sala' && <AvisoRed red={e.red} />}
            <Contenido e={e} cliente={cliente} pinRuta={pinRuta} />
        </main>
    );
}

function Contenido({ e, cliente, pinRuta }: { e: EstadoCliente; cliente: Cliente; pinRuta: string | null }) {
    const { personal, comun } = e;
    const salir = () => cliente.salir();

    if (e.conexion === 'sin-sala' || personal?.estado === 'fuera') {
        return <Unirse pinInicial={e.pin ?? pinRuta ?? ''} onEntrar={(pin, nombre) => void cliente.entrar(pin, nombre)} />;
    }
    if (!personal) {
        return e.conexion === 'sin-respuesta' ? (
            <Aviso titulo="No encuentro la sala" boton={<BotonSecundario onClick={salir} className="w-full text-[20px]">Cambiar de PIN</BotonSecundario>}>
                Revisa el PIN <strong className="cifras">{e.pin}</strong>. Si es correcto, puede que la pantalla del
                profesor esté cerrada: seguimos intentándolo.
            </Aviso>
        ) : <Aviso titulo="Conectando…">Entrando en la sala <strong className="cifras">{e.pin}</strong>.</Aviso>;
    }
    if (personal.estado === 'expulsado') {
        return <Aviso titulo="Te han sacado de la sala">El profesor te ha quitado de esta partida.</Aviso>;
    }
    if (personal.estado === 'cerrada') {
        return (
            <Aviso titulo="Partida terminada" boton={<BotonPrincipal onClick={salir} className="w-full text-[22px]">Salir</BotonPrincipal>}>
                Esta partida ya ha acabado y no se puede entrar.
            </Aviso>
        );
    }
    if (!comun) return <Aviso titulo="Conectando…">Recibiendo la partida.</Aviso>;

    switch (comun.fase) {
        case 'sala':
            return (
                <Marco yo={personal}>
                    <Aviso titulo={`¡Estás dentro, ${personal.nombre}!`}>
                        En cuanto el profesor empiece «{comun.titulo}», verás aquí las opciones. Mira la pantalla.
                    </Aviso>
                </Marco>
            );
        case 'pregunta': {
            const elegida = personal.respondida?.indice === comun.indice ? personal.respondida.opcion
                : e.elegida?.indice === comun.indice ? e.elegida.opcion : null;
            return (
                <Marco yo={personal}>
                    <Responder comun={comun} recibidaEn={e.recibidaEn} elegida={elegida} confirmada={personal.respondida !== null}
                        onResponder={o => cliente.responder(o)} />
                </Marco>
            );
        }
        case 'respuesta':
            return (
                <Marco yo={personal}>
                    {personal.resultado?.indice === comun.indice
                        ? <Resultado comun={comun} yo={personal} />
                        : (
                            // Su resultado aún no ha llegado (el profesor reparte los envíos) o se unió con la pregunta cerrada.
                            <Aviso titulo="Pregunta cerrada">
                                La correcta era la <strong className="font-titulo">{letra(comun.correcta)}</strong>: {comun.opciones[comun.correcta]}. Mira la pantalla.
                            </Aviso>
                        )}
                </Marco>
            );
        case 'final':
            return <Final yo={personal} titulo={comun.titulo} onSalir={salir} />;
    }
}

/** Cabecera con nombre y puntos. */
function Marco({ yo, children }: { yo: Dentro; children: ReactNode }) {
    return (
        <>
            <header className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-titulo text-[20px] font-extrabold">{yo.nombre}</span>
                <span className="cifras shrink-0 rounded-full bg-superficie-2 px-4 py-1 font-titulo text-[20px] font-extrabold text-acento">
                    {puntos(yo.puntos)} pts
                </span>
            </header>
            {children}
        </>
    );
}

function Aviso({ titulo, children, boton }: { titulo: string; children: ReactNode; boton?: ReactNode }) {
    return (
        <section className="flex flex-1 flex-col justify-center gap-4 py-8 text-center" aria-live="polite">
            <h1 className="text-[32px] font-extrabold leading-tight">{titulo}</h1>
            <p className="font-texto text-[18px] leading-snug text-texto-2">{children}</p>
            {boton && <div className="mt-4">{boton}</div>}
        </section>
    );
}

/** Pantalla 5: unirse. */
function Unirse({ pinInicial, onEntrar }: { pinInicial: string; onEntrar: (pin: string, nombre: string) => void }) {
    const [pin, setPin] = useState(pinInicial);
    const [nombre, setNombre] = useState('');
    const pinValido = /^\d{6}$/.test(pin);
    const nombreValido = nombre.trim().length > 0;

    const enviar = (ev: FormEvent) => {
        ev.preventDefault();
        if (pinValido && nombreValido) onEntrar(pin, nombre.trim());
    };

    const campo = 'min-h-[64px] w-full rounded-opcion-movil border-2 border-borde bg-superficie px-5 text-[24px] font-bold text-texto placeholder:text-texto-2/60 focus:border-acento focus:outline-none';
    return (
        <form onSubmit={enviar} className="flex flex-1 flex-col gap-6 pt-6">
            <Logo className="text-center text-[44px]" />
            <label className="flex flex-col gap-2">
                <span className="font-texto text-[18px] font-semibold text-texto-2">PIN de la sala</span>
                <input value={pin} onChange={ev => setPin(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" autoComplete="off" placeholder="123456" aria-describedby="ayuda-pin"
                    className={`${campo} cifras text-center font-titulo text-[36px] tracking-[0.2em]`} />
                <span id="ayuda-pin" className="font-texto text-[16px] text-texto-2">Lo ves en la pantalla del profesor.</span>
            </label>
            <label className="flex flex-col gap-2">
                <span className="font-texto text-[18px] font-semibold text-texto-2">Tu nombre</span>
                <input value={nombre} onChange={ev => setNombre(ev.target.value.slice(0, MAX_NOMBRE))} maxLength={MAX_NOMBRE}
                    autoComplete="given-name" placeholder="Nombre o apodo" aria-describedby="ayuda-nombre" className={campo} />
                <span id="ayuda-nombre" className="font-texto text-[16px] text-texto-2">
                    Usa tu nombre de pila o un apodo (hasta {MAX_NOMBRE} letras). Se verá en el proyector.
                </span>
            </label>
            <button type="submit" disabled={!pinValido || !nombreValido}
                className="min-h-[64px] rounded-full bg-acento font-titulo text-[24px] font-extrabold text-sobre-acento disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acento">
                Entrar
            </button>
            <p className="font-texto text-[16px] leading-snug text-texto-2">
                Si se recarga la página, vuelves a entrar solo y con tus puntos.
            </p>
        </form>
    );
}

/** Pantalla 6: responder. */
function Responder({ comun, recibidaEn, elegida, confirmada, onResponder }: {
    comun: Extract<VistaComun, { fase: 'pregunta' }>; recibidaEn: number; elegida: number | null; confirmada: boolean;
    onResponder: (opcion: number) => void;
}) {
    const ahora = useAhora(200, relojLocal);
    const restante = Math.max(0, comun.restanteMs - (ahora - recibidaEn));
    const agotado = restante === 0;
    const bloqueado = elegida !== null || agotado;

    return (
        <section className="flex flex-1 flex-col gap-4">
            <div className="flex items-baseline justify-between font-texto text-[16px] text-texto-2">
                <span className="cifras">Pregunta {comun.indice + 1} de {comun.total}</span>
                <span className="cifras font-titulo text-[22px] font-extrabold text-texto">{Math.ceil(restante / 1000)} s</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-superficie-2" aria-hidden="true">
                <div className="h-full rounded-full bg-acento" style={{ width: `${(restante / (comun.segundos * 1000)) * 100}%` }} />
            </div>
            <h1 className="text-[21px] font-bold leading-snug">{comun.enunciado}</h1>
            <p className="min-h-[24px] text-center font-texto text-[16px] text-texto-2" aria-live="polite">
                {elegida !== null
                    ? (confirmada ? `Respuesta ${letra(elegida)} recibida. Mira la pantalla.` : `Enviando la ${letra(elegida)}…`)
                    : agotado ? 'Se acabó el tiempo.' : ''}
            </p>
            <div className="mt-auto grid min-h-[50dvh] grid-rows-4 gap-3">
                {comun.opciones.map((texto, i) => (
                    <button key={i} type="button" disabled={bloqueado} onClick={() => onResponder(i)}
                        aria-pressed={elegida === i}
                        className={`flex min-h-[60px] items-center gap-4 rounded-opcion-movil px-4 py-2 text-left text-sobre-opcion ${FONDO_OPCION[i]} ${bloqueado && elegida !== i ? 'opacity-30' : ''} ${elegida === i ? 'ring-4 ring-texto ring-offset-2 ring-offset-fondo' : ''} focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-texto`}>
                        <Letra opcion={i} className="size-12 text-[26px]" />
                        <span className="font-texto text-[18px] font-bold leading-tight">{texto}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

/** Pantalla 7: resultado de la pregunta. */
function Resultado({ comun, yo }: { comun: Extract<VistaComun, { fase: 'respuesta' }>; yo: Dentro }) {
    const r = yo.resultado!;
    const titulo = r.acierto ? '¡Correcto!' : r.opcion === null ? 'Sin respuesta' : 'Incorrecto';
    return (
        <section className="flex flex-1 flex-col gap-5" aria-live="polite">
            <div className={`flex flex-col items-center gap-2 rounded-tarjeta px-6 py-8 text-center ${r.acierto ? 'bg-correcto-fondo' : 'bg-superficie'}`}>
                <h1 className={`text-[40px] font-extrabold ${r.acierto ? 'text-correcto' : 'text-bajada'}`}>{titulo}</h1>
                <p className="cifras font-titulo text-[48px] font-extrabold text-acento">+{puntos(r.puntos)}</p>
                <p className="cifras font-texto text-[18px] text-texto-2">
                    {r.ms !== null ? `En ${segundosConComa(r.ms)} s` : 'No llegaste a responder'}
                    {' · '}Racha: {yo.racha}
                </p>
            </div>
            <p className="font-texto text-[18px] leading-snug">
                La correcta era la <strong className="font-titulo">{letra(comun.correcta)}</strong>: {comun.opciones[comun.correcta]}
            </p>
            <div className="cifras flex items-baseline justify-between rounded-2xl bg-superficie-2 px-5 py-4">
                <span className="font-texto text-[18px]">Vas <strong className="font-titulo text-[28px]">{yo.puesto}.º</strong> de {yo.jugadores}</span>
                <span className="font-titulo text-[22px] font-extrabold text-acento">{puntos(yo.puntos)} pts</span>
            </div>
            <p className="mt-auto text-center font-titulo text-[22px] font-extrabold text-texto-2">Mira la pantalla</p>
        </section>
    );
}

/** Final con su puesto. */
function Final({ yo, titulo, onSalir }: { yo: Dentro; titulo: string; onSalir: () => void }) {
    return (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center" aria-live="polite">
            <p className="font-texto text-[18px] text-texto-2">«{titulo}» ha terminado</p>
            <h1 className="text-[28px] font-extrabold">{yo.nombre}, has quedado</h1>
            <p className="cifras font-titulo text-[96px] font-extrabold leading-none text-acento">{yo.puesto}.º</p>
            <p className="cifras font-texto text-[20px]">de {yo.jugadores} · {puntos(yo.puntos)} puntos · {yo.aciertos} aciertos</p>
            <BotonSecundario onClick={onSalir} className="mt-8 w-full text-[20px]">Salir</BotonSecundario>
        </section>
    );
}
