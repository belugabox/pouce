import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            '@typescript-eslint/no-unused-vars': ['warn'],
            // `useEffect(() => appel())` : ce que renvoie l'appel devient le
            // nettoyage de l'effet. Edge 158 fait renvoyer une promesse à
            // `scrollTo`, et React plantait en quittant l'éditeur.
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "CallExpression[callee.name=/^use(Layout)?Effect$/] > ArrowFunctionExpression[body.type!='BlockStatement'][body.type!='ArrowFunctionExpression']",
                    message:
                        'Corps d’effet entre accolades : la valeur renvoyée servirait de nettoyage.',
                },
            ],
        },
    },
);
