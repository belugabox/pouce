/**
 * Petites partitions MusicXML pour les tests : une suite de notes par
 * portée, toutes de même durée (noires par défaut), une seule mesure.
 * Notes écrites « C4 », « F#4 », « Bb3 » ; un accord : « C4+E4+G4 ».
 */

const pitchXml = (name: string) => {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) throw new Error(`Note invalide : ${name}`);
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return `<pitch><step>${m[1]}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${m[3]}</octave></pitch>`;
};

const staffXml = (notes: string[], staff: number, extra = '') =>
    notes
        .flatMap((chord) =>
            chord
                .split('+')
                .map(
                    (n, i) =>
                        `<note>${i ? '<chord/>' : ''}${pitchXml(n)}<duration>1</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff>${extra}</note>`,
                ),
        )
        .join('');

export const scoreXml = ({
    rh = [],
    lh = [],
    tempo,
    title = 'Essai',
}: {
    rh?: string[];
    lh?: string[];
    tempo?: number;
    title?: string;
}) => {
    const length = Math.max(rh.length, lh.length);
    const direction = tempo
        ? `<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`
        : '';
    const backup =
        rh.length && lh.length
            ? `<backup><duration>${rh.length}</duration></backup>`
            : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><work><work-title>${title}</work-title></work><identification><creator type="composer">Anonyme</creator></identification><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>${length}</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>${direction}${staffXml(rh, 1)}${backup}${staffXml(lh, 2)}</measure></part></score-partwise>`;
};
