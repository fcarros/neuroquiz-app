import { useState } from 'react';
import { PanelMazos } from './biblioteca/PanelMazos';
import { useBiblioteca } from './biblioteca/useBiblioteca';

export default function App() {
    const biblioteca = useBiblioteca();
    const [seleccionada, setSeleccionada] = useState<string | null>(null);

    return (
        <main className="mx-auto flex h-dvh max-w-[1920px] flex-col gap-8 p-12">
            <h1 className="text-[56px] font-extrabold leading-none">
                Aula <span className="text-acento">Quiz</span>
            </h1>
            <PanelMazos
                entradas={biblioteca.entradas}
                seleccionada={seleccionada}
                onSeleccionar={setSeleccionada}
                onImportar={biblioteca.importar}
                onExportar={biblioteca.exportar}
                onBorrar={biblioteca.borrar}
                mensaje={biblioteca.mensaje}
                onCerrarMensaje={biblioteca.cerrarMensaje}
                errorAlmacen={biblioteca.errorAlmacen}
            />
        </main>
    );
}
