/** Mazos de app/mazos/, empaquetados con la app al compilar. */
const archivos = import.meta.glob('../../mazos/*.json', { eager: true, import: 'default' });

export interface ArchivoIncluido {
    archivo: string;
    datos: unknown;
}

export const ARCHIVOS_INCLUIDOS: ArchivoIncluido[] = Object.entries(archivos)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruta, datos]) => ({ archivo: ruta.split('/').pop() ?? ruta, datos }));
