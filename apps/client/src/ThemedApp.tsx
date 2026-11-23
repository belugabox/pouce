import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useEffect } from 'react';
import { BrowserRouter } from 'react-router';

import { App } from './App';
import {
    BACKGROUND,
    cssVariablesResolver,
    theme,
    useAppearance,
} from './components/theme';

/** Thème de l'appli : mode clair, sombre ou système. */
export const ThemedApp = () => {
    const { resolved } = useAppearance();
    // Barres du système (Android) : du fond de l'appli, discrètes.
    useEffect(() => {
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute('content', BACKGROUND[resolved]);
    }, [resolved]);
    return (
        <MantineProvider
            theme={theme}
            forceColorScheme={resolved}
            cssVariablesResolver={cssVariablesResolver}
        >
            {/* En haut : en bas, le clavier de saisie de l’éditeur les cacherait. */}
            <Notifications position="top-center" />
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </MantineProvider>
    );
};
