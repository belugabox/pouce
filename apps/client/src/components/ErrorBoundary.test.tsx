import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary, isStaleChunk } from './ErrorBoundary';

const Boom = ({ message }: { message: string }): never => {
    throw new Error(message);
};

const page = (key: string, child: React.ReactNode) => (
    <MantineProvider>
        <ErrorBoundary resetKey={key}>{child}</ErrorBoundary>
    </MantineProvider>
);

describe('ErrorBoundary', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reconnaît un module d’une ancienne version', () => {
        expect(
            isStaleChunk(
                new TypeError(
                    'Failed to fetch dynamically imported module: /assets/EditorPage-abc.js',
                ),
            ),
        ).toBe(true);
        expect(
            isStaleChunk(new TypeError('Importing a module script failed.')),
        ).toBe(true);
        expect(isStaleChunk(new Error('x is undefined'))).toBe(false);
        expect(isStaleChunk('texte')).toBe(false);
    });

    it('montre un message au lieu d’un écran blanc, puis repart à la page suivante', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { rerender } = render(
            page('/partition/catalogue/x', <Boom message="cassé" />),
        );
        expect(screen.getByRole('alert').textContent).toContain(
            'Quelque chose s’est mal passé',
        );
        screen.getByRole('button', { name: 'Recharger' });

        // Retour arrière : nouvelle adresse, l'erreur est effacée.
        rerender(page('/', <p>Recherche</p>));
        expect(screen.queryByRole('alert')).toBeNull();
        screen.getByText('Recherche');
    });

    it('attrape une erreur levée en quittant une page (nettoyage d’effet)', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // Ce que faisait l'éditeur sous Edge 158 : `scrollTo` renvoie une
        // promesse, gardée comme nettoyage de l'effet.
        const Editor = () => {
            // eslint-disable-next-line no-restricted-syntax
            useEffect(() => Promise.resolve() as unknown as () => void, []);
            return <p>Éditeur</p>;
        };
        const { rerender } = render(page('/partition/catalogue/x', <Editor />));
        rerender(page('/', <p>Recherche</p>));
        expect(screen.getByRole('alert').textContent).toContain(
            'Quelque chose s’est mal passé',
        );
    });
});
