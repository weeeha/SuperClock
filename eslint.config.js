import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Clock faces must consume useClockHands(isActive) for the tick + hand angles.
    // Banning setInterval here keeps the second-hand wrap fix in one place — a copy-pasted
    // face that rolls its own timer (and inline `seconds * 6`) fails lint instead of regressing.
    files: ['src/apps/clock/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='setInterval']",
          message:
            'Clock faces must not run their own timer — use useClockHands(isActive) so the per-second tick and the monotonic second-hand angle live in one place.',
        },
      ],
    },
  },
])
