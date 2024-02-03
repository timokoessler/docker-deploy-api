import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['./src/cli.ts'],
    bundle: true,
    format: ['cjs'],
    noExternal: [/.*/],
    sourcemap: 'inline',
    platform: 'node',
    outDir: 'dist',
    loader: {
        '.sh': 'text',
        '.svg': 'text',
        '.ps1': 'text',
    },
});
