import react from '@vitejs/plugin-react';
import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths(), react()],
    resolve: {
        // Alias aussi déclarés ici : sous Windows, vite-tsconfig-paths ne les
        // résout plus quand la lettre du lecteur change de casse (o: / O:).
        alias: {
            '@server/types': path.resolve(__dirname, '../server/src/types.ts'),
            '@': path.resolve(__dirname, 'src'),
        },
    },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}'],
        restoreMocks: true,
        setupFiles: ['./src/test/setup.ts'],
    },
});
