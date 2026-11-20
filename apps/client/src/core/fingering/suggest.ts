import type { Fingerings, ScoreNote } from '../musicxml';
import type { GroupInfo, Hand } from './costs';
import { type SolveGroup, solve } from './solve';

/** Main d'une portée : celle du haut à droite, les autres à gauche. */
export const handOf = (staff: number): Hand => (staff === 1 ? 1 : 2);

const groupInfo = (notes: ScoreNote[]): GroupInfo => ({
    t: notes[0]!.t,
    dur: Math.max(...notes.map((n) => n.dur)),
    tempo: notes[0]!.tempo,
    slur: notes.find((n) => n.slur !== null)?.slur ?? null,
    slurEnd: notes.some((n) => n.slurEnd),
    stacc: notes.some((n) => n.stacc),
    fermata: notes.some((n) => n.fermata),
});

/** Accords d'une main, dans l'ordre de jeu, notes du grave à l'aigu. */
export const groupsFor = (notes: ScoreNote[], hand: Hand): SolveGroup[] => {
    const byGroup = new Map<string, ScoreNote[]>();
    for (const n of notes) {
        if (handOf(n.staff) !== hand) continue;
        if (!byGroup.has(n.group)) byGroup.set(n.group, []);
        byGroup.get(n.group)!.push(n);
    }
    return Array.from(byGroup.values())
        .sort(
            (a, b) =>
                a[0]!.measure - b[0]!.measure || a[0]!.onset - b[0]!.onset,
        )
        .map((chord) => {
            chord.sort((a, b) => a.midi - b.midi);
            return {
                keys: chord.map((n) => n.key),
                pitches: chord.map((n) => n.midi),
                info: groupInfo(chord),
            };
        });
};

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
export const suggestAll = (notes: ScoreNote[], current: Annotations) => {
    const locked: Fingerings = {};
    for (const [k, v] of Object.entries(current.f)) {
        if (!current.auto[k]) locked[k] = v;
    }
    const result = {
        ...solve(groupsFor(notes, 1), 1, locked),
        ...solve(groupsFor(notes, 2), 2, locked),
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
