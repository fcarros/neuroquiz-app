import { clasificacion, estadisticas, preguntasJugadas, tablaCsv, type Marcador } from '../motor/calculos';
import type { EstadoPartida } from '../motor/estado';
import { BotonPrincipal, BotonSecundario, Logo, puntos } from '../ui/comunes';

interface Props {
    estado: EstadoPartida;
    onNuevaPartida: () => void;
}

const ALTURA = { 1: 'h-[300px]', 2: 'h-[220px]', 3: 'h-[160px]' } as const;
const porcentaje = (x: number) => `${Math.round(x * 100)} %`;

/** Pantalla 4: podio 2-1-3 y tres datos de la clase. */
export function Podio({ estado, onVerTabla, onNuevaPartida }: Props & { onVerTabla: () => void }) {
    const tabla = clasificacion(estado);
    const datos = estadisticas(estado);
    // Orden visual 2-1-3; el escalón lo marca la posición en la tabla (los empates comparten puesto).
    const escalones = ([[tabla[1], 2], [tabla[0], 1], [tabla[2], 3]] as const).filter(([m]) => m);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-8">
            <header className="flex items-baseline justify-between">
                <Logo className="text-[48px]" />
                <p className="font-texto text-[26px] text-texto-2">{estado.partida.mazo.titulo}</p>
            </header>

            <div className="flex min-h-0 flex-1 items-end justify-center gap-8">
                {escalones.map(([m, posicion]) => <Escalon key={m!.id} m={m!} posicion={posicion} />)}
                {tabla.length === 0 && <p className="self-center font-texto text-[28px] text-texto-2">Nadie ha jugado esta partida.</p>}
            </div>

            <dl className="grid grid-cols-3 gap-6">
                <Dato titulo="Aciertos de la clase" valor={datos.aciertoClase === null ? '—' : porcentaje(datos.aciertoClase)} />
                <Dato titulo="La que más costó"
                    valor={datos.masDificil ? `${porcentaje(datos.masDificil.acierto)} de aciertos` : '—'}
                    detalle={datos.masDificil ? `${datos.masDificil.indice + 1}. ${datos.masDificil.enunciado}` : undefined} />
                <Dato titulo="Mejor racha"
                    valor={datos.mejorRacha ? `${datos.mejorRacha.valor} seguidas` : '—'}
                    detalle={datos.mejorRacha?.nombres.join(', ')} />
            </dl>

            <footer className="flex justify-end gap-4">
                <BotonSecundario onClick={onNuevaPartida} className="text-[24px]">Nueva partida</BotonSecundario>
                <BotonPrincipal onClick={onVerTabla} className="min-h-[72px] px-12 text-[30px]">Ver resultados de todos</BotonPrincipal>
            </footer>
        </div>
    );
}

function Escalon({ m, posicion }: { m: Marcador; posicion: 1 | 2 | 3 }) {
    const primero = posicion === 1;
    return (
        <div className="flex w-[420px] flex-col items-center gap-3">
            <p className={`max-w-full truncate font-titulo font-extrabold ${primero ? 'text-[56px]' : 'text-[42px]'}`}>{m.nombre}</p>
            <p className="cifras font-titulo text-[34px] font-extrabold text-acento">{puntos(m.puntos)}</p>
            <div className={`flex w-full items-start justify-center rounded-t-tarjeta pt-6 ${ALTURA[posicion]} ${primero ? 'bg-acento text-sobre-acento' : 'bg-superficie-2'}`}>
                <span className="cifras font-titulo text-[96px] font-extrabold leading-none">{m.puesto}</span>
            </div>
        </div>
    );
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-1 rounded-tarjeta bg-superficie px-8 py-6">
            <dt className="font-texto text-[24px] text-texto-2">{titulo}</dt>
            <dd className="cifras font-titulo text-[40px] font-extrabold leading-tight">{valor}</dd>
            {detalle && <dd className="line-clamp-2 font-texto text-[22px] text-texto-2">{detalle}</dd>}
        </div>
    );
}

/** Tabla final de todos, con descarga en CSV. */
export function Tabla({ estado, onVerPodio, onNuevaPartida }: Props & { onVerPodio: () => void }) {
    const tabla = clasificacion(estado);
    const jugadas = preguntasJugadas(estado).length;

    const descargar = () => {
        const blob = new Blob([tablaCsv(estado)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aula-quiz-${estado.partida.mazo.id}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
            <header className="flex items-baseline justify-between">
                <h1 className="text-[48px] font-extrabold">Resultados de todos</h1>
                <p className="cifras font-texto text-[26px] text-texto-2">
                    {tabla.length} jugadores · {jugadas} {jugadas === 1 ? 'pregunta' : 'preguntas'}
                </p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-tarjeta bg-superficie px-10 py-6">
                <table className="cifras w-full text-left text-[26px]">
                    <thead className="font-texto text-[22px] text-texto-2">
                        <tr>
                            <th className="py-2 font-semibold">Puesto</th>
                            <th className="py-2 font-semibold">Nombre</th>
                            <th className="py-2 text-right font-semibold">Puntos</th>
                            <th className="py-2 text-right font-semibold">Aciertos</th>
                            <th className="py-2 text-right font-semibold">Mejor racha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tabla.map(m => (
                            <tr key={m.id} className="border-t border-borde">
                                <td className="py-2 font-titulo font-extrabold text-texto-2">{m.puesto}</td>
                                <td className="py-2 font-bold">{m.nombre}</td>
                                <td className="py-2 text-right font-titulo font-extrabold text-acento">{puntos(m.puntos)}</td>
                                <td className="py-2 text-right">{m.aciertos} / {jugadas}</td>
                                <td className="py-2 text-right">{m.mejorRacha}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <footer className="flex justify-between gap-4">
                <BotonSecundario onClick={onVerPodio} className="text-[24px]">Volver al podio</BotonSecundario>
                <div className="flex gap-4">
                    <BotonSecundario onClick={onNuevaPartida} className="text-[24px]">Nueva partida</BotonSecundario>
                    <BotonPrincipal onClick={descargar} className="min-h-[72px] px-12 text-[30px]">Descargar CSV</BotonPrincipal>
                </div>
            </footer>
        </div>
    );
}
