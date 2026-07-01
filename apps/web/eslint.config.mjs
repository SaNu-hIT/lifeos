import { base } from '@lifeos/eslint-config';

// The web app runs in the browser: expose the standard browser globals so `no-undef`
// (and TS) are satisfied without a plugin dependency. React 17+ JSX transform needs
// no `React` import, so the TS `jsx: react-jsx` setting handles that side.
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        EventSource: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLFormElement: 'readonly',
      },
    },
  },
];
