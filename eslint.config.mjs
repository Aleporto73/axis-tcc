// ========================================================================
// AXIS - ESLint Flat Config (ESLint 9)
//
// ESCOPO: APENAS regras de boundary cross-module (aba <-> tdah, engines).
// Zero outras regras. NAO herda de presets (next, recommended).
//
// Referencia de ownership: docs/MIGRATIONS_MAP.md
// ========================================================================
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default [
  // Ignorar
  {
    ignores: [
      '.next/**',
      '.husky/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'e2e/**',
      'node_modules/**',
      '*.config.*',
      '**/*.d.ts',
      'scripts/**',
      'public/**',
      'playwright-report/**',
      // Arquivos com disable-directives referenciando rules nao carregadas
      // (herdado de quando 'next lint' estava ativo). Nao afeta o motor
      // clinico nem cria risco de cross-module. Revisitar quando/se
      // eslint-plugin-react-hooks for adicionado.
      'app/aba/selecionar-clinica/**',
      'app/tdah/selecionar-clinica/**',
    ],
  },

  // Boundaries - cross-module guard
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { boundaries },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      // Ordem importa: regras mais especificas (file-level) primeiro.
      'boundaries/elements': [
        // Engines congelados (file-level)
        { type: 'engine-tcc',  pattern: 'src/engines/cso.ts',              mode: 'full' },
        { type: 'engine-aba',  pattern: 'src/engines/cso-aba.ts',          mode: 'full' },
        { type: 'engine-tdah', pattern: 'src/engines/cso-tdah.ts',         mode: 'full' },
        { type: 'engine-tdah', pattern: 'src/engines/cso-tdah-adapter.ts', mode: 'full' },

        // Produtos - folders
        { type: 'aba',  pattern: ['app/aba/**/*',  'app/api/aba/**/*'],  mode: 'full' },
        { type: 'tdah', pattern: ['app/tdah/**/*', 'app/api/tdah/**/*'], mode: 'full' },

        // TCC - lista explicita (esta espalhado na raiz de app/)
        {
          type: 'tcc',
          mode: 'full',
          pattern: [
            'app/tcc/**/*',
            'app/sessoes/**/*',
            'app/pacientes/**/*',
            'app/sugestoes/**/*',
            'app/relatorio/**/*',
            'app/api/tcc/**/*',
            'app/api/analyze-tcc/**/*',
            'app/api/analyze-clinical/**/*',
            'app/api/sessions/**/*',
            'app/api/suggestions/**/*',
            'app/api/transcribe/**/*',
            'app/api/transcribe-audio/**/*',
            'app/api/events/**/*',
            'app/api/patient/**/*',
            'app/api/patients/**/*',
          ],
        },

        // Tudo que nao bate e SHARED (livre, sem restricoes)
      ],

      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      // UNICA regra do projeto: cross-module boundary
      'boundaries/element-types': ['error', {
        default: 'allow',
        rules: [
          // ABA nao pode usar TDAH nem CSO-TCC nem CSO-TDAH
          { from: ['aba'],  disallow: ['tdah', 'engine-tcc', 'engine-tdah'] },
          // TDAH nao pode usar ABA nem CSO-TCC nem CSO-ABA
          { from: ['tdah'], disallow: ['aba',  'engine-tcc', 'engine-aba']  },
          // TCC nao pode usar ABA nem TDAH
          { from: ['tcc'],  disallow: ['aba',  'tdah'] },
        ],
      }],
    },
  },
];
