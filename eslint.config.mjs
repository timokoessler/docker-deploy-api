import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

export default [
    { files: ['**/*.{js,mjs,cjs,ts}'] },
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    eslintPluginUnicorn.configs['flat/recommended'],
    {
        rules: {
            'unicorn/prevent-abbreviations': 'off',
            'unicorn/prefer-global-this': 'off',
            'unicorn/no-process-exit': 'off',
            'unicorn/prefer-switch': 'off',
        },
    },
    {
        ignores: ['dist/*'],
    },
];
