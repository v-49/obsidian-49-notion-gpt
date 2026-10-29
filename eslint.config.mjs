import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.js'],
    rules: {
      // Runtime sources and the existing VM tests intentionally use CommonJS;
      // esbuild emits the CommonJS module required by Obsidian.
      '@typescript-eslint/no-require-imports': 'off',
      'obsidianmd/ui/sentence-case': ['warn', { brands: ['Shift', 'Alt'] }],
    },
  },
];
