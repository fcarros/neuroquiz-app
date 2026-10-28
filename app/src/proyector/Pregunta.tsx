import type { ReactNode } from 'react';
import { limiteMs, type EstadoPartida } from '../motor/estado';
import { BotonSecundario, FONDO_OPCION, Letra, letra, useAhora } from '../ui/comunes';

interface Props {
    estado: EstadoPartida;
    onSaltar: () => void;
    onTerminar: () => void;
}

/** Cabecera común de pregunta y respuesta: «4 / 15» y categoría. */
export function CabeceraPregunta({ estado, children }: { estado: EstadoPartida; children?: ReactNode }) {
    const p = estado.partida.preguntas[estado.indice];
    return (
        <header className="flex items-center gap-4">
            <span className="cifras rounded-full bg-superficie-2 px-6 py-2 font-titulo text-[30px] font-extrabold">
                {estado.indice + 1} / {estado.partida.preguntas.length}
            </span>
            <span className="rounded-full bg-superficie-2 px-6 py-2 font-texto text-[26px] text-texto-2">{p.categoria}</span>
            <span className="ml-auto">{children}</span>
        </header>
    );
}

/** Pantalla 2: pregunta abierta. */
export function Pregunta({ estado, onSaltar, onTerminar }: Props) {
    const ahora = useAhora(100);
    const p = estado.partida.preguntas[estado.indice];
    const limite = limiteMs(estado);
    const restante = Math.max(0, estado.abiertaEn! + limite - ahora);
    const fraccion = restante / limite;
    const segundos = Math.ceil(restante / 1000);
    const respondidas = Object.keys(estado.respuestas[estado.indice]).length;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
            <CabeceraPregunta estado={estado}>
                <span className="cifras font-texto text-[28px] text-texto-2" aria-live="polite">
                    <strong className="font-titulo text-[36px] font-extrabold text-texto">{respondidas}</strong> de {estado.jugadores.length} han respondido
                </span>
            </CabeceraPregunta>

            <div className="h-4 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-label="Tiempo"
                aria-valuemin={0} aria-valuemax={estado.partida.segundos} aria-valuenow={segundos}>
                <div className="h-full rounded-full bg-acento transition-[width] duration-100 ease-linear" style={{ width: `${fraccion * 100}%` }} />
            </div>

            <div className="flex items-center gap-10">
                <Temporizador fraccion={fraccion} segundos={segundos} />
                <h1 className="flex-1 text-[64px] font-extrabold leading-[1.1]">{p.enunciado}</h1>
            </div>

            <ul className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-6" aria-label="Opciones">
                {p.opciones.map((texto, i) => (
                    <li key={i} className={`flex items-center gap-6 rounded-opcion px-8 py-4 text-sobre-opcion ${FONDO_OPCION[i]}`}>
                        <Letra opcion={i} className="size-[84px] text-[48px]" />
                        <span className="sr-only">Opción {letra(i)}: </span>
                        <span className="font-texto text-[38px] font-bold leading-tight">{texto}</span>
                    </li>
                ))}
            </ul>

            <footer className="flex justify-end gap-4">
                <BotonSecundario onClick={onSaltar} className="text-[24px]">Saltar pregunta</BotonSecundario>
                <BotonSecundario onClick={onTerminar} className="text-[24px]">Terminar</BotonSecundario>
            </footer>
        </div>
    );
}

function Temporizador({ fraccion, segundos }: { fraccion: number; segundos: number }) {
    const r = 70;
    const circunferencia = 2 * Math.PI * r;
    return (
        <div className="relative size-[170px] shrink-0" aria-hidden="true">
            <svg viewBox="0 0 170 170" className="size-full -rotate-90">
                <circle cx="85" cy="85" r={r} fill="none" stroke="var(--color-superficie-2)" strokeWidth="14" />
                <circle cx="85" cy="85" r={r} fill="none" stroke={segundos <= 5 ? 'var(--color-bajada)' : 'var(--color-acento)'}
                    strokeWidth="14" strokeLinecap="round" strokeDasharray={circunferencia}
                    strokeDashoffset={circunferencia * (1 - fraccion)} />
            </svg>
            <span className="cifras absolute inset-0 flex items-center justify-center font-titulo text-[72px] font-extrabold">
                {segundos}
            </span>
        </div>
    );
}
