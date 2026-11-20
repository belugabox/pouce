import { parseXml, readMeta } from './musicxml';

export interface ImportedScore {
    title: string;
    composer: string;
    xml: string;
}

/** Archive `.mxl` : la partition désignée par `META-INF/container.xml`. */
const readMxl = async (file: Blob) => {
    // JSZip chargé seulement pour une archive.
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);
    let path: string | null = null;
    const container = zip.file('META-INF/container.xml');
    if (container) {
        const doc = parseXml(await container.async('string'));
        path = doc.querySelector('rootfile')?.getAttribute('full-path') ?? null;
    }
    path ??=
        Object.keys(zip.files).find(
            (name) =>
                !name.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(name),
        ) ?? null;
    const entry = path ? zip.file(path) : null;
    if (!entry)
        throw new Error('Aucun fichier MusicXML trouvé dans l’archive.');
    return entry.async('string');
};

/**
 * Lit un fichier `.mxl`, `.musicxml` ou `.xml`. Erreur avec un message à
 * montrer tel quel si ce n'est pas une partition lisible.
 */
export const importFile = async (
    file: Blob,
    fileName: string,
): Promise<ImportedScore> => {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b; // « PK »
    const xml = isZip ? await readMxl(file) : await file.text();
    const doc = parseXml(xml);
    const root = doc.documentElement;
    if (
        doc.querySelector('parsererror') ||
        root.localName !== 'score-partwise'
    ) {
        throw new Error(
            root.localName === 'score-timewise'
                ? 'Ce fichier est au format « timewise », pas encore pris en charge.'
                : 'Ce fichier n’est pas une partition MusicXML lisible.',
        );
    }
    const meta = readMeta(doc);
    return {
        title: meta.title || fileName.replace(/\.[^.]+$/, ''),
        composer: meta.composer,
        xml,
    };
};
