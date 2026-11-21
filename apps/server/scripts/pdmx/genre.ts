import type { Genre } from '../../src/types';

/**
 * Genre d'une partition PDMX : d'après les genres déclarés (la moitié des
 * partitions de piano en ont), sinon les mots-clés, sinon le compositeur
 * reconnu (`composers.ts` : classique ou traditionnel). Musique de film et
 * de jeu vidéo : séparées d'après les mots-clés, le titre et l'auteur.
 */

/**
 * Musique de jeu vidéo, dans les mots-clés seulement : mots trop courants
 * dans un titre ou un nom (« Mario Tarenghi », « Halo »).
 */
const GAME_TAGS =
    /video ?game|\bgames?\b|\bgaming\b|\bvgm\b|nintendo|\bchiptune|\bmario|\bhalo\b|\bsonic\b|\bportal\b/;

/**
 * Jeux, séries de jeux, éditeurs et compositeurs de jeux, dans les mots-clés,
 * le titre ou l'auteur. Les mots-clés de PDMX sont souvent collés
 * (« fireemblem ») : espaces facultatives.
 */
const GAME_NAMES = new RegExp(
    [
        'undertale',
        'deltarune',
        'megalovania',
        'zelda',
        'super mario',
        'pok[eé]mon',
        'castlevania',
        'kirby',
        'touhou',
        'minecraft',
        'final fantasy',
        'kingdom hearts',
        'genshin',
        'honkai',
        'celeste(?!s)',
        'terraria',
        'hollow knight',
        'chrono (?:trigger|cross)',
        'earthbound',
        'metroid',
        'skyrim',
        'elder scrolls',
        'xenoblade',
        'animal crossing',
        'splatoon',
        'fire emblem',
        'tetris',
        'cuphead',
        'five nights at freddy',
        'fnaf',
        'omori',
        'stardew',
        'doki doki',
        'fortnite',
        'roblox',
        'geometry dash',
        'street fighter',
        'mega man',
        'donkey kong',
        'smash bros',
        'league of legends',
        'warcraft',
        'blizzard',
        'overwatch',
        'mabinogi',
        'riot games',
        'computer games',
        'toby fox',
        'koji kondo',
        'nobuo uematsu',
        'yoko shimomura',
        'yasunori mitsuda',
        'c418',
        'lena raine',
        'hoyo-?mix',
        'mihoyo',
        'darren korb',
    ]
        .map((name) => name.replace(/ /g, ' ?'))
        .join('|'),
);

/** Musique de film, de série ou d'anime, dans les mots-clés. */
const SCREEN_TAGS =
    /anime|\bost\b|soundtrack|disney|pixar|movie|\bfilm|cinema|ghibli|\btv\b/;

/** Genres de PDMX, du plus distinctif au moins distinctif. */
const DECLARED: [RegExp, Genre][] = [
    [/\bjazz\b/, 'Jazz'],
    [
        /\b(?:pop|rock|metal|electronic|rbfunksoul|hiphop|country|newage)\b/,
        'Pop et rock',
    ],
    [/\breligiousmusic\b/, 'Religieux'],
    [/\b(?:folk|worldmusic)\b/, 'Traditionnel'],
];

/** Mots-clés libres : avant « classical », mis à tort sur beaucoup de partitions. */
const TAGGED: [RegExp, Genre][] = [
    [/jazz|ragtime|\brag\b|blues|swing|boogie|tango/, 'Jazz'],
    [
        /hymn|gospel|church|worship|christian|liturg|kirche|catholic|psalm|himno/,
        'Religieux',
    ],
    [
        /folk|volkslied|traditional|kinderlied|carol|christmas|noel/,
        'Traditionnel',
    ],
    [/\bk ?pop\b|\bpop\b|\brock\b/, 'Pop et rock'],
];

export const genreOf = (
    declared: string,
    tags: string,
    /** Comment le compositeur a été reconnu (`Attribution.how`), ou null. */
    how: string | null,
    /** Titre et auteur : noms de jeux et de compositeurs de jeux. */
    name = '',
): Genre => {
    const d = declared.toLowerCase();
    const t = tags.toLowerCase().replace(/[-_,]+/g, ' ');
    const game =
        GAME_TAGS.test(t) || GAME_NAMES.test(`${t} ${name.toLowerCase()}`);
    // Bande originale déclarée : film ou jeu.
    if (/\bsoundtrack\b/.test(d)) {
        return game ? 'Jeux vidéo' : 'Films et séries';
    }
    for (const [re, genre] of DECLARED) if (re.test(d)) return genre;
    if (game) return 'Jeux vidéo';
    if (SCREEN_TAGS.test(t)) return 'Films et séries';
    for (const [re, genre] of TAGGED) if (re.test(t)) return genre;
    if (/\bclassical\b/.test(d)) return 'Classique';
    if (how === 'traditional') return 'Traditionnel';
    if (how === 'composer' || how === 'dates' || how === 'title') {
        return 'Classique';
    }
    return 'Autres';
};
