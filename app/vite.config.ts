/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        // Los mazos incluidos (app/mazos/, ~300 KB de JSON) van en el paquete
        // principal; comprimido ronda los 160 KB.
        chunkSizeWarningLimit: 1000,
    },
    test: {
        include: ['src/**/*.test.ts'],
    },
});
