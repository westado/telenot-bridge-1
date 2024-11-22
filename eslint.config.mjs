import securityPlugin from 'eslint-plugin-security'
import eslintJs from '@eslint/js'

const { configs: recommendedConfig } = eslintJs

export default [
    {
        ...recommendedConfig.recommended,
        plugins: {
            security: securityPlugin,
        },
        languageOptions: {
            globals: {
                process: 'readonly',
                Buffer: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                global: 'readonly',
                setInterval: 'readonly',
                beforeEach: 'readonly',
                MqttHandler: 'readonly',
                Telenot: 'readonly',
            },
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        rules: {
            'no-unused-vars': 'error',
            'no-undef': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'prefer-const': 'error',
            'no-var': 'error',
            'arrow-body-style': ['error', 'as-needed'],
            'no-multi-spaces': 'error',
            'spaced-comment': ['error', 'always', { markers: ['/'] }],
            'array-callback-return': 'error',
            'block-scoped-var': 'error',
            'consistent-return': 'error',
            'default-case': 'error',
            'dot-notation': 'error',
            'no-alert': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-return-await': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-template': 'error',
            'security/detect-object-injection': 'off',
        },
    },
    {
        ...securityPlugin.configs.recommended,
        files: ['**/*.test.js', '**/*.test.mjs'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
            },
        },
    },
]
