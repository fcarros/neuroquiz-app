import { useState } from 'react';
import { PanelMazos } from '../biblioteca/PanelMazos';
import { useBiblioteca } from '../biblioteca/useBiblioteca';
import { nuevaSemilla } from '../mazo/azar';
import { IDS_COLOR } from '../mazo/colores';
import {
    CONFIGURACION_INICIAL, ajustarConfiguracion, prepararPartida, type Configuracion, type PartidaPreparada,
} from './configuracion';
import { PanelConfiguracion } from './PanelConfiguracion';
import { ResumenPartida } from './ResumenPartida';

/** Elegir mazo, configurar y revisar la partida antes de abrir la sala. */
export function Preparacion({ onAbrirSala }: { onAbrirSala: (partida: PartidaPreparada) => void }) {
    const biblioteca = useBiblioteca();
    const validas = biblioteca.entradas.filter(e => e.validacion.valido);
    const [clave, setClave] = useState<string | null>(null);
    const [config, setConfig] = useState<Configuracion>(CONFIGURACION_INICIAL);
    const [cambios, setCambios] = useState<string[]>([]);
    const [partida, setPartida] = useState<PartidaPreparada | null>(null);

    // Si el mazo elegido desaparece (p. ej. se borra), se usa el primero válido.
    const entrada = validas.find(e => e.clave === clave) ?? validas[0] ?? null;
    const mazo = entrada?.validacion.mazo ?? null;
    // La configuración guardada puede venir de otro mazo: siempre se ajusta.
    const configActual = mazo ? ajustarConfiguracion(mazo, config).config : config;

    const aplicar = (nueva: Configuracion, mazoDestino = mazo) => {
        if (!mazoDestino) return;
        const ajuste = ajustarConfiguracion(mazoDestino, nueva);
        setConfig(ajuste.config);
        setCambios(ajuste.cambios);
    };

    const elegirMazo = (nuevaClave: string) => {
        const destino = validas.find(e => e.clave === nuevaClave)?.validacion.mazo;
        setClave(nuevaClave);
        if (destino) aplicar({ ...config, categorias: [...IDS_COLOR] }, destino);
    };

    const crear = () => {
        if (mazo) setPartida(prepararPartida(mazo, configActual, nuevaSemilla()));
    };

    return (
        <main className="mx-auto flex h-full w-full max-w-[1920px] flex-col gap-8 p-12">
            <header className="flex items-baseline gap-6">
                <h1 className="text-[56px] font-extrabold leading-none">
                    Aula <span className="text-acento">Quiz</span>
                </h1>
                <p className="font-texto text-[24px] text-texto-2">
                    {partida ? 'Resumen de la partida' : 'Elige un mazo y configura la partida'}
                </p>
            </header>

            {partida ? (
                <ResumenPartida partida={partida} onVolver={() => setPartida(null)} onOtraSeleccion={crear}
                    onAbrirSala={() => onAbrirSala(partida)} />
            ) : (
                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-8">
                    <PanelMazos
                        entradas={biblioteca.entradas}
                        seleccionada={entrada?.clave ?? null}
                        onSeleccionar={elegirMazo}
                        onImportar={biblioteca.importar}
                        onExportar={biblioteca.exportar}
                        onBorrar={biblioteca.borrar}
                        mensaje={biblioteca.mensaje}
                        onCerrarMensaje={biblioteca.cerrarMensaje}
                        errorAlmacen={biblioteca.errorAlmacen}
                    />
                    {mazo ? (
                        <PanelConfiguracion mazo={mazo} config={configActual} cambios={cambios} onCambiar={c => aplicar(c)} onCrear={crear} />
                    ) : (
                        <section className="flex items-center justify-center rounded-tarjeta bg-superficie p-8 font-texto text-[24px] text-texto-2">
                            No hay ningún mazo válido. Importa uno para empezar.
                        </section>
                    )}
                </div>
            )}
        </main>
    );
}
