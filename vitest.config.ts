import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      enabled: true,
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts',          // Core entry point - just exports
        'src/node.ts',           // Node entry point - just exports  
        'src/browser.ts',        // Browser entry point - just exports
        'src/mock.ts',           // Mock entry point - just exports
        'src/interfaces.ts',     // Type definitions only - no executable code
        'src/BrowserWebSocketConnector.ts',  // Browser-specific, can't test in Node
        'src/NodeWebSocketConnector.ts'     // Node-specific, requires actual WebSocket server
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
  },
});
