/**
 * Lecture d'une partition MusicXML (format « partwise ») : une entrée par
 * note jouée (ni silence, ni appoggiature, ni note « cue »), avec ce dont le
 * moteur de doigtés a besoin.
 *
 * Chaque note a une clé `partie|mesure|portée|attaque|rang` :
 * - attaque : position dans la mesure, en rondes (4 décimales), comme le
 *   `Timestamp.RealValue` d'OpenSheetMusicDisplay ;
 * - rang : place de la note dans son accord (même portée, même attaque),
 *   du grave à l'aigu.
 * Le rendu (OSMD) calcule la même clé : c'est elle qui relie une note
 * dessinée à son doigté.
 */

export interface ScoreNote {
    key: string;
    /** Clé de l'accord (la clé sans le rang). */
    group: string;
    part: number;
    /** Index de la mesure dans la partie (0 = première). */
    measure: number;
    /** Portée (1 = haut). */
    staff: number;
    /** Attaque dans la mesure, en rondes. */
    onset: number;
    rank: number;
    /** Nombre de notes de l'accord. */
    size: number;
    midi: number;
    /** Attaque depuis le début, en noires. */
    t: number;
    /** Durée, en noires. */
    dur: number;
    /** Tempo en vigueur (noires par minute). */
    tempo: number;
    /** Liaison (identifiant) à laquelle la note appartient. */
    slur: number | null;
    /** Une liaison se termine sur cette note. */
    slurEnd: boolean;
    stacc: boolean;
    fermata: boolean;
    el: Element;
}

export interface ScoreIndex {
    notes: ScoreNote[];
    byKey: Map<string, ScoreNote>;
    /** Premier tempo indiqué (100 sans indication). */
    tempo: number;
}

export const DEFAULT_TEMPO = 100;

const STEP: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};

export const kids = (el: Element, name: string) =>
    Array.from(el.children).filter((c) => c.localName === name);

export const kid = (el: Element, name: string): Element | null =>
    kids(el, name)[0] ?? null;

const num = (el: Element | null, fallback = 0) => {
    const value = Number(el?.textContent ?? NaN);
    return Number.isFinite(value) ? value : fallback;
};

/** Noire = 1 : facteur de l'unité du métronome. */
const BEAT_UNIT: Record<string, number> = {
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    '16th': 0.25,
};

/** Tempo d'une indication (`<sound tempo>` ou métronome), sinon null. */
const readTempo = (el: Element): number | null => {
    const sound =
        el.localName === 'sound' && el.hasAttribute('tempo')
            ? el
            : el.querySelector('sound[tempo]');
    const fromSound = Number(sound?.getAttribute('tempo'));
    if (fromSound > 0) return fromSound;
    const perMinute = num(el.querySelector('metronome per-minute'));
    if (perMinute <= 0) return null;
    const unit =
        el.querySelector('metronome beat-unit')?.textContent?.trim() ?? '';
    const dotted = el.querySelector('metronome beat-unit-dot') ? 1.5 : 1;
    return perMinute * (BEAT_UNIT[unit] ?? 1) * dotted;
};

export const parseXml = (xml: string): Document =>
    new DOMParser().parseFromString(xml, 'application/xml');

