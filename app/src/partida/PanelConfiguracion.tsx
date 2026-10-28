import { useId, type ReactNode } from 'react';
import { contarPorColor, nombresCategorias, type Mazo } from '../mazo/mazo';
import type { ColorId } from '../mazo/colores';
import {
    NOMBRE_DIFICULTAD, SEGUNDOS, cantidadReal, opcionesCantidad, opcionesDificultad, preguntasConExplicacion,
    preguntasDisponibles, type Configuracion,
} from './configuracion';

interface Props {
    mazo: Mazo;
    config: Configuracion;
    /** Avisos de lo que se ha ajustado solo en el último cambio. */
    cambios: string[];
    onCambiar: (config: Configuracion) => void;
    onCrear: () => void;
}

export function PanelConfiguracion({ mazo, config, cambios, onCambiar, onCrear }: Props) {
    const nombres = nombresCategorias(mazo);
    const porColor = contarPorColor(mazo);
    const cantidades = opcionesCantidad(mazo, config.categorias);
    const dificultades = opcionesDificultad(mazo, config.categorias, config.cantidad);
    const conExplicacion = preguntasConExplicacion(mazo);
    const total = cantidadReal(config.cantidad, preguntasDisponibles(mazo, config.categorias, config.dificultad).length);
    const cambiar = (parcial: Partial<Configuracion>) => onCambiar({ ...config, ...parcial });

    const alternarCategoria = (color: ColorId) => {
        const activa = config.categorias.includes(color);
        if (activa && config.categorias.length === 1) return;
        cambiar({ categorias: activa ? config.categorias.filter(c => c !== color) : [...config.categorias, color] });
    };
    const todasLasCategorias = mazo.categorias.length === config.categorias.length;

    return (
        <section className="flex min-h-0 flex-col gap-7 rounded-tarjeta bg-superficie p-8">
            <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[34px] font-extrabold">Configurar partida</h2>
                <span className="font-texto text-[22px] text-texto-2">{mazo.titulo}</span>
            </div>

            {cambios.length > 0 && (
                <div role="status" className="rounded-3xl bg-acento/15 p-5 font-texto text-[22px] text-acento">
                    {cambios.map(c => <p key={c}>{c}</p>)}
                </div>
            )}

            <Grupo
                titulo="Categorías"
                accion={!todasLasCategorias && (
                    <button type="button" onClick={() => cambiar({ categorias: mazo.categorias.map(c => c.color) })}
                        className="font-texto text-[22px] font-semibold text-texto-2 underline-offset-4 hover:text-texto hover:underline">
                        Marcar todas
                    </button>
                )}
            >
                {mazo.categorias.map(({ color }) => {
                    const activa = config.categorias.includes(color);
                    const ultima = activa && config.categorias.length === 1;
                    return (
                        <Chip key={color} activo={activa} onClick={() => alternarCategoria(color)}
                            title={ultima ? 'Tiene que quedar al menos una categoría' : undefined}>
                            <span aria-hidden className="mr-2">{activa ? '✓' : '+'}</span>
                            {nombres[color]}
                            <Cuenta>{porColor[color]}</Cuenta>
                        </Chip>
                    );
                })}
            </Grupo>

            <Grupo titulo="Número de preguntas">
                {cantidades.map(o => (
                    <Chip key={String(o.valor)} activo={config.cantidad === o.valor} desactivado={!o.posible}
                        onClick={() => cambiar({ cantidad: o.valor })}
                        title={o.posible ? undefined : 'No hay tantas preguntas en las categorías elegidas'}>
                        {o.valor === 'todas' ? <>Todas <Cuenta>{o.preguntas}</Cuenta></> : o.valor}
                    </Chip>
                ))}
            </Grupo>

            <Grupo titulo="Dificultad">
                {dificultades.map(o => (
                    <Chip key={o.valor} activo={config.dificultad === o.valor} desactivado={!o.posible}
                        onClick={() => cambiar({ dificultad: o.valor })}
                        title={o.posible ? undefined : `Solo hay ${o.disponibles} preguntas de esta dificultad en las categorías elegidas`}>
                        {NOMBRE_DIFICULTAD[o.valor]}
                        <Cuenta>{o.disponibles}</Cuenta>
                    </Chip>
                ))}
            </Grupo>

            <div className="grid grid-cols-2 gap-7">
                <Grupo titulo="Segundos por pregunta">
                    {SEGUNDOS.map(s => (
                        <Chip key={s} activo={config.segundos === s} onClick={() => cambiar({ segundos: s })}>{s}</Chip>
                    ))}
                </Grupo>

                <Grupo titulo="Explicación tras cada pregunta"
                    nota={conExplicacion === 0 ? 'Este mazo no tiene explicaciones.'
                        : conExplicacion < mazo.preguntas.length ? `${conExplicacion} de ${mazo.preguntas.length} preguntas la tienen.` : undefined}>
                    <Chip activo={config.mostrarExplicacion} desactivado={conExplicacion === 0}
                        onClick={() => cambiar({ mostrarExplicacion: true })}>Mostrar</Chip>
                    <Chip activo={!config.mostrarExplicacion} onClick={() => cambiar({ mostrarExplicacion: false })}>No mostrar</Chip>
                </Grupo>
            </div>

            <div className="mt-auto flex items-center justify-between gap-6 border-t-2 border-borde pt-7">
                <p className="cifras font-texto text-[24px] text-texto-2">
                    <strong className="font-titulo text-[30px] text-texto">{total} preguntas</strong>
                    {' · '}{config.segundos} s cada una
                    {' · '}{todasLasCategorias ? 'todas las categorías' : `${config.categorias.length} de ${mazo.categorias.length} categorías`}
                </p>
                <button type="button" onClick={onCrear}
                    className="min-h-[72px] rounded-full bg-acento px-12 text-[30px] font-extrabold text-sobre-acento shadow-[0_8px_0_#b8861a] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-texto">
                    Crear partida
                </button>
            </div>
        </section>
    );
}

function Grupo({ titulo, accion, nota, children }: { titulo: string; accion?: ReactNode; nota?: string; children: ReactNode }) {
    const id = useId();
    return (
        <div role="group" aria-labelledby={id} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
                <h3 id={id} className="text-[24px] font-bold text-texto-2">{titulo}</h3>
                {accion}
            </div>
            <div className="flex flex-wrap gap-3">{children}</div>
            {nota && <p className="font-texto text-[22px] text-texto-2">{nota}</p>}
        </div>
    );
}

function Chip({ activo, desactivado = false, onClick, title, children }: {
    activo: boolean;
    desactivado?: boolean;
    onClick: () => void;
    title?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={activo}
            disabled={desactivado}
            onClick={onClick}
            title={title}
            className={[
                'cifras inline-flex min-h-[60px] items-center rounded-full border-2 px-6 text-[24px] font-bold transition-colors',
                'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acento',
                activo
                    ? 'border-acento bg-acento text-sobre-acento'
                    : 'border-borde bg-superficie-2 text-texto hover:border-texto-2',
                desactivado && 'cursor-not-allowed border-dashed opacity-35 hover:border-borde',
            ].filter(Boolean).join(' ')}
        >
            {children}
        </button>
    );
}

function Cuenta({ children }: { children: ReactNode }) {
    return <span className="ml-2 font-texto text-[22px] font-semibold opacity-70">{children}</span>;
}
