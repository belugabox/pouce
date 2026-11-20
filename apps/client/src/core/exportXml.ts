import { type Fingerings, indexScore, kid, kids, parseXml } from './musicxml';

/**
 * Partition avec les doigtés écrits en `<notations><technical><fingering>`,
 * lisible par MuseScore et les autres éditeurs. Les doigtés d'origine sont
 * remplacés par `fingerings`.
 */
export const buildExport = (xml: string, fingerings: Fingerings) => {
    const doc = parseXml(xml);
    // Anciens doigtés retirés, avec les éléments devenus vides.
    for (const f of Array.from(doc.querySelectorAll('fingering'))) {
        const technical = f.parentElement;
        f.remove();
        if (technical && !technical.children.length) {
            const notations = technical.parentElement;
            technical.remove();
            if (
                notations?.localName === 'notations' &&
                !notations.children.length
            ) {
                notations.remove();
            }
        }
    }
    const index = indexScore(doc);
    let count = 0;
    for (const [key, value] of Object.entries(fingerings)) {
        const el = index.byKey.get(key)?.el;
        if (!el) continue;
        const make = (name: string) =>
            doc.createElementNS(el.namespaceURI, name);
        let notations = kid(el, 'notations');
        if (!notations) {
            notations = make('notations');
            // Ordre du schéma : <notations> avant <lyric>, <play>, <listen>.
            const before =
                kids(el, 'lyric')[0] ?? kid(el, 'play') ?? kid(el, 'listen');
            el.insertBefore(notations, before);
        }
        let technical = kid(notations, 'technical');
        if (!technical) {
            technical = make('technical');
            notations.append(technical);
        }
        const fingering = make('fingering');
        fingering.textContent = String(value);
        technical.append(fingering);
        count++;
    }
    return { text: new XMLSerializer().serializeToString(doc), count };
};

/** Nom de fichier sans accents ni espaces (« ode-a-la-joie »). */
export const slug = (text: string) =>
    text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'partition';
