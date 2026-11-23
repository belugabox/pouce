/** Petites mises en forme partagées par la recherche et l'éditeur. */

export const LEVEL_COLORS: Record<string, string> = {
    Débutant: 'teal',
    Facile: 'blue',
    Intermédiaire: 'orange',
    Avancé: 'red',
};

/** « 2 min 30 s » */
export const formatDuration = (seconds: number) => {
    const s = Math.round(seconds);
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest ? `${m} min ${String(rest).padStart(2, '0')} s` : `${m} min`;
};
