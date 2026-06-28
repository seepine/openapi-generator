import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/vite.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  exports: true,
  dts: true,
  minify: true,
  sourcemap: true,
  unbundle: false,
  treeshake: true,
})