/** Indexe toutes les notes jouées de la partition. */
export const indexScore = (doc: Document): ScoreIndex => {
    const notes: ScoreNote[] = [];
    let firstTempo: number | null = null;
    let slurSeq = 0;

    kids(doc.documentElement, 'part').forEach((part, pi) => {
        let divisions = 1;
        let measureStart = 0;
        let tempo = DEFAULT_TEMPO;
        // Liaisons ouvertes : numéro dans le fichier → identifiant unique.
        const open = new Map<string, number>();

        kids(part, 'measure').forEach((measure, mi) => {
            let pos = 0;
            let last = 0;
            let maxPos = 0;
            const groups = new Map<
                string,
                Omit<ScoreNote, 'rank' | 'size' | 'key'>[]
            >();

            for (const el of Array.from(measure.children)) {
                switch (el.localName) {
                    case 'attributes': {
                        const d = num(kid(el, 'divisions'));
                        if (d > 0) divisions = d;
                        break;
                    }
                    case 'direction':
                    case 'sound': {
                        const value = readTempo(el);
                        if (value) tempo = value;
                        firstTempo ??= value;
                        break;
                    }
                    case 'backup':
                        pos -= num(kid(el, 'duration'));
                        break;
                    case 'forward':
                        pos += num(kid(el, 'duration'));
                        maxPos = Math.max(maxPos, pos);
                        break;
                    case 'note': {
                        // Appoggiature : sans durée, pas jouée par le moteur.
                        if (kid(el, 'grace')) break;
                        const chord = kid(el, 'chord');
                        const dur = num(kid(el, 'duration'));
                        const onset = chord ? last : pos;
                        if (!chord) {
                            last = pos;
                            pos += dur;
                            maxPos = Math.max(maxPos, pos);
                        }
                        // Note « cue » : prend son temps, mais n'est pas jouée.
                        if (kid(el, 'cue')) break;
                        // Une note appartient à la liaison ouverte pendant
                        // qu'elle sonne (y compris celle qui finit sur elle).
                        let slur: number | null = null;
                        let slurEnd = false;
                        const slurs = Array.from(
                            el.querySelectorAll('notations > slur'),
                        );
                        for (const s of slurs) {
                            const n = s.getAttribute('number') ?? '1';
                            if (
                                s.getAttribute('type') === 'stop' &&
                                open.has(n)
                            ) {
                                slur ??= open.get(n)!;
                                open.delete(n);
                                slurEnd = true;
                            }
                        }
                        if (slur === null && open.size) {
                            slur = open.values().next().value ?? null;
                        }
                        for (const s of slurs) {
                            if (s.getAttribute('type') === 'start') {
                                const id = ++slurSeq;
                                open.set(s.getAttribute('number') ?? '1', id);
                                slur ??= id;
                            }
                        }
                        const pitch = kid(el, 'pitch');
                        if (!pitch) break;
                        const step =
                            kid(pitch, 'step')?.textContent?.trim() ?? '';
                        const midi =
                            12 * (num(kid(pitch, 'octave')) + 1) +
                            (STEP[step] ?? 0) +
                            num(kid(pitch, 'alter'));
                        const staff = num(kid(el, 'staff'), 1);
                        const whole = onset / divisions / 4;
                        const group = `${pi}|${mi}|${staff}|${whole.toFixed(4)}`;
                        const entry = {
                            group,
                            part: pi,
                            measure: mi,
                            staff,
                            onset: whole,
                            midi,
                            t: measureStart + onset / divisions,
                            dur: dur / divisions,
                            tempo,
                            slur,
                            slurEnd,
                            stacc: !!el.querySelector(
                                'articulations > staccato, articulations > staccatissimo, articulations > spiccato',
                            ),
                            fermata: !!el.querySelector('notations > fermata'),
                            el,
                        };
                        if (!groups.has(group)) groups.set(group, []);
                        groups.get(group)!.push(entry);
                        break;
                    }
                }
            }

            for (const chord of groups.values()) {
                chord.sort((a, b) => a.midi - b.midi);
                chord.forEach((n, rank) =>
                    notes.push({
                        ...n,
                        key: `${n.group}|${rank}`,
                        rank,
                        size: chord.length,
                    }),
                );
            }
            measureStart += maxPos / divisions;
        });
    });

    return {
        notes,
        byKey: new Map(notes.map((n) => [n.key, n])),
        tempo: firstTempo ?? DEFAULT_TEMPO,
    };
};

/** Doigté (1 à 5) par clé de note. */
export type Fingerings = Record<string, number>;

/** Doigtés déjà écrits dans la partition (`<technical><fingering>`). */
export const readFingerings = (index: ScoreIndex): Fingerings => {
    const out: Fingerings = {};
    for (const n of index.notes) {
        const text = n.el
            .querySelector('notations technical fingering')
            ?.textContent?.trim();
        if (text && /^[1-5]$/.test(text)) out[n.key] = Number(text);
    }
    return out;
};

/** Titre et compositeur écrits dans la partition. */
export const readMeta = (doc: Document) => ({
    title: (
        doc.querySelector('work-title')?.textContent ??
        doc.querySelector('movement-title')?.textContent ??
        ''
    ).trim(),
    composer: (
        doc.querySelector('creator[type="composer"]')?.textContent ?? ''
    ).trim(),
});

/** Nom de chaque partie (« Piano », « Voix »…), dans l'ordre des parties. */
export const readPartNames = (doc: Document): string[] => {
    const names = new Map<string, string>();
    for (const sp of Array.from(
        doc.querySelectorAll('part-list > score-part'),
    )) {
        const name =
            kid(sp, 'part-name')?.textContent?.trim() ||
            kid(sp, 'part-abbreviation')?.textContent?.trim() ||
            '';
        names.set(sp.getAttribute('id') ?? '', name);
    }
    return kids(doc.documentElement, 'part').map(
        (p) => names.get(p.getAttribute('id') ?? '') ?? '',
    );
};
