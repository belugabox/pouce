import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/services/api';
import { addImport, closeDb, pieceKey, saveAnnotations } from '@/storage/db';
import { scoreXml } from '@/test/scores';

import { SearchPage } from './SearchPage';

const CATALOG = [
    {
        id: 'jacques',
        title: 'Frère Jacques',
        composer: 'Traditionnel',
        level: 'Débutant',
        tags: 'canon',
        source: 'pouce',
        license: 'Domaine public',
    },
    {
        id: 'menuet',
        title: 'Menuet en sol majeur',
        composer: 'Christian Petzold',
        level: 'Facile',
        tags: 'bach',
        source: 'pouce',
        license: 'Domaine public',
    },
];

const renderPage = (url = '/') =>
    render(
        <MantineProvider>
            <MemoryRouter initialEntries={[url]}>
                <Routes>
                    <Route path="/" element={<SearchPage />} />
                    <Route
                        path="/partition/:source/:id"
                        element={<p>Éditeur ouvert</p>}
                    />
                </Routes>
            </MemoryRouter>
        </MantineProvider>,
    );

beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.spyOn(api, 'fetchCatalog').mockResolvedValue(CATALOG);
});
afterEach(closeDb);

describe('SearchPage', () => {
    it('affiche le catalogue avec les niveaux', async () => {
        renderPage();
        expect(await screen.findByText('Frère Jacques')).toBeTruthy();
        expect(screen.getByText('Menuet en sol majeur')).toBeTruthy();
        expect(screen.getByText('Facile')).toBeTruthy();
        // Pas encore d'import : pas de section « Mes partitions ».
        expect(screen.queryByText('Mes partitions importées')).toBeNull();
    });

    it('filtre sans tenir compte des accents', async () => {
        renderPage('/?q=frere');
        expect(await screen.findByText('Frère Jacques')).toBeTruthy();
        expect(screen.queryByText('Menuet en sol majeur')).toBeNull();
    });

    it('dit quand rien ne correspond', async () => {
        renderPage('/?q=zzz');
        expect(
            await screen.findByText('Aucun résultat pour cette recherche.'),
        ).toBeTruthy();
    });

    it('montre les imports et le nombre de doigtés notés', async () => {
        const p = await addImport({
            title: 'Ma sonate',
            composer: 'Moi',
            xml: '<a/>',
        });
        await saveAnnotations(pieceKey('import', p.id), {
            f: { a: 1, b: 2 },
            auto: {},
        });
        await saveAnnotations(pieceKey('catalogue', 'menuet'), {
            f: { a: 1 },
            auto: {},
        });
        renderPage();
        expect(
            await screen.findByText('Mes partitions importées'),
        ).toBeTruthy();
        expect(await screen.findByText('Moi — 2 doigtés')).toBeTruthy();
        expect(screen.getByText('Christian Petzold — 1 doigté')).toBeTruthy();
        expect(screen.getByText('Importée')).toBeTruthy();
    });

    it('importe un fichier puis ouvre l’éditeur', async () => {
        renderPage();
        const input = screen.getByTestId('import-input');
        const file = new File([scoreXml({ rh: ['C4'] })], 'essai.musicxml');
        fireEvent.change(input, { target: { files: [file] } });
        expect(await screen.findByText('Éditeur ouvert')).toBeTruthy();
    });

    it('affiche l’erreur d’un fichier illisible', async () => {
        renderPage();
        const input = screen.getByTestId('import-input');
        const file = new File(['<score-timewise/>'], 'a.xml');
        fireEvent.change(input, { target: { files: [file] } });
        expect((await screen.findByRole('alert')).textContent).toContain(
            'timewise',
        );
    });
});
