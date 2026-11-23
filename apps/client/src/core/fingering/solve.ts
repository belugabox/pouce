import {
    type FingerState,
    type GroupInfo,
    type Hand,
    context,
    localCost,
    transCost,
} from './costs';

/** Un accord (ou une note seule) à doigter, notes du grave à l'aigu. */
export interface SolveGroup {
    keys: string[];
    pitches: number[];
    info: GroupInfo | null;
}

/** Combinaisons croissantes de `k` doigts parmi 1 à 5. */
const combos = (k: number): FingerState[] => {
    const out: FingerState[] = [];
    const rec = (start: number, acc: number[]) => {
        if (acc.length === k) {
            out.push(acc.slice());
            return;
        }
        for (let f = start; f <= 5; f++) {
            acc.push(f);
            rec(f + 1, acc);
            acc.pop();
        }
    };
    rec(1, []);
    return out;
};

/** Au plus 5 notes doigtées par accord (les plus graves). */
const MAX = 5;

/**
 * Suite de doigts de moindre effort pour toute une portée (Viterbi).
 * `locked` : doigtés imposés (saisis par la personne), respectés quand ils
 * sont possibles. Renvoie un doigt par clé.
 */
export const solve = (
    groups: SolveGroup[],
    hand: Hand,
    locked: Record<string, number> = {},
): Record<string, number> => solveWithCost(groups, hand, locked).fingers;

/** Comme `solve`, avec l'effort total du doigté trouvé. */
export const solveWithCost = (
    groups: SolveGroup[],
    hand: Hand,
    locked: Record<string, number> = {},
): { fingers: Record<string, number>; cost: number } => {
    if (!groups.length) return { fingers: {}, cost: 0 };
    const pitches = groups.map((g) => g.pitches.slice(0, MAX));
    const states = groups.map((g, gi) => {
        let cs = combos(pitches[gi]!.length);
        // Main gauche : les notes graves reçoivent les grands numéros.
        if (hand === 2) cs = cs.map((s) => s.slice().reverse());
        const fixed = cs.filter((s) =>
            s.every((f, i) => {
                const want = locked[g.keys[i]!];
                return !want || want === f;
            }),
        );
        return fixed.length ? fixed : cs;
    });

    let prev = states[0]!.map((s) => ({
        cost: localCost(pitches[0]!, s),
        back: -1,
    }));
    const trail = [prev];
    for (let i = 1; i < groups.length; i++) {
        const ctx = context(groups[i - 1]!.info, groups[i]!.info);
        const before = prev;
        const cur = states[i]!.map((s) => {
            const lc = localCost(pitches[i]!, s);
            let best = Infinity;
            let bi = 0;
            states[i - 1]!.forEach((sp, j) => {
                const v =
                    before[j]!.cost +
                    transCost(pitches[i - 1]!, sp, pitches[i]!, s, hand, ctx);
                if (v < best) {
                    best = v;
                    bi = j;
                }
            });
            return { cost: best + lc, back: bi };
        });
        trail.push(cur);
        prev = cur;
    }

    const out: Record<string, number> = {};
    let idx = prev.reduce((b, s, i) => (s.cost < prev[b]!.cost ? i : b), 0);
    const cost = prev[idx]!.cost;
    for (let i = groups.length - 1; i >= 0; i--) {
        const st = states[i]![idx]!;
        st.forEach((f, j) => (out[groups[i]!.keys[j]!] = f));
        idx = trail[i]![idx]!.back;
    }
    return { fingers: out, cost };
};
