import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['src/admin/modules/products/ProductsWorkspaceClient.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    files: ['src/admin/modules/products/ProductMediaManager.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    files: ['src/admin/modules/products/ProductDocumentView.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores(['.next/**', 'src/payload-types.ts', 'src/payload-generated-schema.ts']),
])
