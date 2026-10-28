import type { EstadoPartida } from '../motor/estado';
import type { AccionProfesor } from '../profesor/arbitro';
import { Podio, Tabla } from './Podio';
import { Pregunta } from './Pregunta';
import { Respuesta } from './Respuesta';
import { Sala } from './Sala';

interface Props {
    estado: EstadoPartida;
    despachar: (accion: AccionProfesor) => void;
    urlJugar: string;
    /** Descarta la partida y vuelve a la configuración. */
    onSalir: () => void;
}

/** Lo que se ve en el proyector, con los controles del profesor. */
export function Proyector({ estado, despachar, urlJugar, onSalir }: Props) {
    const saltar = () => {
        if (confirm('¿Saltar esta pregunta? No contará para nadie.')) despachar({ tipo: 'saltar' });
    };
    const terminar = () => {
        if (confirm('¿Terminar la partida ahora? Se pasa directamente al podio.')) despachar({ tipo: 'terminar' });
    };
    const nueva = () => {
        if (confirm('¿Empezar una partida nueva? Esta se cerrará.')) onSalir();
    };

    return (
        <main className="mx-auto flex h-dvh max-w-[1920px] flex-col p-12">
            {estado.fase === 'sala' && (
                <Sala estado={estado} urlJugar={urlJugar}
                    onEmpezar={() => despachar({ tipo: 'empezar' })}
                    onExpulsar={(id, nombre) => { if (confirm(`¿Expulsar a ${nombre}?`)) despachar({ tipo: 'expulsar', id }); }}
                    onCancelar={() => { if (confirm('¿Cancelar la partida y volver a la configuración?')) onSalir(); }} />
            )}
            {estado.fase === 'pregunta' && <Pregunta key={estado.indice} estado={estado} onSaltar={saltar} onTerminar={terminar} />}
            {estado.fase === 'respuesta' && (
                <Respuesta estado={estado} onSiguiente={() => despachar({ tipo: 'siguiente' })} onTerminar={terminar} />
            )}
            {estado.fase === 'podio' && (
                <Podio estado={estado} onVerTabla={() => despachar({ tipo: 'verTabla' })} onNuevaPartida={nueva} />
            )}
            {estado.fase === 'tabla' && (
                <Tabla estado={estado} onVerPodio={() => despachar({ tipo: 'verPodio' })} onNuevaPartida={nueva} />
            )}
        </main>
    );
}
