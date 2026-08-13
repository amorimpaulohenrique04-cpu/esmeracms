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
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/incompatible-library': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^(_|filters)$',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
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
    files: [
      'src/admin/modules/products/ProductCategoryPicker.tsx',
      'src/admin/modules/products/ProductGalleryUploader.tsx',
    ],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['src/admin/modules/products/ProductDocumentView.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          varsIgnorePattern: '^(relationId|roleLabels)$',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: [
      'src/admin/modules/categories/CategoriesMasterList.tsx',
      'src/admin/modules/categories/CategoryDetailEditor.tsx',
    ],
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    files: ['src/admin/modules/sales/SalesWorkspaceClient.tsx'],
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    files: ['src/admin/modules/sales/SalesViews.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          varsIgnorePattern: '^(Link|_)$',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['src/admin/modules/after-sales/AfterSalesWorkspaceClient.tsx'],
    rules: {
      'react-hooks/incompatible-library': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  globalIgnores(['.next/**', 'src/payload-types.ts', 'src/payload-generated-schema.ts']),
])
