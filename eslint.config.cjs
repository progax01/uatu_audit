// Minimal flat ESLint config for TypeScript only (ESLint v9)
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: ['dist/**', 'eslint.config.cjs'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'pdfkit', message: 'PDFKit removed. Use Puppeteer on HTML.' },
          { name: '@/services/report/pdfReport', message: 'Removed. Use htmlReport.' }
        ],
        patterns: [
          '**/services/report/*pdf*',
          '**/templates/report_*',
          '**/templates/enhanced-report*'
        ]
      }],
      'no-restricted-syntax': [
        'error',
        { selector: "Literal[value=/report_v\\d/i]", message: 'No versioned templates. Use src/templates/report.html only.' }
      ]
    },
  },
];


