import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS relies on decorator metadata. swc transpiles tests with metadata emit so
// dependency injection works under vitest (docs/12_TESTING_GUIDE.md).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['reflect-metadata'],
    // Integration tests open real Postgres/Redis connections; run files sequentially
    // to avoid exhausting connections (the suite is fast, ~2s).
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
