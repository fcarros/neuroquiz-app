import { useEffect, useState, type ReactNode } from 'react';
import { LETRAS } from '../partida/configuracion';

/** Clases de cada opción (literales para que Tailwind las encuentre). */
export const FONDO_OPCION = ['bg-opcion-a', 'bg-opcion-b', 'bg-opcion-c', 'bg-opcion-d'] as const;
export const letra = (opcion: number) => LETRAS[opcion];

/** Reloj que se refresca cada `cadaMs` (para cuentas atrás). */
export function useAhora(cadaMs = 100, reloj: () => number = Date.now): number {
    const [ahora, setAhora] = useState(reloj);
    useEffect(() => {
        const t = setInterval(() => setAhora(reloj()), cadaMs);
        return () => clearInterval(t);
    }, [cadaMs, reloj]);
    return ahora;
}

export const puntos = (n: number) => n.toLocaleString('es-ES');
export const segundosConComa = (ms: number) => (ms / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface PropsBoton {
    onClick: () => void;
    children: ReactNode;
    disabled?: boolean;
    className?: string;
}

const FOCO = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acento';

export function BotonPrincipal({ onClick, children, disabled, className = '' }: PropsBoton) {
    return (
        <button type="button" onClick={onClick} disabled={disabled}
            className={`min-h-[60px] rounded-full bg-acento px-10 font-titulo font-extrabold text-sobre-acento hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO} ${className}`}>
            {children}
        </button>
    );
}

export function BotonSecundario({ onClick, children, disabled, className = '' }: PropsBoton) {
    return (
        <button type="button" onClick={onClick} disabled={disabled}
            className={`min-h-[60px] rounded-full border-2 border-borde px-8 font-titulo font-bold hover:border-texto-2 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO} ${className}`}>
            {children}
        </button>
    );
}

/** Insignia redonda con la letra de la opción. */
export function Letra({ opcion, className = '' }: { opcion: number; className?: string }) {
    return (
        <span aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-full bg-sobre-opcion/15 font-titulo font-extrabold text-sobre-opcion ${className}`}>
            {letra(opcion)}
        </span>
    );
}

/** Logotipo en texto. */
export function Logo({ className = '' }: { className?: string }) {
    return (
        <span className={`font-titulo font-extrabold leading-none ${className}`}>
            Aula <span className="text-acento">Quiz</span>
        </span>
    );
}
