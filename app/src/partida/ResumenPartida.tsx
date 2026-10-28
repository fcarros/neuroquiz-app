import { NOMBRE_DIFICULTAD, type PartidaPreparada } from './configuracion';

interface Props {
    partida: PartidaPreparada;
    onVolver: () => void;
    onOtraSeleccion: () => void;
    onAbrirSala: () => void;
}

const contar = (valores: string[]) => {
    const cuentas = new Map<string, number>();
    for (const v of valores) cuentas.set(v, (cuentas.get(v) ?? 0) + 1);
    return [...cuentas].sort((a, b) => b[1] - a[1]);
};

/**
 * Resumen de la partida creada. Se ve en el proyector, así que no muestra
 * las respuestas correctas.
 */
export function ResumenPartida({ partida, onVolver, onOtraSeleccion, onAbrirSala }: Props) {
    const { preguntas } = partida;
    const porCategoria = contar(preguntas.map(p => p.categoria));
    const porDificultad = contar(preguntas.map(p => (p.dificultad ? NOMBRE_DIFICULTAD[p.dificultad] : 'Sin indicar')));

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-8 rounded-tarjeta bg-superficie p-10">
            <div className="flex items-start justify-between gap-8">
                <div className="flex flex-col gap-2">
                    <p className="font-texto text-[22px] font-semibold uppercase tracking-wide text-correcto">Partida preparada</p>
                    <h2 className="text-[48px] font-extrabold leading-tight">{partida.mazo.titulo}</h2>
                    <p className="font-texto text-[24px] text-texto-2">{partida.mazo.modulo}</p>
                </div>
                <dl className="cifras grid grid-cols-3 gap-4 text-center">
                    <Dato valor={preguntas.length} etiqueta="preguntas" />
                    <Dato valor={`${partida.segundos} s`} etiqueta="por pregunta" />
                    <Dato valor={partida.mostrarExplicacion ? 'Sí' : 'No'} etiqueta="explicación" />
                </dl>
            </div>

            <div className="flex flex-wrap gap-8">
                <Reparto titulo="Por categoría" filas={porCategoria} />
                <Reparto titulo="Por dificultad" filas={porDificultad} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3">
                <h3 className="text-[24px] font-bold text-texto-2">Preguntas, en el orden en que saldrán</h3>
                <ol className="min-h-0 flex-1 overflow-y-auto rounded-3xl bg-superficie-2 p-6 font-texto text-[22px]">
                    {preguntas.map((p, i) => (
                        <li key={p.id} className="flex gap-4 border-b border-borde py-2 last:border-0">
                            <span className="cifras w-10 shrink-0 text-right font-titulo font-bold text-texto-2">{i + 1}</span>
                            <span className="flex-1">{p.enunciado}</span>
                            <span className="shrink-0 self-start whitespace-nowrap rounded-full bg-superficie px-3 text-texto-2">{p.categoria}</span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="flex items-center justify-between gap-6">
                <div className="flex gap-4">
                    <BotonSecundario onClick={onVolver}>Volver a configurar</BotonSecundario>
                    <BotonSecundario onClick={onOtraSeleccion}>Elegir otras preguntas</BotonSecundario>
                </div>
                <button type="button" onClick={onAbrirSala}
                    className="min-h-[72px] rounded-full bg-acento px-14 font-titulo text-[32px] font-extrabold text-sobre-acento hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acento">
                    Abrir sala
                </button>
            </div>
        </section>
    );
}

function Dato({ valor, etiqueta }: { valor: string | number; etiqueta: string }) {
    return (
        <div className="flex min-w-[170px] flex-col rounded-3xl bg-superficie-2 px-6 py-4">
            <dd className="font-titulo text-[48px] font-extrabold text-acento">{valor}</dd>
            <dt className="order-first font-texto text-[22px] text-texto-2">{etiqueta}</dt>
        </div>
    );
}

function Reparto({ titulo, filas }: { titulo: string; filas: [string, number][] }) {
    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-[24px] font-bold text-texto-2">{titulo}</h3>
            <ul className="flex flex-wrap gap-3">
                {filas.map(([nombre, n]) => (
                    <li key={nombre} className="cifras rounded-full bg-superficie-2 px-5 py-2 font-texto text-[22px]">
                        {nombre} <strong className="ml-1 font-titulo">{n}</strong>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function BotonSecundario({ onClick, children }: { onClick: () => void; children: string }) {
    return (
        <button type="button" onClick={onClick}
            className="min-h-[60px] rounded-full border-2 border-borde px-8 text-[24px] font-bold hover:border-texto-2 focus-visible:outline-3 focus-visible:outline-acento">
            {children}
        </button>
    );
}
