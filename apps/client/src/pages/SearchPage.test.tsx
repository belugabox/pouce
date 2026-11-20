import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogEntry, CatalogPage, Level } from '@server/types';

import { matches } from '@/core/search';
import * as api from '@/services/api';
import {
    addImport,
    closeDb,
    keepLibraryPiece,
    pieceKey,
    saveAnnotations,
} from '@/storage/db';
import { scoreXml } from '@/test/scores';

import { SearchPage } from './SearchPage';

const entry = (
    id: string,
    title: string,
    composer: string,
    level: Level,
    tags = '',
): CatalogEntry => ({
    id,
    title,
    composer,
    arranger: '',
    level,
    difficulty: 2,
    tags,
    source: 'pouce',
    license: 'Domaine public',
    licenseUrl: null,
    sourceUrl: null,
    duration: 75,
    measures: 16,
});

const CATALOG = [
    entry('jacques', 'Frère Jacques', 'Traditionnel', 'Débutant', 'canon'),
    entry(
        'menuet',
        'Menuet en sol majeur',
        'Christian Petzold',
        'Facile',
        'bach',
    ),
];

/** Recherche simulée, filtrée comme le ferait le serveur. */
const fakeSearch = async ({
    q = '',
    level,
    offset = 0,
    limit = 30,
}: api.CatalogQuery = {}): Promise<CatalogPage> => {
    const found = CATALOG.filter((e) => matches(e, q));
    const levels = { Débutant: 0, Facile: 0, Intermédiaire: 0, Avancé: 0 };
    for (const e of found) if (e.level) levels[e.level]++;
    const items = found.filter((e) => !level || e.level === level);
    return {
        total: items.length,
        items: items.slice(offset, offset + limit),
        levels,
    };
};

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
    vi.spyOn(api, 'fetchCatalog').mockImplementation(fakeSearch);
});
afterEach(async () => {
    vi.restoreAllMocks();
    await closeDb();
});

describe('SearchPage', () => {
    it('affiche le catalogue avec les niveaux et la durée', async () => {
        renderPage();
        expect(await screen.findByText('Frère Jacques')).toBeTruthy();
        expect(screen.getByText('Menuet en sol majeur')).toBeTruthy();
        expect(screen.getByText('2 partitions')).toBeTruthy();
        expect(screen.getByText('Traditionnel · 1 min 15 s')).toBeTruthy();
        // Puces de niveau, avec le nombre de résultats.
        expect(screen.getByText('Facile 1')).toBeTruthy();
        // Rien sur l'appareil : pas de section.
        expect(screen.queryByText('Sur cet appareil')).toBeNull();
    });

    it('cherche avec les paramètres de l’adresse', async () => {
        renderPage('/?q=frere');
        expect(await screen.findByText('Frère Jacques')).toBeTruthy();
        expect(screen.queryByText('Menuet en sol majeur')).toBeNull();
        expect(api.fetchCatalog).toHaveBeenCalledWith(
            expect.objectContaining({ q: 'frere' }),
        );
    });

    it('filtre par niveau', async () => {
        renderPage('/?niveau=Facile');
        expect(await screen.findByText('Menuet en sol majeur')).toBeTruthy();
        expect(screen.queryByText('Frère Jacques')).toBeNull();
    });

    it('dit quand rien ne correspond', async () => {
        renderPage('/?q=zzz');
        expect(
            await screen.findByText('Aucun résultat pour cette recherche.'),
        ).toBeTruthy();
    });

    it('montre les partitions de l’appareil et le nombre de doigtés', async () => {
        const p = await addImport({
            title: 'Ma sonate',
            composer: 'Moi',
            xml: '<a/>',
            level: 'Avancé',
        });
        await saveAnnotations(pieceKey('import', p.id), {
            f: { a: 1, b: 2 },
            auto: {},
        });
        await keepLibraryPiece({ ...CATALOG[1]!, xml: '<a/>' });
        await saveAnnotations(pieceKey('catalogue', 'menuet'), {
            f: { a: 1 },
            auto: {},
        });
        renderPage();
        expect(await screen.findByText('Sur cet appareil')).toBeTruthy();
        expect(await screen.findByText('Moi · 2 doigtés')).toBeTruthy();
        expect(
            await screen.findAllByText(
                'Christian Petzold · 1 min 15 s · 1 doigté',
            ),
        ).toHaveLength(2);
        expect(screen.getByText('Avancé')).toBeTruthy();
    });

    it('reste utilisable hors ligne', async () => {
        vi.mocked(api.fetchCatalog).mockRejectedValue(
            new Error('Pas de connexion au serveur.'),
        );
        await keepLibraryPiece({ ...CATALOG[0]!, xml: '<a/>' });
        renderPage('/?q=hors-ligne-test');
        expect(
            await screen.findByText(/La bibliothèque n’est pas joignable/),
        ).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Rechercher une partition'), {
            target: { value: 'frere' },
        });
        expect(await screen.findByText('Frère Jacques')).toBeTruthy();
    });

    it('importe un fichier, estime son niveau, puis ouvre l’éditeur', async () => {
        renderPage();
        const input = screen.getByTestId('import-input');
        const file = new File(
            [scoreXml({ rh: ['C4', 'D4', 'E4'] })],
            'essai.musicxml',
        );
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
