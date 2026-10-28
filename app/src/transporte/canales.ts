/**
 * Nombres de los canales de Ably y reglas de identidad, compartidos por el
 * navegador y la función de credenciales (`api/`). Los nombres solo llevan
 * el PIN y el id aleatorio del jugador: ningún dato personal.
 */

export const PATRON_PIN = /^[1-9]\d{5}$/;
export const PATRON_CLAVE = /^[A-Za-z0-9_-]{8,64}$/;

export const canalTodos = (pin: string) => `aq:${pin}:todos`;
export const canalProfesor = (pin: string) => `aq:${pin}:profesor`;
export const canalJugador = (pin: string, id: string) => `aq:${pin}:j:${id}`;
/** Todos los canales de la sala (comodín de Ably: cubre uno o más segmentos). */
export const canalesSala = (pin: string) => `aq:${pin}:*`;

export const CLIENTE_PROFESOR = 'profesor';

/**
 * El id público de un jugador es un resumen de su secreto: quien no conoce
 * el secreto no puede pedir credenciales para escuchar el canal de otro.
 */
export async function idDeSecreto(secreto: string): Promise<string> {
    const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`aula-quiz:jugador:${secreto}`));
    return Array.from(new Uint8Array(resumen).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}
