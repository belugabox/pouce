import type { Hand } from './fingering/costs';
import { solveWithCost } from './fingering/solve';
import { groupsFor } from './fingering/suggest';
import type { ScoreIndex } from './musicxml';

/**
 * Difficulté estimée d'une partition de piano, de 0 (premières leçons) à 10
 * (virtuose), d'après ce qui rend un morceau difficile à jouer : vitesse,
 * accords et écarts, sauts, touches noires, voix multiples dans une main,
 * indépendance des mains, et l'effort du meilleur doigté trouvé par le
 * moteur. Les poids sont réglés à la main sur des morceaux connus
 * (`difficulty.test.ts`).
 */

export const LEVELS = [
    'Débutant',
    'Facile',
    'Intermédiaire',
    'Avancé',
] as const;
export type Level = (typeof LEVELS)[number];

export interface DifficultyFeatures {
    /** Attaques par seconde dans les passages rapides (une main). */
    fastRate: number;
    /** Attaques par seconde en moyenne (deux mains). */
    rate: number;
    /** Part des attaques en accord (au moins 3 notes). */
    chords: number;
    /** Plus grand écart dans un accord d'une main (demi-tons, 95e centile). */
    span: number;
    /** Sauts rapides (demi-tons, 90e centile). */
    leaps: number;
    /** Part de notes sur les touches noires. */
    black: number;
    /** Part des attaques jouées pendant qu'une autre note de la main tient. */
    voices: number;
    /** Part du temps où les deux mains jouent des rythmes différents. */
    independence: number;
    /** Effort moyen du doigté, par attaque. */
    effort: number;
    /** Durée estimée, en secondes. */
    duration: number;
    measures: number;
}

export interface Difficulty {
    score: number;
    level: Level;
    features: DifficultyFeatures;
}

const BLACK = new Set([1, 3, 6, 8, 10]);

const quantile = (values: number[], q: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};

/** Niveau correspondant à un score. */
export const levelOf = (score: number): Level =>
    score < 2.2
        ? 'Débutant'
        : score < 4.5
          ? 'Facile'
          : score < 6.5
            ? 'Intermédiaire'
            : 'Avancé';

/** Ce qui rend la partition difficile, main par main. */
export const difficultyFeatures = (index: ScoreIndex): DifficultyFeatures => {
    const { notes } = index;
    const measures = new Set(notes.map((n) => `${n.part}|${n.measure}`)).size;
    // Secondes par noire, au tempo de chaque note.
    const sec = (quarters: number, tempo: number) => (quarters * 60) / tempo;

    const fast: number[] = [];
    const leaps: number[] = [];
    const spans: number[] = [];
    let groupsTotal = 0;
    let chordGroups = 0;
    let overlapped = 0;
    let effort = 0;
    const onsetsByHand: Set<string>[] = [new Set(), new Set()];

    for (const hand of [1, 2] as Hand[]) {
        const groups = groupsFor(notes, hand);
        if (!groups.length) continue;
        groupsTotal += groups.length;
        effort += solveWithCost(groups, hand).cost;
        let sounding = 0;
        groups.forEach((g, i) => {
            if (!g.info) return;
            const { t, dur, tempo } = g.info;
            onsetsByHand[hand - 1]!.add(t.toFixed(3));
            const size = g.pitches.length;
            if (size >= 3) chordGroups++;
            if (size >= 2) spans.push(g.pitches[size - 1]! - g.pitches[0]!);
            if (t < sounding - 1e-6) overlapped++;
            sounding = Math.max(sounding, t + dur);
            if (i === 0) return;
            const prev = groups[i - 1]!;
            if (!prev.info) return;
            const gap = sec(t - prev.info.t, tempo);
            if (gap <= 0) return;
            // Le passage le plus rapide : écart entre deux attaques voisines.
            if (gap < 2) fast.push(1 / gap);
            if (gap < 0.6) {
                const center = (p: number[]) => (p[0]! + p[p.length - 1]!) / 2;
                leaps.push(Math.abs(center(g.pitches) - center(prev.pitches)));
            }
        });
    }

    // Durée : chaque intervalle entre deux attaques, à son tempo.
    const onsets = new Map<number, number>();
    for (const n of notes) onsets.set(n.t, n.tempo);
    const times = [...onsets.keys()].sort((a, b) => a - b);
    let duration = 0;
    times.forEach((t, i) => {
        const next =
            times[i + 1] ??
            Math.max(
                t,
                ...notes.filter((n) => n.t === t).map((n) => n.t + n.dur),
            );
        duration += sec(next - t, onsets.get(t)!);
    });
    const [rh, lh] = onsetsByHand as [Set<string>, Set<string>];
    const both = new Set([...rh, ...lh]);
    const shared = [...rh].filter((t) => lh.has(t)).length;
    // Les deux mains jouent, sans attaquer ensemble.
    const independence =
        rh.size && lh.size ? 1 - shared / Math.max(1, both.size) : 0;

    return {
        fastRate: quantile(fast, 0.9),
        rate: duration ? groupsTotal / duration : 0,
        chords: groupsTotal ? chordGroups / groupsTotal : 0,
        span: quantile(spans, 0.95),
        leaps: quantile(leaps, 0.9),
        black: notes.length
            ? notes.filter((n) => BLACK.has(((n.midi % 12) + 12) % 12)).length /
              notes.length
            : 0,
        voices: groupsTotal ? overlapped / groupsTotal : 0,
        independence,
        effort: groupsTotal ? effort / groupsTotal : 0,
        duration,
        measures,
    };
};

const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

/** Score de 0 à 10 et niveau. */
export const estimateDifficulty = (index: ScoreIndex): Difficulty => {
    const f = difficultyFeatures(index);
    const parts = [
        // Vitesse : 2 attaques/s, facile ; 10/s, virtuose.
        2.2 * clamp((f.fastRate - 2) / 8, 0, 1.3),
        1.0 * clamp((f.rate - 1.5) / 6, 0, 1.2),
        // Accords et écarts : l'octave est courante, au-delà il faut une
        // grande main.
        1.2 * clamp(f.chords / 0.4, 0, 1),
        1.0 * clamp((f.span - 10) / 7, 0, 1.2),
        // Sauts rapides.
        1.0 * clamp((f.leaps - 4) / 12, 0, 1.2),
        1.0 * clamp(f.black / 0.35, 0, 1),
        // Plusieurs voix dans une main : tenir une note pendant que les
        // autres bougent.
        1.4 * clamp(f.voices / 0.35, 0, 1),
        0.8 * clamp(f.independence / 0.6, 0, 1),
        // Effort du doigté (changements de position, passages du pouce…).
        1.2 * clamp(f.effort / 6, 0, 1.3),
        // Longueur : un morceau long demande plus d'endurance et de mémoire.
        0.4 * clamp((f.measures - 16) / 100, 0, 1),
    ];
    const score =
        Math.round(
            clamp(
                parts.reduce((a, b) => a + b, 0),
                0,
                10,
            ) * 10,
        ) / 10;
    return { score, level: levelOf(score), features: f };
};
