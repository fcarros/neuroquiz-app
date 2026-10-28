import { useCallback, useMemo, useState } from 'react';
import {
    MAX_BYTES_IMPORTACION, analizarImportacion, borrarImportado, cargarImportados, cargarIncluidos, exportarMazo,
    guardarImportado, type EntradaMazo,
} from './biblioteca';

export interface Mensaje {
    tipo: 'ok' | 'error';
    texto: string;
    /** Errores o avisos concretos del validador. */
    detalles?: string[];
}

/** Estado de la biblioteca para la interfaz: incluidos, importados y avisos. */
export function useBiblioteca() {
    const incluidos = useMemo(() => cargarIncluidos(), []);
    const [importados, setImportados] = useState(cargarImportados);
    const [mensaje, setMensaje] = useState<Mensaje | null>(null);

    const recargar = useCallback(() => setImportados(cargarImportados()), []);

    const importar = useCallback(async (archivo: File) => {
        if (archivo.size > MAX_BYTES_IMPORTACION) {
            setMensaje({ tipo: 'error', texto: `«${archivo.name}» ocupa demasiado (máximo 2 MB). ¿Seguro que es un mazo?` });
            return;
        }
        let texto: string;
        try {
            texto = await archivo.text();
        } catch {
            setMensaje({ tipo: 'error', texto: `No se pudo leer «${archivo.name}».` });
            return;
        }
        const r = analizarImportacion(texto, incluidos);
        if (r.tipo === 'error-json') {
            setMensaje({ tipo: 'error', texto: r.mensaje });
            return;
        }
        if (r.tipo === 'invalido') {
            setMensaje({ tipo: 'error', texto: `«${archivo.name}» no es un mazo válido:`, detalles: r.validacion.errores });
            return;
        }
        if (r.tipo === 'conflicto-incluido') {
            setMensaje({ tipo: 'error', texto: `Ya hay un mazo incluido con el id «${r.id}». Cambia el «id» del archivo para importarlo.` });
            return;
        }
        const titulo = r.validacion.mazo?.titulo ?? archivo.name;
        if (r.reemplaza && !window.confirm(`Ya tienes importado un mazo con el id «${r.validacion.mazo?.id}». ¿Quieres sustituirlo por «${titulo}»?`)) {
            return;
        }
        const error = guardarImportado(r.datos);
        if (error) {
            setMensaje({ tipo: 'error', texto: error });
            return;
        }
        recargar();
        setMensaje({
            tipo: 'ok',
            texto: `Mazo «${titulo}» importado${r.reemplaza ? ' (sustituye al anterior)' : ''}.`
                + (r.validacion.avisos.length ? ' Conviene revisar:' : ''),
            detalles: r.validacion.avisos,
        });
    }, [incluidos, recargar]);

    const borrar = useCallback((entrada: EntradaMazo) => {
        if (!window.confirm(`¿Borrar el mazo importado «${entrada.titulo}» de este navegador? Si no lo has exportado, se perderá.`)) return;
        const error = borrarImportado(entrada);
        recargar();
        setMensaje(error ? { tipo: 'error', texto: error } : { tipo: 'ok', texto: `Mazo «${entrada.titulo}» borrado.` });
    }, [recargar]);

    const entradas = useMemo(() => [...incluidos, ...importados.entradas], [incluidos, importados]);

    return {
        entradas,
        errorAlmacen: importados.error,
        mensaje,
        cerrarMensaje: () => setMensaje(null),
        importar,
        borrar,
        exportar: exportarMazo,
    };
}
