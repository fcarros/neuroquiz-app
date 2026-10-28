import { useSyncExternalStore } from 'react';
import { AppAlumno } from './alumno/AppAlumno';
import { AppProfesor } from './profesor/AppProfesor';

/**
 * Una sola web con dos papeles, según la dirección:
 * - `/` → profesor (configurar y proyectar);
 * - `/#/jugar/123456` → móvil del alumno (lo que abre el QR).
 * Con `#` no hacen falta reglas de redirección en el alojamiento.
 */
const escucharHash = (fn: () => void) => {
    addEventListener('hashchange', fn);
    return () => removeEventListener('hashchange', fn);
};

export function rutaJugar(hash: string): { pin: string | null } | null {
    const m = /^#\/jugar(?:\/(\d{6}))?\/?$/.exec(hash);
    return m ? { pin: m[1] ?? null } : null;
}

export default function App() {
    const hash = useSyncExternalStore(escucharHash, () => location.hash);
    const jugar = rutaJugar(hash);
    return jugar ? <AppAlumno key={jugar.pin} pinRuta={jugar.pin} /> : <AppProfesor />;
}
