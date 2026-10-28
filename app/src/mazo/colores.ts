/**
 * Fuente única de los seis colores del juego.
 * El orden es el del tablero (sentido horario empezando arriba).
 */
export const COLORES = [
    { id: 'azul', nombre: 'Azul', pintura: '#3b82f6' },
    { id: 'rosa', nombre: 'Rosa', pintura: '#ec4899' },
    { id: 'amarillo', nombre: 'Amarillo', pintura: '#eab308' },
    { id: 'marron', nombre: 'Marrón', pintura: '#78350f' },
    { id: 'verde', nombre: 'Verde', pintura: '#22c55e' },
    { id: 'naranja', nombre: 'Naranja', pintura: '#f97316' },
] as const;

export type ColorId = typeof COLORES[number]['id'];

/** Color de una casilla: uno de los seis o el centro del tablero. */
export type ColorCasilla = ColorId | 'centro';

export const IDS_COLOR: readonly ColorId[] = COLORES.map(c => c.id);

export const PINTURA: Record<ColorId, string> = Object.fromEntries(
    COLORES.map(c => [c.id, c.pintura])
) as Record<ColorId, string>;

export const NOMBRE_COLOR: Record<ColorId, string> = Object.fromEntries(
    COLORES.map(c => [c.id, c.nombre])
) as Record<ColorId, string>;

export function esColorId(valor: unknown): valor is ColorId {
    return typeof valor === 'string' && (IDS_COLOR as readonly string[]).includes(valor);
}
