import type { Fingerings, ScoreNote } from '../musicxml';
import type { GroupInfo, Hand } from './costs';
import { type HandChoice, type HandMap, handResolver } from './hands';
import { type SolveGroup, solve } from './solve';

/** Main d'une note : le choix par défaut d'après la forme de la partition. */
export type HandOf = (n: Pick<ScoreNote, 'part' | 'staff'>) => HandChoice;

const groupInfo = (notes: ScoreNote[], tempoFactor: number): GroupInfo => ({
    t: notes[0]!.t,
    dur: Math.max(...notes.map((n) => n.dur)),
    tempo: notes[0]!.tempo * tempoFactor,
    slur: notes.find((n) => n.slur !== null)?.slur ?? null,
    slurEnd: notes.some((n) => n.slurEnd),
    stacc: notes.some((n) => n.stacc),
    fermata: notes.some((n) => n.fermata),
});

/**
 * Accords d'une main, dans l'ordre de jeu, notes du grave à l'aigu.
 * `tempoFactor` : tempo choisi pour la suggestion / tempo écrit.
 */
export const groupsFor = (
    notes: ScoreNote[],
    hand: Hand,
    handOf: HandOf = handResolver(notes),
    tempoFactor = 1,
): SolveGroup[] => {
    const byGroup = new Map<string, ScoreNote[]>();
    for (const n of notes) {
        if (handOf(n) !== hand) continue;
        // Deux portées jouées par la même main : un seul fil de notes.
        const group = `${n.part}|${n.measure}|${n.onset.toFixed(4)}`;
        if (!byGroup.has(group)) byGroup.set(group, []);
        byGroup.get(group)!.push(n);
    }
    return Array.from(byGroup.values())
        .sort(
            (a, b) =>
                a[0]!.part - b[0]!.part ||
                a[0]!.measure - b[0]!.measure ||
                a[0]!.onset - b[0]!.onset,
        )
        .map((chord) => {
            chord.sort((a, b) => a.midi - b.midi);
            return {
                keys: chord.map((n) => n.key),
                pitches: chord.map((n) => n.midi),
                info: groupInfo(chord, tempoFactor),
            };
        });
};

/** Réglages de la suggestion, propres à chaque partition. */
export interface SuggestOptions {
    /** Main de chaque portée (sinon le choix par défaut). */
    hands?: HandMap;
    /** Tempo de jeu (noires par minute) ; sinon celui de la partition. */
    tempo?: number;
    /** Tempo écrit dans la partition (pour garder ses changements). */
    scoreTempo?: number;
}

export interface Annotations {
    /** Doigtés affichés (saisis et suggérés). */
    f: Fingerings;
    /** Clés des doigtés suggérés (pas encore confirmés). */
    auto: Record<string, 1>;
}

/**
 * Remplit toutes les notes sans doigté saisi. Les doigtés saisis sont
 * imposés ; les suggestions précédentes sont recalculées.
 */
export const suggestAll = (
    notes: ScoreNote[],
    current: Annotations,
    { hands, tempo, scoreTempo }: SuggestOptions = {},
) => {
    const locked: Fingerings = {};
    for (const [k, v] of Object.entries(current.f)) {
        if (!current.auto[k]) locked[k] = v;
    }
    const handOf = handResolver(notes, hands);
    const factor = tempo && scoreTempo ? tempo / scoreTempo : 1;
    const result = {
        ...solve(groupsFor(notes, 1, handOf, factor), 1, locked),
        ...solve(groupsFor(notes, 2, handOf, factor), 2, locked),
    };
    const f: Fingerings = { ...current.f };
    const auto: Record<string, 1> = {};
    let added = 0;
    for (const [k, v] of Object.entries(result)) {
        if (locked[k]) continue;
        f[k] = v;
        auto[k] = 1;
        added++;
    }
    return { annotations: { f, auto }, added };
};

/** Retire les doigtés suggérés, garde ceux saisis. */
export const clearSuggestions = ({ f, auto }: Annotations): Annotations => ({
    f: Object.fromEntries(Object.entries(f).filter(([k]) => !auto[k])),
    auto: {},
});

/** Saisit (ou efface, avec 0) le doigté d'une note : il n'est plus suggéré. */
export const assignFinger = (
    { f, auto }: Annotations,
    key: string,
    finger: number,
): Annotations => {
    const nextF = { ...f };
    const nextAuto = { ...auto };
    if (finger) nextF[key] = finger;
    else delete nextF[key];
    delete nextAuto[key];
    return { f: nextF, auto: nextAuto };
};
