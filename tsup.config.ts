import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['./src/app.ts'],
    bundle: true,
    platform: 'node',
    outDir: 'dist',
    noExternal: [/.*/],
});
