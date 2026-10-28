// Utilidades compartidas por los tests (no se usan en el juego).
// Copia de crearMazo() de game-core/src/pruebas.ts (Aula Trivial, ver ORIGEN.md).
import { IDS_COLOR } from './colores';
import type { Mazo } from './mazo';

/** Mazo válido con `porColor` preguntas de cada color y sin avisos (si porColor >= 10). */
export function crearMazo(porColor = 10): Mazo {
    let n = 0;
    return {
        formato: 1,
        id: 'prueba',
        titulo: 'Mazo de prueba',
        modulo: 'Pruebas',
        categorias: IDS_COLOR.map(color => ({ color, nombre: `Tema ${color}` })),
        preguntas: IDS_COLOR.flatMap(color => Array.from({ length: porColor }, () => {
            n++;
            return {
                id: `p${String(n).padStart(3, '0')}`,
                color,
                enunciado: `¿Pregunta número ${n}?`,
                opciones: [`Opción ${n}.1`, `Opción ${n}.2`, `Opción ${n}.3`, `Opción ${n}.4`],
                correcta: n % 4,
            };
        })),
    };
}
