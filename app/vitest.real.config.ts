import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

/** Solo para `npm run prueba:ably`: la prueba contra Ably de verdad, con las variables de .env.local. */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        test: {
            include: ['pruebas/**/*.real.test.ts'],
            env: { ABLY_API_KEY: env.ABLY_API_KEY ?? '', AULA_QUIZ_SECRETO_SALA: env.AULA_QUIZ_SECRETO_SALA ?? '' },
            testTimeout: 300_000,
        },
    };
});
