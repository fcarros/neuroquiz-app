import { validarMazo, type ResultadoValidacion } from '../mazo/mazo';
import { ARCHIVOS_INCLUIDOS } from './incluidos';

/**
 * Biblioteca de mazos (adaptada de la de Aula Trivial):
 * - Incluidos: los .json de app/mazos/, empaquetados al compilar.
 * - Importados: los que carga el profesor; se guardan en localStorage.
 * Todos se validan cada vez que se cargan; los no válidos se muestran con sus
 * errores y no se pueden usar.
 */

export type Origen = 'incluido' | 'importado';

export interface EntradaMazo {
    /** Clave única para la interfaz. */
    clave: string;
    origen: Origen;
    /** Id y título tal como vienen en el archivo (o un sustituto si faltan). */
    id: string;
    titulo: string;
    /** Datos originales, para exportarlos tal cual. */
    datos: unknown;
    validacion: ResultadoValidacion;
}

export const CLAVE_ALMACEN = 'aula-quiz:mazos-importados';

/** Tamaño máximo de un archivo importado (los mazos incluidos rondan 140 KB). */
export const MAX_BYTES_IMPORTACION = 2 * 1024 * 1024;

const textoDe = (datos: unknown, campo: string): string => {
    if (typeof datos !== 'object' || datos === null) return '';
    const valor = (datos as Record<string, unknown>)[campo];
    return typeof valor === 'string' ? valor.trim() : '';
};

function crearEntrada(origen: Origen, datos: unknown, indice: number, archivo?: string): EntradaMazo {
    const id = textoDe(datos, 'id');
    return {
        clave: `${origen}:${id || archivo || 'sin-id'}:${indice}`,
        origen,
        id,
        titulo: textoDe(datos, 'titulo') || archivo || '(mazo sin título)',
        datos,
        validacion: validarMazo(datos),
    };
}

// --- Mazos incluidos ---

export function cargarIncluidos(): EntradaMazo[] {
    return ARCHIVOS_INCLUIDOS.map(({ archivo, datos }, i) => crearEntrada('incluido', datos, i, archivo));
}

// --- Mazos importados (localStorage) ---

export interface LecturaImportados {
    entradas: EntradaMazo[];
    /** Mensaje para el profesor si no se pudieron leer. */
    error: string | null;
}

function leerAlmacen(): { datos: unknown[]; error: string | null } {
    try {
        const crudo = localStorage.getItem(CLAVE_ALMACEN);
        if (crudo === null) return { datos: [], error: null };
        const datos = JSON.parse(crudo);
        if (!Array.isArray(datos)) {
            return { datos: [], error: 'Los mazos importados guardados en este navegador están dañados y no se pueden leer.' };
        }
        return { datos, error: null };
    } catch {
        return { datos: [], error: 'No se pudieron leer los mazos importados de este navegador (el almacenamiento no está disponible o los datos están dañados).' };
    }
}

function escribirAlmacen(datos: unknown[]): string | null {
    try {
        localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(datos));
        return null;
    } catch (err) {
        if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
            return 'No queda espacio en este navegador para guardar el mazo. Borra algún mazo importado e inténtalo de nuevo.';
        }
        return 'No se pudo guardar el mazo en este navegador (el almacenamiento no está disponible).';
    }
}

/** Lee y valida los mazos importados. */
export function cargarImportados(): LecturaImportados {
    const { datos, error } = leerAlmacen();
    return { entradas: datos.map((d, i) => crearEntrada('importado', d, i)), error };
}

export type ResultadoImportacion =
    | { tipo: 'error-json'; mensaje: string }
    | { tipo: 'invalido'; validacion: ResultadoValidacion }
    | { tipo: 'conflicto-incluido'; id: string }
    | { tipo: 'listo'; datos: unknown; validacion: ResultadoValidacion; reemplaza: boolean };

/**
 * Comprueba un archivo antes de importarlo. No guarda nada.
 * Si «reemplaza» es true, ya hay un mazo importado con el mismo id.
 */
export function analizarImportacion(texto: string, incluidos: EntradaMazo[]): ResultadoImportacion {
    let datos: unknown;
    try {
        datos = JSON.parse(texto);
    } catch {
        return { tipo: 'error-json', mensaje: 'El archivo no es un JSON válido. Comprueba que es un mazo exportado o generado con el formato de Aula Quiz / Aula Trivial.' };
    }
    const validacion = validarMazo(datos);
    if (!validacion.valido || !validacion.mazo) return { tipo: 'invalido', validacion };

    const id = validacion.mazo.id;
    if (incluidos.some(e => e.id === id)) return { tipo: 'conflicto-incluido', id };

    const reemplaza = leerAlmacen().datos.some(d => textoDe(d, 'id') === id);
    return { tipo: 'listo', datos, validacion, reemplaza };
}

/** Guarda un mazo importado (sustituye al que tenga el mismo id). Devuelve un error o null. */
export function guardarImportado(datos: unknown): string | null {
    const { datos: actuales, error } = leerAlmacen();
    if (error && localStorageTieneDatos()) {
        return `${error} No se ha guardado el mazo para no sobrescribirlos.`;
    }
    const id = textoDe(datos, 'id');
    const resto = actuales.filter(d => textoDe(d, 'id') !== id);
    return escribirAlmacen([...resto, datos]);
}

/** Borra un mazo importado por su posición en la lista guardada. Devuelve un error o null. */
export function borrarImportado(entrada: EntradaMazo): string | null {
    const { datos, error } = leerAlmacen();
    if (error) return error;
    const indice = Number(entrada.clave.split(':').pop());
    if (!Number.isInteger(indice) || indice < 0 || indice >= datos.length) {
        return 'No se encontró el mazo que quieres borrar. Recarga la página e inténtalo de nuevo.';
    }
    return escribirAlmacen(datos.filter((_, i) => i !== indice));
}

function localStorageTieneDatos(): boolean {
    try {
        return localStorage.getItem(CLAVE_ALMACEN) !== null;
    } catch {
        return false;
    }
}

// --- Exportar ---

/** Descarga el mazo como archivo .json, con los datos tal cual. */
export function exportarMazo(entrada: EntradaMazo): void {
    const nombre = (entrada.id || 'mazo').replace(/[^a-zA-Z0-9_-]+/g, '-');
    const blob = new Blob([JSON.stringify(entrada.datos, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${nombre}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
