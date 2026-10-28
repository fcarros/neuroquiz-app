import { clasificacion, votos, type Marcador } from '../motor/calculos';
import type { EstadoPartida } from '../motor/estado';
import { BotonPrincipal, BotonSecundario, FONDO_OPCION, Letra, letra, puntos } from '../ui/comunes';
import { CabeceraPregunta } from './Pregunta';

interface Props {
    estado: EstadoPartida;
    onSiguiente: () => void;
    onTerminar: () => void;
}

/** Pantalla 3: respuesta con votos, «Por qué» y top 5. */
export function Respuesta({ estado, onSiguiente, onTerminar }: Props) {
    const p = estado.partida.preguntas[estado.indice];
    const v = votos(estado, estado.indice);
    const top = clasificacion(estado).slice(0, 5);
    const ultima = estado.indice === estado.partida.preguntas.length - 1;
    const explicacion = estado.partida.mostrarExplicacion ? p.explicacion : undefined;
    const respondidas = v.reduce((a, b) => a + b, 0);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5">
            <CabeceraPregunta estado={estado}>
                <span className="cifras font-texto text-[26px] text-texto-2">
                    {respondidas} de {estado.jugadores.length} respondieron
                </span>
            </CabeceraPregunta>

            <h1 className="text-[36px] font-bold leading-tight text-texto-2">{p.enunciado}</h1>

            <ul className="grid grid-cols-2 gap-4" aria-label="Respuestas">
                {p.opciones.map((texto, i) => {
                    const bien = i === p.correcta;
                    return (
                        <li key={i}
                            className={`relative flex items-center gap-5 rounded-opcion px-6 py-3 text-sobre-opcion ${FONDO_OPCION[i]} ${bien ? 'ring-[6px] ring-correcto ring-offset-4 ring-offset-fondo' : 'opacity-35'}`}>
                            <Letra opcion={i} className="size-[64px] text-[36px]" />
                            <span className="flex-1 font-texto text-[30px] font-bold leading-tight">
                                <span className="sr-only">Opción {letra(i)}{bien ? ', correcta' : ''}: </span>
                                {texto}
                            </span>
                            {bien && <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-fondo text-[36px] font-extrabold text-correcto">✓</span>}
                            <span className="cifras min-w-[3ch] text-right font-titulo text-[48px] font-extrabold" aria-label={`${v[i]} votos`}>{v[i]}</span>
                        </li>
                    );
                })}
            </ul>

            <div className="flex min-h-0 flex-1 gap-6">
                {explicacion ? (
                    <section className="flex min-w-0 flex-1 flex-col gap-3 self-start rounded-tarjeta border-2 border-correcto/40 bg-correcto-fondo px-10 py-7">
                        <h2 className="text-[30px] font-extrabold text-correcto">Por qué</h2>
                        <p className="font-texto text-[30px] leading-snug">{explicacion}</p>
                    </section>
                ) : <div className="flex-1" />}
                <Top5 marcadores={top} />
            </div>

            <footer className="flex items-center justify-end gap-4">
                <BotonSecundario onClick={onTerminar} className="text-[24px]">Terminar</BotonSecundario>
                <BotonPrincipal onClick={onSiguiente} className="min-h-[72px] px-14 text-[32px]">
                    {ultima ? 'Ver podio' : 'Siguiente'}
                </BotonPrincipal>
            </footer>
        </div>
    );
}

function Top5({ marcadores }: { marcadores: Marcador[] }) {
    return (
        <section className="flex w-[680px] shrink-0 flex-col gap-2 self-start rounded-tarjeta bg-superficie px-8 py-6">
            <h2 className="text-[28px] font-extrabold">Top 5</h2>
            <ol className="flex flex-col gap-2">
                {marcadores.map(m => (
                    <li key={m.id} className="cifras flex items-center gap-4 rounded-2xl bg-superficie-2 px-5 py-2 text-[28px]">
                        <span className="w-10 font-titulo font-extrabold text-texto-2">{m.puesto}</span>
                        <span className="min-w-0 flex-1 truncate font-bold">{m.nombre}</span>
                        <Cambio m={m} />
                        <span className="font-titulo font-extrabold text-acento">{puntos(m.puntos)}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

function Cambio({ m }: { m: Marcador }) {
    const d = m.puestoAnterior === null ? 0 : m.puestoAnterior - m.puesto;
    if (d > 0) return <span className="w-16 text-[22px] font-bold text-correcto" aria-label={`sube ${d}`}>▲{d}</span>;
    if (d < 0) return <span className="w-16 text-[22px] font-bold text-bajada" aria-label={`baja ${-d}`}>▼{-d}</span>;
    return <span className="w-16 text-[22px] text-texto-2" aria-label="igual">–</span>;
}
