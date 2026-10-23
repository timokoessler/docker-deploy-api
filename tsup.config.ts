import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['./src/app.ts', './src/cli.ts'],
    bundle: true,
    platform: 'node',
    outDir: 'dist',
    // ssh2's optional native binding does not build on Node.js 26, ssh2 falls back to pure JS
    noExternal: [/^(?!.*sshcrypto\.node$).*/],
    external: [/sshcrypto\.node$/],
    loader: {
        '.sh': 'text',
        '.svg': 'text',
        '.ps1': 'text',
    },
});
