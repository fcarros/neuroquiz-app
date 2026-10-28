import { useRef, type ReactNode } from 'react';
import type { EntradaMazo } from './biblioteca';
import type { Mensaje } from './useBiblioteca';

interface Props {
    entradas: EntradaMazo[];
    seleccionada: string | null;
    onSeleccionar: (clave: string) => void;
    onImportar: (archivo: File) => void;
    onExportar: (entrada: EntradaMazo) => void;
    onBorrar: (entrada: EntradaMazo) => void;
    mensaje: Mensaje | null;
    onCerrarMensaje: () => void;
    errorAlmacen: string | null;
}

const MAX_DETALLES = 6;

/** Mazos válidos agrupados por módulo, en orden alfabético. */
function agruparPorModulo(entradas: EntradaMazo[]): [string, EntradaMazo[]][] {
    const grupos = new Map<string, EntradaMazo[]>();
    for (const e of entradas) {
        const modulo = e.validacion.mazo?.modulo ?? '';
        grupos.set(modulo, [...(grupos.get(modulo) ?? []), e]);
    }
    return [...grupos].sort(([a], [b]) => a.localeCompare(b, 'es'));
}

export function PanelMazos(props: Props) {
    const entradaArchivo = useRef<HTMLInputElement>(null);
    const validas = props.entradas.filter(e => e.validacion.valido);
    const invalidas = props.entradas.filter(e => !e.validacion.valido);

    return (
        <section className="flex min-h-0 flex-col gap-6 rounded-tarjeta bg-superficie p-8">
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-[34px] font-extrabold">Mazo</h2>
                <button
                    type="button"
                    onClick={() => entradaArchivo.current?.click()}
                    className="rounded-full border-2 border-borde px-6 py-3 text-[22px] font-bold text-texto hover:border-acento focus-visible:outline-3 focus-visible:outline-acento"
                >
                    Importar mazo (.json)
                </button>
                <input
                    ref={entradaArchivo}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={e => {
                        const archivo = e.target.files?.[0];
                        e.target.value = '';
                        if (archivo) props.onImportar(archivo);
                    }}
                />
            </div>

            {props.errorAlmacen && <Aviso tipo="error" texto={props.errorAlmacen} />}
            {props.mensaje && (
                <Aviso {...props.mensaje} onCerrar={props.onCerrarMensaje} />
            )}

            <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-2">
                {agruparPorModulo(validas).map(([modulo, entradas]) => (
                    <div key={modulo} className="flex flex-col gap-3">
                        <h3 className="text-[22px] font-bold uppercase tracking-wide text-texto-2">{modulo}</h3>
                        {entradas.map(e => (
                            <TarjetaMazo
                                key={e.clave}
                                entrada={e}
                                activa={e.clave === props.seleccionada}
                                onSeleccionar={() => props.onSeleccionar(e.clave)}
                                onExportar={() => props.onExportar(e)}
                                onBorrar={() => props.onBorrar(e)}
                            />
                        ))}
                    </div>
                ))}

                {invalidas.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[22px] font-bold uppercase tracking-wide text-bajada">Mazos con errores</h3>
                        {invalidas.map(e => (
                            <div key={e.clave} className="flex flex-col gap-2 rounded-3xl border-2 border-bajada/60 bg-superficie-2 p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[24px] font-bold">{e.titulo}</span>
                                    {e.origen === 'importado' && (
                                        <BotonPequeno onClick={() => props.onBorrar(e)}>Borrar</BotonPequeno>
                                    )}
                                </div>
                                <ListaDetalles detalles={e.validacion.errores} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function TarjetaMazo({ entrada, activa, onSeleccionar, onExportar, onBorrar }: {
    entrada: EntradaMazo;
    activa: boolean;
    onSeleccionar: () => void;
    onExportar: () => void;
    onBorrar: () => void;
}) {
    const mazo = entrada.validacion.mazo!;
    return (
        <div className={`flex items-center gap-4 rounded-3xl border-2 p-5 transition-colors ${activa ? 'border-acento bg-superficie-2' : 'border-borde bg-superficie-2/50 hover:border-texto-2'}`}>
            <button
                type="button"
                onClick={onSeleccionar}
                aria-pressed={activa}
                className="flex flex-1 flex-col items-start gap-1 text-left focus-visible:outline-3 focus-visible:outline-acento"
            >
                <span className="text-[26px] font-bold leading-tight">{mazo.titulo}</span>
                <span className="cifras font-texto text-[22px] text-texto-2">
                    {mazo.preguntas.length} preguntas
                    {entrada.origen === 'importado' && ' · importado'}
                </span>
            </button>
            {entrada.origen === 'importado' && (
                <div className="flex gap-2">
                    <BotonPequeno onClick={onExportar}>Exportar</BotonPequeno>
                    <BotonPequeno onClick={onBorrar}>Borrar</BotonPequeno>
                </div>
            )}
            {activa && <span aria-hidden className="text-[30px] text-acento">✓</span>}
        </div>
    );
}

function BotonPequeno({ onClick, children }: { onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-full bg-superficie px-4 py-2 font-texto text-[22px] font-semibold text-texto-2 hover:text-texto focus-visible:outline-3 focus-visible:outline-acento"
        >
            {children}
        </button>
    );
}

function Aviso({ tipo, texto, detalles, onCerrar }: Mensaje & { onCerrar?: () => void }) {
    return (
        <div
            role={tipo === 'error' ? 'alert' : 'status'}
            className={`flex flex-col gap-2 rounded-3xl p-5 font-texto text-[22px] ${tipo === 'error' ? 'bg-bajada/15 text-bajada' : 'bg-correcto-fondo text-correcto'}`}
        >
            <div className="flex items-start justify-between gap-4">
                <p>{texto}</p>
                {onCerrar && (
                    <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="text-[26px] leading-none opacity-80 hover:opacity-100">×</button>
                )}
            </div>
            {detalles && detalles.length > 0 && <ListaDetalles detalles={detalles} />}
        </div>
    );
}

function ListaDetalles({ detalles }: { detalles: string[] }) {
    const visibles = detalles.slice(0, MAX_DETALLES);
    return (
        <ul className="list-disc pl-6 font-texto text-[22px] text-texto-2">
            {visibles.map(d => <li key={d}>{d}</li>)}
            {detalles.length > MAX_DETALLES && <li>… y {detalles.length - MAX_DETALLES} más.</li>}
        </ul>
    );
}
