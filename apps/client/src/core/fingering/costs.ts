/**
 * Coûts du moteur de doigtés, repris tels quels du prototype : ce réglage
 * donne les doigtés vérifiés (gamme de do, Menuet en sol). Toute retouche
 * doit garder les tests de `suggest.test.ts`.
 */

/** 1 : main droite, 2 : main gauche. */
export type Hand = 1 | 2;

/** Suite de doigts (1 à 5) d'un accord, du grave à l'aigu. */
export type FingerState = number[];

/**
 * Demi-tons entre la note la plus grave de la main et chaque doigt (index 1
 * à 5), main posée en position « do ré mi fa sol ».
 */
const OFF: Record<Hand, number[]> = {
    1: [0, 0, 2, 4, 5, 7],
    2: [0, 7, 5, 4, 2, 0],
};

/** Écart confortable maximum, en demi-tons, par paire de doigts. */
const SPAN: Record<string, number> = {
    '12': 7,
    '13': 9,
    '14': 10,
    '15': 12,
    '23': 4,
    '24': 5,
    '25': 7,
    '34': 3,
    '35': 5,
    '45': 3,
};

const BLACK = new Set([1, 3, 6, 8, 10]);

export const spanOf = (a: number, b: number) =>
    SPAN[a < b ? `${a}${b}` : `${b}${a}`] ?? 12;

/** Coût d'un accord seul : touches noires, écarts entre doigts. */
export const localCost = (pitches: number[], st: FingerState) => {
    let c = 0;
    pitches.forEach((p, i) => {
        if (BLACK.has(p % 12)) {
            if (st[i] === 1) c += 2;
            if (st[i] === 5) c += 1;
        }
    });
    for (let i = 1; i < pitches.length; i++) {
        const iv = pitches[i]! - pitches[i - 1]!;
        const fa = st[i - 1]!;
        const fb = st[i]!;
        c += 2 * Math.max(0, iv - spanOf(fa, fb));
        c += 0.6 * Math.max(0, Math.abs(fa - fb) * 1.5 - iv - 1);
        c +=
            0.4 *
            Math.abs(
                Math.min(4, Math.max(1, Math.round(iv / 2))) -
                    Math.abs(fa - fb),
            );
    }
    return c;
};

/** Position estimée de la main (note sous le pouce, en demi-tons). */
export const handPos = (pitches: number[], st: FingerState, hand: Hand) => {
    let s = 0;
    pitches.forEach((p, i) => (s += p - OFF[hand][st[i]!]!));
    return s / pitches.length;
};

/** Ce que la musique dit d'un groupe (accord ou note seule). */
export interface GroupInfo {
    /** Attaque, en noires. */
    t: number;
    /** Durée, en noires. */
    dur: number;
    tempo: number;
    slur: number | null;
    slurEnd: boolean;
    stacc: boolean;
    fermata: boolean;
}

/** Liberté de la main entre deux groupes. */
export interface TransitionContext {
    shiftW: number;
    sameW: number;
    crossW: number;
    fastRepeat: boolean;
}

export const DEFAULT_CTX: TransitionContext = {
    shiftW: 0.7,
    sameW: 6,
    crossW: 1,
    fastRepeat: false,
};

/**
 * Liberté de la main entre deux groupes, d'après le tempo, les silences,
 * les liaisons et l'articulation.
 */
export const context = (
    a: GroupInfo | null,
    b: GroupInfo | null,
): TransitionContext => {
    if (!a || !b) return DEFAULT_CTX;
    const spq = 60 / (b.tempo || 100);
    // Secondes entre les deux attaques, et silence entre les deux.
    const ioi = Math.max(0.05, (b.t - a.t) * spq);
    const silence = (b.t - (a.t + a.dur)) * spq;
    const brk =
        silence >= 0.2 ||
        a.fermata ||
        a.slurEnd ||
        (!!a.slur && !!b.slur && a.slur !== b.slur);
    const legato = !!a.slur && a.slur === b.slur;
    const speed = Math.min(2, Math.max(0.35, 0.3 / ioi));
    return {
        shiftW: 0.7 * speed * (brk ? 0.15 : 1) * (legato ? 1.3 : 1),
        sameW: 6 * (brk ? 0.2 : 1) * (legato ? 1.5 : 1) * (a.stacc ? 0.3 : 1),
        crossW: brk ? 0.3 : 1,
        fastRepeat: ioi < 0.25,
    };
};

/** Coût du passage d'un groupe au suivant. */
export const transCost = (
    ga: number[],
    sa: FingerState,
    gb: number[],
    sb: FingerState,
    hand: Hand,
    ctx: TransitionContext = DEFAULT_CTX,
) => {
    let c =
        ctx.shiftW * Math.abs(handPos(gb, sb, hand) - handPos(ga, sa, hand));
    ga.forEach((pa, i) =>
        gb.forEach((pb, j) => {
            if (sa[i] === sb[j] && pa !== pb) {
                c += ctx.sameW / Math.max(ga.length, gb.length);
            }
        }),
    );
    if (ga.length === 1 && gb.length === 1) {
        const pa = ga[0]!;
        const pb = gb[0]!;
        const fa = sa[0]!;
        const fb = sb[0]!;
        const d = pb - pa;
        // « Vers le haut » : le sens où les numéros de doigts montent.
        const up = hand === 1 ? d > 0 : d < 0;
        const down = hand === 1 ? d < 0 : d > 0;
        // Passage avec le pouce et `finger` (2, 3, ou 4 plus cher) ; tout
        // autre croisement coûte 8.
        const thumbPass = (finger: number) =>
            finger >= 2 && finger <= 4
                ? (finger === 4 ? 2.2 : 1) + 1.5 * Math.max(0, Math.abs(d) - 4)
                : 8;
        if (d === 0) {
            if (fa !== fb) c += ctx.fastRepeat ? 0 : 0.8;
            else if (ctx.fastRepeat) c += 1.5;
        } else if (up && fb < fa) {
            // Passage du pouce sous 2, 3 ou 4.
            c += ctx.crossW * (fb === 1 ? thumbPass(fa) : 8);
        } else if (down && fb > fa) {
            // Croisement par-dessus le pouce.
            c += ctx.crossW * (fa === 1 ? thumbPass(fb) : 8);
        } else if (fa !== fb) {
            c += ctx.crossW * 1.5 * Math.max(0, Math.abs(d) - spanOf(fa, fb));
        }
    }
    return c;
};
