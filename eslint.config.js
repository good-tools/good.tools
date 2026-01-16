import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
    // Base config for all files
    {
        ignores: [
            'dist/**',
            'build/**',
            'node_modules/**',
            '**/*.config.js',
            '**/*.config.ts',
            'src/App.test.js',
            'src/**/*.worker.js', // Ignore worker files
            '**/*.js', // Ignore all plain JS files
        ],
    },
    js.configs.recommended,
    prettierConfig,
    // TypeScript-specific config with type-checking
    {
        files: ['**/*.{ts,tsx}'],
        extends: [...tseslint.configs.recommendedTypeChecked],
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
            prettier: prettierPlugin,
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Basic ESLint rules
            'no-undef': 'off', // Uses lots of globals, TypeScript handles this
            'no-unused-vars': 'off', // Use TypeScript version instead

            // React rules
            'react/react-in-jsx-scope': 'off', // Not needed in React 17+
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // Prettier integration
            'prettier/prettier': 'error',

            // TypeScript-specific rules
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    }
);
