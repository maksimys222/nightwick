import { defineConfig } from 'vite';

// base './' — чтобы сборка открывалась и на itch.io, и в Electron
export default defineConfig({ base: './', build: { target: 'es2022' } });
