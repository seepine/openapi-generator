export default {
  '*.{js,jsx,ts,tsx,md,json}': ['prettier --write'],
  'src/**/*.{ts}': () => ['vitest run'],
}
