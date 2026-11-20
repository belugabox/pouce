import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-500.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemedApp } from './ThemedApp';
import './global.css';

// Service worker (build seulement) : Pouce s'ouvre sans réseau.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Pas de service worker (navigation privée…) : en ligne seulement.
        });
    });
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemedApp />
    </StrictMode>,
);
