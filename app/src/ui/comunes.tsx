import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LETRAS } from '../partida/configuracion';
import type { EstadoRed } from '../transporte/transporte';

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

const TEXTO_RED = { conectando: 'Conectando…', reconectando: 'Reconectando…', 'sin-conexion': 'Sin conexión. Reintentando…' } as const;

/** Aviso flotante mientras no hay conexión. `grande` para el proyector. */
export function AvisoRed({ red, grande = false }: { red: EstadoRed; grande?: boolean }) {
    if (red === 'conectado') return null;
    return (
        <div role="status" aria-live="assertive"
            className={`fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-bajada font-titulo font-extrabold text-sobre-opcion shadow-lg ${grande ? 'px-10 py-3 text-[30px]' : 'px-5 py-2 text-[18px]'}`}>
            {TEXTO_RED[red]}
        </div>
    );
}

// --- Proyector a cualquier tamaño ---

/** Tamaño de diseño del proyector. */
export const DISENO = { ancho: 1920, alto: 1080 };

const escucharVentana = (fn: () => void) => {
    addEventListener('resize', fn);
    return () => removeEventListener('resize', fn);
};
const tamanoVentana = () => `${innerWidth}x${innerHeight}`;

/**
 * Lienzo del proyector: se dibuja en un espacio lógico de al menos 1920×1080
 * (más ancho o más alto si la ventana tiene otra proporción) y se escala a la
 * ventana. Así cada pantalla se ve igual a 1280×720 que a 1920×1080, solo que
 * más pequeña; si algo no cabe, se desplaza dentro de su zona.
 */
export function Escenario({ children }: { children: ReactNode }) {
    const [ancho, alto] = useSyncExternalStore(escucharVentana, tamanoVentana).split('x').map(Number);
    const escala = Math.min(ancho / DISENO.ancho, alto / DISENO.alto);
    return (
        <div className="fixed inset-0 overflow-hidden bg-fondo">
            <div className="flex origin-top-left flex-col"
                style={{ width: ancho / escala, height: alto / escala, transform: `scale(${escala})` }}>
                {children}
            </div>
        </div>
    );
}

/**
 * Texto que se reduce (de `max` a `min` px) hasta caber en su caja, en vez de
 * desbordarse. El alto máximo lo pone quien lo usa en `className` (p. ej.
 * `max-h-full` dentro de una celda de rejilla o `max-h-[300px]`).
 */
export function TextoAjustable({ max, min, className = '', children }: { max: number; min: number; className?: string; children: ReactNode }) {
    const ref = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ajustar = () => {
            let t = max;
            el.style.fontSize = `${t}px`;
            while (t > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
                t -= 2;
                el.style.fontSize = `${t}px`;
            }
        };
        ajustar();
        // El espacio solo cambia al cambiar la ventana (el escenario se reescala).
        let marco = 0;
        const alCambiar = () => { cancelAnimationFrame(marco); marco = requestAnimationFrame(ajustar); };
        addEventListener('resize', alCambiar);
        return () => { removeEventListener('resize', alCambiar); cancelAnimationFrame(marco); };
    }, [max, min, children]);
    return <span ref={ref} className={`block min-h-0 overflow-hidden ${className}`}>{children}</span>;
}
