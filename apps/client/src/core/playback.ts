import { type ScoreNote, kids } from './musicxml';

/**
 * Notes à jouer pour écouter une partition : temps en secondes (tempos de
 * la partition, accélérés ou ralentis), nuances et accents, notes liées
 * tenues d'un seul coup, staccatos raccourcis, points d'orgue allongés.
 * Sans reprises.
 */

export interface PlayNote {
    key: string;
    midi: number;
    /** Début, en secondes depuis le départ de la lecture. */
    start: number;
    /** Durée, en secondes. */
    dur: number;
    /** Force de frappe, de 0 à 1 (mf : 0,64). */
    velocity: number;
}

/** Force de frappe des nuances écrites. */
const MARKS: Record<string, number> = {
    pppp: 0.1,
    ppp: 0.18,
    pp: 0.28,
    p: 0.4,
    mp: 0.52,
    mf: 0.64,
    f: 0.76,
    ff: 0.88,
    fff: 0.96,
    ffff: 1,
    fp: 0.76,
    sf: 0.85,
    sfz: 0.85,
    sffz: 0.92,
    fz: 0.85,
    rf: 0.8,
    rfz: 0.85,
    sfp: 0.8,
};
const DEFAULT_VELOCITY = MARKS.mf!;
const ACCENT = 0.14;

/** Nuance d'une indication (`<direction>`, `<sound>`), ou null. */
const directionLevel = (el: Element): number | null => {
    const sound =
        el.localName === 'sound' ? el : el.querySelector('sound[dynamics]');
    const value = Number(sound?.getAttribute('dynamics'));
    // En pourcentage du forte (100 = f = vélocité MIDI 90).
    if (value > 0) return Math.min(1, (value * 0.9) / 127);
    const mark = el.querySelector('dynamics > *')?.localName;
    return mark ? (MARKS[mark] ?? null) : null;
};

/**
 * Force de frappe de chaque note : la dernière nuance indiquée dans sa
 * partie (ordre du fichier), plus un accent éventuel.
 */
export const noteVelocities = (doc: Document) => {
    const velocities = new Map<Element, number>();
    for (const part of doc.querySelectorAll('part')) {
        let level = DEFAULT_VELOCITY;
        for (const measure of kids(part, 'measure')) {
            for (const el of Array.from(measure.children)) {
                if (el.localName === 'direction' || el.localName === 'sound') {
                    level = directionLevel(el) ?? level;
                } else if (el.localName === 'note') {
                    const own = Number(el.getAttribute('dynamics'));
                    const base =
                        own > 0 ? Math.min(1, (own * 0.9) / 127) : level;
                    const accent = el.querySelector(
                        'articulations > accent, articulations > strong-accent',
                    );
                    velocities.set(
                        el,
                        Math.min(1, base + (accent ? ACCENT : 0)),
                    );
                }
            }
        }
    }
    return velocities;
};

/**
 * Secondes écoulées depuis le début, pour un temps en noires. Les tempos
 * sont ceux de la première partie (les autres n'en indiquent souvent pas).
 */
export const timeline = (notes: ScoreNote[], factor = 1) => {
    const first = Math.min(...notes.map((n) => n.part));
    const changes: { t: number; tempo: number }[] = [];
    for (const n of notes
        .filter((n) => n.part === first)
        .sort((a, b) => a.t - b.t)) {
        const last = changes.at(-1);
        if (!last) changes.push({ t: 0, tempo: n.tempo });
        else if (n.tempo !== last.tempo) {
            if (n.t > last.t) changes.push({ t: n.t, tempo: n.tempo });
            else last.tempo = n.tempo;
        }
    }
    if (!changes.length) changes.push({ t: 0, tempo: 100 });
    return (t: number) => {
        let seconds = 0;
        for (const [i, c] of changes.entries()) {
            const end = Math.min(t, changes[i + 1]?.t ?? Infinity);
            if (end <= c.t) break;
            seconds += ((end - c.t) * 60) / (c.tempo * factor);
        }
        return seconds;
    };
};

/** Note liée à la précédente (elle la prolonge, sans nouvelle attaque). */
const tiedFromBefore = (n: ScoreNote) =>
    !!n.el.querySelector?.('tie[type="stop"]');

export const playNotes = (
    notes: ScoreNote[],
    { from = 0, factor = 1 }: { from?: number; factor?: number } = {},
): PlayNote[] => {
    if (!notes.length) return [];
    const seconds = timeline(notes, factor);
    const velocities = noteVelocities(notes[0]!.el.ownerDocument);
    const origin = seconds(from);
    const sorted = [...notes].sort((a, b) => a.t - b.t || a.midi - b.midi);
    /** Dernière note jouée par hauteur, pour les liaisons de prolongation. */
    const sounding = new Map<string, { note: PlayNote; end: number }>();
    const out: PlayNote[] = [];
    for (const n of sorted) {
        const pitch = `${n.part}|${n.midi}`;
        const end = n.t + n.dur * (n.fermata ? 1.5 : n.stacc ? 0.5 : 1);
        const held = sounding.get(pitch);
        if (
            tiedFromBefore(n) &&
            held &&
            Math.abs(held.end - n.t) < 1e-3 &&
            n.t >= from
        ) {
            held.note.dur = seconds(end) - seconds(n.t) + held.note.dur;
            held.end = n.t + n.dur;
            continue;
        }
        if (n.t < from) continue;
        const note: PlayNote = {
            key: n.key,
            midi: n.midi,
            start: seconds(n.t) - origin,
            dur: Math.max(0.05, seconds(end) - seconds(n.t)),
            velocity: velocities.get(n.el) ?? DEFAULT_VELOCITY,
        };
        out.push(note);
        sounding.set(pitch, { note, end: n.t + n.dur });
    }
    return out;
};
