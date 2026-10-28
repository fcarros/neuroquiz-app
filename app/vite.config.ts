/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { atenderPeticion, type Entorno } from './api/_credenciales';

/**
 * Sirve la función de Vercel `api/ably-token` en `npm run dev` y
 * `npm run preview`, con las variables de `.env.local`. Así se prueba Ably
 * en local sin la CLI de Vercel. Nada de esto entra en la web compilada.
 */
function credencialesLocales(entorno: Entorno): Plugin {
    const middleware: Connect.NextHandleFunction = (req, res) => {
        void (async () => {
            const trozos: Buffer[] = [];
            for await (const t of req) trozos.push(t as Buffer);
            const peticion = new Request(`http://localhost${req.url ?? ''}`, {
                method: req.method,
                ...(req.method === 'POST' && { body: Buffer.concat(trozos).toString('utf8') }),
            });
            const r = await atenderPeticion(peticion, entorno);
            res.statusCode = r.status;
            r.headers.forEach((v, k) => res.setHeader(k, v));
            res.end(await r.text());
        })();
    };
    return {
        name: 'aula-quiz:credenciales-locales',
        configureServer: s => { s.middlewares.use('/api/ably-token', middleware); },
        configurePreviewServer: s => { s.middlewares.use('/api/ably-token', middleware); },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react(), tailwindcss(), credencialesLocales({ claveAbly: env.ABLY_API_KEY, secretoSala: env.AULA_QUIZ_SECRETO_SALA })],
        build: {
            // Los mazos incluidos (app/mazos/, ~300 KB de JSON) van en el paquete
            // principal; comprimido ronda los 160 KB.
            chunkSizeWarningLimit: 1000,
        },
        test: {
            include: ['src/**/*.test.ts', 'api/**/*.test.ts', 'pruebas/**/*.test.ts'],
            // La prueba contra Ably de verdad se lanza aparte: npm run prueba:ably.
            exclude: ['pruebas/**/*.real.test.ts'],
        },
    };
});
