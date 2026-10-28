import { atenderPeticion, entornoDeProceso } from './_credenciales';

/**
 * POST /api/ably-token: credenciales temporales de Ably para el profesor o
 * un jugador (ver `_credenciales.ts`). Necesita ABLY_API_KEY y
 * AULA_QUIZ_SECRETO_SALA en las variables de entorno.
 */
export default {
    fetch(peticion: Request) {
        return atenderPeticion(peticion, entornoDeProceso());
    },
};
