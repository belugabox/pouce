import { strFromU8, unzipSync } from 'fflate';
import { DOMParser } from 'linkedom';

/**
 * MusicXML hors du navigateur : décompression des `.mxl` et DOM léger
 * (linkedom), pour réutiliser la lecture du client (`core/musicxml.ts`).
 */

/** Texte MusicXML d'un fichier `.mxl` (zip) ; null s'il est illisible. */
export const mxlToXml = (data: Uint8Array): string | null => {
    let files: Record<string, Uint8Array>;
    try {
        files = unzipSync(data);
    } catch {
        return null;
    }
    const container = files['META-INF/container.xml'];
    const root = container
        ? /full-path="([^"]+)"/.exec(strFromU8(container))?.[1]
        : undefined;
    const name =
        root && files[root]
            ? root
            : Object.keys(files).find(
                  (f) =>
                      !f.startsWith('META-INF/') && /\.(xml|musicxml)$/.test(f),
              );
    return name ? strFromU8(files[name]!) : null;
};

/** Document XML avec `querySelector`, `children`, `localName`… */
export const parseXmlDocument = (xml: string): Document => {
    // Sans DOCTYPE : linkedom n'en a pas besoin et certains sont invalides.
    const clean = xml.replace(/<!DOCTYPE[^>]*>/i, '');
    return new DOMParser().parseFromString(
        clean,
        'text/xml',
    ) as unknown as Document;
};
