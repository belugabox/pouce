import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type Plugin, defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Fichiers de `public/` gardés aussi sur l'appareil (manifeste, icônes).
const PUBLIC_FILES = [
    '/manifest.webmanifest',
    '/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
];

/**
 * Service worker (`sw/sw.js`), écrit au build avec la liste de tous les
 * fichiers de l'application (même ceux chargés à la demande, comme
 * l'éditeur et OpenSheetMusicDisplay) et une version qui change avec eux :
 * un nouveau build installe un nouveau service worker.
 */
const serviceWorker = (): Plugin => ({
    name: 'pouce-service-worker',
    apply: 'build',
    // Après les autres : tous les fichiers sont là (index.html compris).
    enforce: 'post',
    generateBundle(_options, bundle) {
        const files = Object.keys(bundle)
            // Polices : les .woff2 suffisent (les .woff, pour les vieux
            // navigateurs, restent servis à la demande).
            .filter(
                (name) =>
                    !name.endsWith('.map') &&
                    !name.endsWith('.woff') &&
                    !name.startsWith('.'),
            )
            .map((name) => (name === 'index.html' ? '/' : `/${name}`))
            .sort();
        // `/` (index.html) toujours : c'est lui qui ouvre Pouce hors ligne.
        const assets = [...new Set(['/', ...files, ...PUBLIC_FILES])];
        const version = createHash('sha256')
            .update(assets.join('\n'))
            .digest('hex')
            .slice(0, 12);
        const source = readFileSync(
            new URL('./sw/sw.js', import.meta.url),
            'utf-8',
        )
            .replace(
                "const VERSION = '__VERSION__';",
                `const VERSION = '${version}';`,
            )
            .replace(
                'const ASSETS = __ASSETS__;',
                `const ASSETS = ${JSON.stringify(assets)};`,
            );
        // Une marque oubliée : service worker cassé, Pouce sans hors ligne.
        if (source.includes('__VERSION__') || source.includes('__ASSETS__')) {
            this.error('sw/sw.js : marques VERSION ou ASSETS introuvables');
        }
        this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
});

export default defineConfig({
    plugins: [tsconfigPaths(), react(), serviceWorker()],
    resolve: {
        alias: {
            // N'importer que les icônes utilisées (pas un chunk par icône).
            '@tabler/icons-react':
                '@tabler/icons-react/dist/esm/icons/index.mjs',
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': 'http://localhost:3001',
        },
    },
});
