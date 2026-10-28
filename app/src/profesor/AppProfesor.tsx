import { useState } from 'react';
import { crearEstado, type EstadoPartida, type Fase } from '../motor/estado';
import type { PartidaPreparada } from '../partida/configuracion';
import { Preparacion } from '../partida/Preparacion';
import { Proyector } from '../proyector/Proyector';
import { crearTransporte } from '../transporte/elegir';
import { BotonPrincipal, BotonSecundario, Logo } from '../ui/comunes';
import { borrarPartida, cargarPartida } from './persistencia';
import { useArbitro } from './useArbitro';

/** Dirección que abre el móvil (la del QR). Conserva `?transporte=` si lo hay. */
export const urlJugar = (pin: string) => `${location.origin}${location.pathname}${location.search}#/jugar/${pin}`;

type Pantalla =
    | { tipo: 'preparar' }
    | { tipo: 'recuperar'; guardada: EstadoPartida }
    | { tipo: 'jugar'; inicial: EstadoPartida };

/** La pestaña del profesor: preparar la partida y proyectarla. */
export function AppProfesor() {
    const [pantalla, setPantalla] = useState<Pantalla>(() => {
        const guardada = cargarPartida();
        return guardada ? { tipo: 'recuperar', guardada } : { tipo: 'preparar' };
    });

    const salir = () => {
        borrarPartida();
        setPantalla({ tipo: 'preparar' });
    };

    /** El PIN lo da el transporte: con Ably, la función de credenciales (que firma la prueba de profesor). */
    const abrirSala = async (partida: PartidaPreparada) => {
        try {
            const pin = await crearTransporte().crearSala();
            setPantalla({ tipo: 'jugar', inicial: crearEstado(partida, pin) });
        } catch (e) {
            alert(`No se ha podido abrir la sala. Comprueba la conexión a internet y vuelve a intentarlo.\n\n(${e instanceof Error ? e.message : String(e)})`);
        }
    };

    switch (pantalla.tipo) {
        case 'preparar':
            return <Preparacion onAbrirSala={p => void abrirSala(p)} />;
        case 'recuperar':
            return <Recuperar guardada={pantalla.guardada} onContinuar={() => setPantalla({ tipo: 'jugar', inicial: pantalla.guardada })} onDescartar={salir} />;
        case 'jugar':
            return <Partida key={pantalla.inicial.pin} inicial={pantalla.inicial} onSalir={salir} />;
    }
}

function Partida({ inicial, onSalir }: { inicial: EstadoPartida; onSalir: () => void }) {
    const { estado, despachar } = useArbitro(inicial);
    return <Proyector estado={estado} despachar={despachar} urlJugar={urlJugar(estado.pin)} onSalir={onSalir} />;
}

const NOMBRE_FASE: Record<Fase, string> = {
    sala: 'en la sala de espera',
    pregunta: 'con una pregunta abierta',
    respuesta: 'mostrando una respuesta',
    podio: 'terminada (podio)',
    tabla: 'terminada (resultados)',
};

function Recuperar({ guardada, onContinuar, onDescartar }: { guardada: EstadoPartida; onContinuar: () => void; onDescartar: () => void }) {
    const { partida, pin, jugadores, fase, indice } = guardada;
    return (
        <main className="mx-auto flex h-dvh max-w-[1920px] flex-col gap-10 p-12">
            <Logo className="text-[56px]" />
            <section className="flex max-w-[1100px] flex-col gap-6 rounded-tarjeta bg-superficie p-12">
                <h1 className="text-[48px] font-extrabold leading-tight">Hay una partida sin terminar</h1>
                <p className="cifras font-texto text-[28px] leading-snug text-texto-2">
                    «{partida.mazo.titulo}», PIN <strong className="text-texto">{pin}</strong>, {jugadores.length}{' '}
                    {jugadores.length === 1 ? 'jugador' : 'jugadores'}, {NOMBRE_FASE[fase]}
                    {indice >= 0 && fase !== 'podio' && fase !== 'tabla' ? ` (pregunta ${indice + 1} de ${partida.preguntas.length})` : ''}.
                </p>
                <p className="font-texto text-[24px] text-texto-2">
                    Si la continúas, los móviles que sigan abiertos vuelven solos con sus puntos.
                </p>
                <div className="flex gap-4">
                    <BotonPrincipal onClick={onContinuar} className="text-[30px]">Continuar partida</BotonPrincipal>
                    <BotonSecundario onClick={() => { if (confirm('¿Descartar la partida? Se perderán los resultados.')) onDescartar(); }}
                        className="text-[24px]">
                        Descartarla
                    </BotonSecundario>
                </div>
            </section>
        </main>
    );
}
