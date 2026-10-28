import type { EstadoPartida } from '../motor/estado';
import { BotonPrincipal, BotonSecundario, Logo } from '../ui/comunes';
import { Qr } from './Qr';

interface Props {
    estado: EstadoPartida;
    urlJugar: string;
    onEmpezar: () => void;
    onExpulsar: (id: string, nombre: string) => void;
    onCancelar: () => void;
}

/** Pantalla 1: sala de espera. */
export function Sala({ estado, urlJugar, onEmpezar, onExpulsar, onCancelar }: Props) {
    const { partida, pin, jugadores } = estado;
    const pinConEspacio = `${pin.slice(0, 3)} ${pin.slice(3)}`;
    const direccion = urlJugar.replace(/^https?:\/\//, '').replace(/#.*$/, '');

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-8">
            <header className="flex items-start justify-between gap-8">
                <Logo className="text-[56px]" />
                <div className="text-right">
                    <p className="text-[36px] font-extrabold leading-tight">{partida.mazo.titulo}</p>
                    <p className="cifras font-texto text-[24px] text-texto-2">
                        {partida.preguntas.length} preguntas · {partida.segundos} s por pregunta
                    </p>
                </div>
            </header>

            <section className="flex items-center justify-between gap-12 rounded-tarjeta bg-superficie px-16 py-10">
                <div className="flex flex-col gap-2">
                    <p className="font-texto text-[28px] text-texto-2">
                        Entra en <strong className="font-bold text-texto">{direccion}</strong> o escanea el código
                    </p>
                    <p className="font-texto text-[28px] text-texto-2">PIN de la sala</p>
                    <p className="cifras font-titulo text-[200px] font-extrabold leading-[0.95] tracking-tight text-acento"
                        aria-label={`PIN ${pin.split('').join(' ')}`}>
                        {pinConEspacio}
                    </p>
                    <p className="font-texto text-[24px] text-texto-2">Usa tu nombre de pila o un apodo.</p>
                </div>
                <Qr texto={urlJugar} tamano={340} etiqueta={`Código QR para entrar en la sala ${pin}`} />
            </section>

            <section className="flex min-h-0 flex-1 flex-col gap-4">
                <h2 className="cifras text-[32px] font-extrabold" aria-live="polite">
                    {jugadores.length === 0 ? 'Esperando jugadores…' : `${jugadores.length} ${jugadores.length === 1 ? 'jugador' : 'jugadores'}`}
                </h2>
                <ul className="flex min-h-0 flex-1 flex-wrap content-start gap-3 overflow-y-auto">
                    {jugadores.map(j => (
                        <li key={j.id} className="flex items-center gap-1 rounded-full bg-superficie-2 py-1 pl-6 pr-1 text-[26px] font-bold">
                            {j.nombre}
                            <button type="button" onClick={() => onExpulsar(j.id, j.nombre)} aria-label={`Expulsar a ${j.nombre}`}
                                title="Expulsar"
                                className="flex size-11 items-center justify-center rounded-full text-[26px] text-texto-2 hover:bg-borde hover:text-bajada focus-visible:outline-3 focus-visible:outline-acento">
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            <footer className="flex items-center justify-between gap-6">
                <BotonSecundario onClick={onCancelar} className="text-[24px]">Cancelar partida</BotonSecundario>
                <BotonPrincipal onClick={onEmpezar} disabled={jugadores.length === 0} className="min-h-[80px] px-16 text-[36px]">
                    Empezar
                </BotonPrincipal>
            </footer>
        </div>
    );
}
