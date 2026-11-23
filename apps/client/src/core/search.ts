/** Texte sans majuscules ni accents, pour comparer une recherche. */
export const norm = (text: string | null | undefined) =>
    (text ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

export interface Searchable {
    title: string;
    composer?: string | null;
    tags?: string | null;
}

/** La partition correspond à la recherche (titre, compositeur, mots-clés). */
export const matches = (piece: Searchable, query: string) => {
    const q = norm(query.trim());
    return (
        !q ||
        norm(
            `${piece.title} ${piece.composer ?? ''} ${piece.tags ?? ''}`,
        ).includes(q)
    );
};
