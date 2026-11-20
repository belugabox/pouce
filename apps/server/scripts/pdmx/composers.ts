/**
 * Œuvres du domaine public dans PDMX.
 *
 * La licence de PDMX est celle que la personne qui a déposé la partition a
 * déclarée : beaucoup d'arrangements de chansons récentes y sont marqués
 * « domaine public » à tort. On ne garde donc que les œuvres dont le
 * compositeur est mort avant 1956 (règle européenne : 70 ans après la mort,
 * domaine public au 1er janvier 2026) ou qui sont traditionnelles.
 * L'arrangement, lui, est publié en CC-0 ou domaine public par son auteur.
 *
 * Liste volontairement fermée : un compositeur absent fait écarter la
 * partition. Les noms ambigus (Strauss, Field, Sullivan…) exigent le prénom.
 */

export interface Composer {
    name: string;
    died: number;
    /** Formes reconnues, en minuscules sans accents (mots entiers). */
    aliases: string[];
}

/** Dernière année de mort admise. */
export const DEATH_LIMIT = 1955;

const c = (name: string, died: number, ...aliases: string[]): Composer => ({
    name,
    died,
    aliases,
});

export const COMPOSERS: Composer[] = [
    // Renaissance et baroque
    c('Josquin des Prez', 1521, 'josquin'),
    c('Tielman Susato', 1570, 'susato'),
    c('Thomas Tallis', 1585, 'tallis'),
    c('William Byrd', 1623, 'william byrd', 'byrd'),
    c('John Dowland', 1626, 'dowland'),
    c('Thomas Morley', 1602, 'thomas morley'),
    c('Orlando Gibbons', 1625, 'orlando gibbons'),
    c('Orlande de Lassus', 1594, 'lassus', 'lassusio', 'orlando di lasso'),
    c('Thoinot Arbeau', 1595, 'arbeau'),
    c('Michael Praetorius', 1621, 'praetorius'),
    c('Jan Pieterszoon Sweelinck', 1621, 'sweelinck'),
    c('Girolamo Frescobaldi', 1643, 'frescobaldi'),
    c('Claudio Monteverdi', 1643, 'monteverdi'),
    c('John Playford', 1686, 'playford'),
    c('Jean-Baptiste Lully', 1687, 'lully'),
    c('Johann Jakob Froberger', 1667, 'froberger'),
    c('Henry Purcell', 1695, 'purcell'),
    c('Arcangelo Corelli', 1713, 'corelli'),
    c('Johann Pachelbel', 1706, 'pachelbel'),
    c('Dieterich Buxtehude', 1707, 'buxtehude'),
    c('Johann Kuhnau', 1722, 'kuhnau'),
    c('Marin Marais', 1728, 'marin marais'),
    c('François Couperin', 1733, 'couperin'),
    c('Christian Petzold', 1733, 'petzold'),
    c('Domenico Zipoli', 1726, 'zipoli'),
    c('Antonio Vivaldi', 1741, 'vivaldi'),
    c('Johann Sebastian Bach', 1750, 'bach', 'j s bach', 'js bach'),
    c('Domenico Scarlatti', 1757, 'scarlatti'),
    c('Georg Friedrich Haendel', 1759, 'handel', 'haendel', 'hendel'),
    c('Georg Philipp Telemann', 1767, 'telemann'),
    c('Jean-Philippe Rameau', 1764, 'rameau'),
    c('Louis-Claude Daquin', 1772, 'daquin'),
    c('Giovanni Battista Pergolesi', 1736, 'pergolesi'),
    c('Baldassare Galuppi', 1785, 'galuppi'),
    c('Elisabeth Jacquet de La Guerre', 1729, 'jacquet de la guerre'),
    c('Turlough O’Carolan', 1738, 'carolan', 'o carolan'),
    c('Antonio Soler', 1783, 'padre soler', 'antonio soler'),
    c('Christoph Willibald Gluck', 1787, 'gluck'),
    // Classique
    c('Joseph Haydn', 1809, 'haydn'),
    c('Wolfgang Amadeus Mozart', 1791, 'mozart'),
    c('Leopold Mozart', 1787, 'leopold mozart'),
    c('Carl Philipp Emanuel Bach', 1788, 'c p e bach', 'cpe bach'),
    c('Johann Christian Bach', 1782, 'j c bach', 'johann christian bach'),
    c('Muzio Clementi', 1832, 'clementi'),
    c(
        'Daniel Gottlob Türk',
        1813,
        'turk daniel',
        'daniel gottlob turk',
        'd g turk',
    ),
    c('Ignace Pleyel', 1831, 'pleyel'),
    c('Friedrich Kuhlau', 1832, 'kuhlau'),
    c('Anton Diabelli', 1858, 'diabelli'),
    c('Ludwig van Beethoven', 1827, 'beethoven', 'betthoven', 'beethhoven'),
    c('Luigi Boccherini', 1805, 'boccherini'),
    c('Domenico Cimarosa', 1801, 'cimarosa'),
    c('Johann Nepomuk Hummel', 1837, 'hummel'),
    c('Jan Ladislav Dussek', 1812, 'dussek'),
    c('John Field', 1837, 'john field'),
    c('Carl Czerny', 1857, 'czerny', 'cerny'),
    c('Niccolò Paganini', 1840, 'paganini'),
    c('Fernando Sor', 1839, 'fernando sor'),
    c('Mauro Giuliani', 1829, 'giuliani'),
    c('Ferdinando Carulli', 1841, 'carulli'),
    c(
        'Carl Maria von Weber',
        1826,
        'weber carl maria',
        'carl maria von weber',
        'c m von weber',
    ),
    // Romantique
    c('Franz Schubert', 1828, 'schubert'),
    c('Felix Mendelssohn', 1847, 'mendelssohn', 'mendelsohn'),
    c('Frédéric Chopin', 1849, 'chopin', 'szopen'),
    c('Robert Schumann', 1856, 'schumann', 'robert schumann'),
    c('Clara Schumann', 1896, 'clara schumann', 'clara wieck'),
    c('Franz Liszt', 1886, 'liszt'),
    c('Johannes Brahms', 1897, 'brahms'),
    c('Gioachino Rossini', 1868, 'rossini'),
    c('Vincenzo Bellini', 1835, 'bellini'),
    c('Gaetano Donizetti', 1848, 'donizetti'),
    c('Giuseppe Verdi', 1901, 'verdi'),
    c('Richard Wagner', 1883, 'wagner'),
    c('Hector Berlioz', 1869, 'berlioz'),
    c('Charles Gounod', 1893, 'gounod'),
    c('Georges Bizet', 1875, 'bizet'),
    c('Jacques Offenbach', 1880, 'offenbach'),
    c('Léo Delibes', 1891, 'delibes'),
    c('Jules Massenet', 1912, 'massenet'),
    c('Camille Saint-Saëns', 1921, 'saint saens', 'saint saen'),
    c('César Franck', 1890, 'cesar franck'),
    c('Emmanuel Chabrier', 1894, 'chabrier'),
    c('Benjamin Godard', 1895, 'godard benjamin', 'benjamin godard'),
    c('Adolphe Adam', 1856, 'adolphe adam'),
    c('Cécile Chaminade', 1944, 'chaminade'),
    c('Gabriel Fauré', 1924, 'faure'),
    c('Johann Strauss II', 1899, 'johann strauss'),
    c('Josef Strauss', 1870, 'josef strauss'),
    c('Richard Strauss', 1949, 'richard strauss'),
    c('Émile Waldteufel', 1915, 'waldteufel'),
    c('Iosif Ivanovici', 1902, 'ivanovici'),
    c('Franz Lehár', 1948, 'lehar'),
    c('Anton Rubinstein', 1894, 'anton rubinstein'),
    c('Mikhaïl Glinka', 1857, 'glinka'),
    c(
        'Piotr Ilitch Tchaïkovski',
        1893,
        'tchaikovsky',
        'tchaikovski',
        'tschaikowsky',
        'chaikovsky',
        'tchaikowsky',
        'tschaikovsky',
    ),
    c(
        'Modeste Moussorgski',
        1881,
        'mussorgsky',
        'moussorgsky',
        'moussorgski',
        'musorgsky',
    ),
    c('Alexandre Borodine', 1887, 'borodin', 'borodine'),
    c('Nikolaï Rimski-Korsakov', 1908, 'rimsky korsakov', 'rimski korsakov'),
    c('Mili Balakirev', 1910, 'balakirev'),
    c('Anatoli Liadov', 1914, 'lyadov', 'liadov'),
    c('Anton Arenski', 1906, 'arensky'),
    c('Alexandre Scriabine', 1915, 'scriabin', 'skryabin', 'scriabine'),
    c(
        'Sergueï Rachmaninov',
        1943,
        'rachmaninoff',
        'rachmaninov',
        'rachmaninow',
        'rakhmaninov',
    ),
    c('Sergueï Prokofiev', 1953, 'prokofiev', 'prokofieff'),
    c('Nikolaï Medtner', 1951, 'medtner'),
    c('Vladimir Rebikov', 1920, 'rebikov'),
    c('Samuel Maïkapar', 1938, 'maykapar', 'maikapar'),
    c('Antonín Dvořák', 1904, 'dvorak'),
    c('Bedřich Smetana', 1884, 'smetana'),
    c('Leoš Janáček', 1928, 'janacek'),
    c('Zdeněk Fibich', 1900, 'fibich'),
    c('Edvard Grieg', 1907, 'grieg'),
    c('Christian Sinding', 1941, 'sinding'),
    c('Niels Gade', 1890, 'niels gade'),
    c('Isaac Albéniz', 1909, 'albeniz'),
    c('Enrique Granados', 1916, 'granados'),
    c('Manuel de Falla', 1946, 'de falla', 'manuel falla'),
    c('Francisco Tárrega', 1909, 'tarrega'),
    c('Pablo de Sarasate', 1908, 'sarasate'),
    c('Manuel Ponce', 1948, 'manuel ponce'),
    c('Ernesto Nazareth', 1934, 'nazareth ernesto', 'ernesto nazareth'),
    c('Louis Moreau Gottschalk', 1869, 'gottschalk'),
    c('Edward MacDowell', 1908, 'macdowell', 'mac dowell'),
    c('Stephen Foster', 1864, 'stephen foster', 'stephen c foster'),
    c('John Philip Sousa', 1932, 'sousa'),
    c('Scott Joplin', 1917, 'joplin'),
    c('Joseph Lamb', 1960, 'joseph lamb'), // exclu par l'année (voir DEATH_LIMIT)
    c('Edward Elgar', 1934, 'elgar'),
    c('Gustav Holst', 1934, 'holst'),
    c('Frederick Delius', 1934, 'delius'),
    c('Hubert Parry', 1918, 'hubert parry', 'c h h parry'),
    c('Arthur Sullivan', 1900, 'arthur sullivan'),
    c('Edward German', 1936, 'edward german'),
    c('Gustav Mahler', 1911, 'mahler'),
    c('Anton Bruckner', 1896, 'bruckner'),
    c('Hugo Wolf', 1903, 'hugo wolf'),
    c('Max Reger', 1916, 'reger'),
    c('Giacomo Puccini', 1924, 'puccini'),
    c('Pietro Mascagni', 1945, 'mascagni'),
    c('Ruggero Leoncavallo', 1919, 'leoncavallo'),
    c('Ottorino Respighi', 1936, 'respighi'),
    c('Claude Debussy', 1918, 'debussy', 'claude achille debussy'),
    c('Erik Satie', 1925, 'satie'),
    c('Maurice Ravel', 1937, 'ravel'),
    c('Albert Roussel', 1937, 'roussel'),
    c('Paul Dukas', 1935, 'dukas'),
    c('Vincent d’Indy', 1931, 'd indy', 'vincent d indy'),
    c('Ernest Chausson', 1899, 'chausson'),
    c('Reynaldo Hahn', 1947, 'reynaldo hahn'),
    c('Béla Bartók', 1945, 'bartok'),
    c('Arnold Schoenberg', 1951, 'schoenberg', 'schonberg'),
    c('Alban Berg', 1935, 'alban berg'),
    c('Anton Webern', 1945, 'webern'),
    c('Ferruccio Busoni', 1924, 'busoni'),
    c('Moritz Moszkowski', 1925, 'moszkowski'),
    c('Ignacy Jan Paderewski', 1941, 'paderewski'),
    c('Xaver Scharwenka', 1924, 'scharwenka'),
    c('Theodor Kirchner', 1903, 'theodor kirchner'),
    c('Stephen Heller', 1888, 'stephen heller'),
    c('Cornelius Gurlitt', 1901, 'gurlitt'),
    c('Friedrich Burgmüller', 1874, 'burgmuller', 'burgmueller'),
    c('Jean-Baptiste Duvernoy', 1880, 'duvernoy'),
    c('Henry Lemoine', 1854, 'lemoine'),
    c('Louis Streabbog', 1886, 'streabbog'),
    c('Henri Bertini', 1876, 'bertini'),
    c('Louis Köhler', 1886, 'kohler louis', 'louis kohler'),
    c('Félix Le Couppey', 1887, 'le couppey'),
    c('Albert Biehl', 1899, 'biehl'),
    c('Theodor Oesten', 1870, 'oesten'),
    c('Carl Reinecke', 1910, 'reinecke'),
    c('Fritz Spindler', 1905, 'spindler'),
    c('Hermann Berens', 1880, 'berens'),
    c('Tekla Bądarzewska', 1861, 'badarzewska'),
    c('Gustav Lange', 1889, 'gustav lange'),
    c('Theodore Leschetizky', 1915, 'leschetizky'),
    c('Mykola Leontovych', 1921, 'leontovich', 'leontovych'),
    c(
        'Franz Xaver Gruber',
        1863,
        'gruber franz',
        'franz gruber',
        'f x gruber',
        'franz xaver gruber',
    ),
    c('James Lord Pierpont', 1893, 'pierpont'),
    c('Lowell Mason', 1872, 'lowell mason'),
    c('Felice de Giardini', 1796, 'giardini'),
    c('John Bacchus Dykes', 1876, 'dykes'),
    c('William Howard Doane', 1915, 'doane'),
    c('William J. Kirkpatrick', 1921, 'kirkpatrick'),
    c('Ira D. Sankey', 1908, 'sankey'),
    c('Philip Bliss', 1876, 'p p bliss', 'philip bliss', 'philip p bliss'),
    c('William Bradbury', 1868, 'bradbury'),
    c('Charles H. Gabriel', 1932, 'chas h gabriel', 'charles h gabriel'),
    c('Edwin O. Excell', 1921, 'excell'),
    c('James McGranahan', 1907, 'mcgranahan'),
    c('George C. Stebbins', 1945, 'stebbins'),
    c('William H. Monk', 1889, 'w h monk', 'william h monk'),
    c('Hart Pease Danks', 1903, 'danks'),
    c('Ralph Vaughan Williams', 1958, 'vaughan williams'), // exclu par l'année
    c('Jean Sibelius', 1957, 'sibelius'), // exclu par l'année
    c('Vince Guaraldi', 1976, 'guaraldi'), // exclu par l'année
    c('Henri Martinet', 1985, 'petit papa noel'), // exclu par l'année
    c('Matveï Blanter', 1990, 'blanter'), // exclu par l'année
];

/** Mentions d'une œuvre traditionnelle ou anonyme. */
export const TRADITIONAL = [
    'traditional',
    'traditionnel',
    'traditionelle',
    'traditionell',
    'traditioneel',
    'tradicional',
    'tradizionale',
    'trad',
    'anonymous',
    'anonyme',
    'anon',
    'anonim',
    'volksweise',
    'volkslied',
    'folk song',
    'folksong',
    'chanson populaire',
    'nursery rhyme',
    'comptine',
    'negro spiritual',
];

/** Titres célèbres d'œuvres du domaine public, avec leur auteur. */
export const FAMOUS_WORKS: [string, string][] = [
    ['fur elise', 'Ludwig van Beethoven'],
    ['moonlight sonata', 'Ludwig van Beethoven'],
    ['ode to joy', 'Ludwig van Beethoven'],
    ['ode an die freude', 'Ludwig van Beethoven'],
    ['rondo alla turca', 'Wolfgang Amadeus Mozart'],
    ['turkish march', 'Wolfgang Amadeus Mozart'],
    ['eine kleine nachtmusik', 'Wolfgang Amadeus Mozart'],
    ['canon in d', 'Johann Pachelbel'],
    ['air on the g string', 'Johann Sebastian Bach'],
    ['toccata and fugue in d minor', 'Johann Sebastian Bach'],
    ['jesu joy of man s desiring', 'Johann Sebastian Bach'],
    ['gymnopedie', 'Erik Satie'],
    ['gnossienne', 'Erik Satie'],
    ['clair de lune', 'Claude Debussy'],
    ['the entertainer', 'Scott Joplin'],
    ['maple leaf rag', 'Scott Joplin'],
    ['in the hall of the mountain king', 'Edvard Grieg'],
    ['morning mood', 'Edvard Grieg'],
    ['liebestraum', 'Franz Liszt'],
    ['hungarian rhapsody', 'Franz Liszt'],
    ['hungarian dance', 'Johannes Brahms'],
    ['brahms lullaby', 'Johannes Brahms'],
    ['wiegenlied', 'Johannes Brahms'],
    ['traumerei', 'Robert Schumann'],
    ['the blue danube', 'Johann Strauss II'],
    ['radetzky march', 'Johann Strauss I'],
    ['william tell overture', 'Gioachino Rossini'],
    ['dance of the sugar plum fairy', 'Piotr Ilitch Tchaïkovski'],
    ['swan lake', 'Piotr Ilitch Tchaïkovski'],
    ['nutcracker', 'Piotr Ilitch Tchaïkovski'],
    ['flight of the bumblebee', 'Nikolaï Rimski-Korsakov'],
    ['carnival of the animals', 'Camille Saint-Saëns'],
    ['danse macabre', 'Camille Saint-Saëns'],
    ['wedding march', 'Felix Mendelssohn'],
    ['bridal chorus', 'Richard Wagner'],
    ['la donna e mobile', 'Giuseppe Verdi'],
    ['minute waltz', 'Frédéric Chopin'],
    ['fantaisie impromptu', 'Frédéric Chopin'],
    ['raindrop prelude', 'Frédéric Chopin'],
    ['new world symphony', 'Antonín Dvořák'],
    ['humoresque', 'Antonín Dvořák'],
    ['salut d amour', 'Edward Elgar'],
    ['pomp and circumstance', 'Edward Elgar'],
    ['the maiden s prayer', 'Tekla Bądarzewska'],
    ['carol of the bells', 'Mykola Leontovych'],
    ['shchedryk', 'Mykola Leontovych'],
    ['silent night', 'Franz Xaver Gruber'],
    ['stille nacht', 'Franz Xaver Gruber'],
    ['douce nuit', 'Franz Xaver Gruber'],
    ['jingle bells', 'James Lord Pierpont'],
    ['o holy night', 'Adolphe Adam'],
    ['minuit chretiens', 'Adolphe Adam'],
    ['hark the herald angels sing', 'Felix Mendelssohn'],
    ['joy to the world', 'Lowell Mason'],
    ['greensleeves', 'Traditionnel'],
    ['amazing grace', 'Traditionnel'],
    ['auld lang syne', 'Traditionnel'],
    ['scarborough fair', 'Traditionnel'],
    ['londonderry air', 'Traditionnel'],
    ['danny boy', 'Traditionnel'],
    ['deck the halls', 'Traditionnel'],
    ['we wish you a merry christmas', 'Traditionnel'],
    ['god rest ye merry gentlemen', 'Traditionnel'],
    ['o come all ye faithful', 'Traditionnel'],
    ['adeste fideles', 'Traditionnel'],
    ['away in a manger', 'Traditionnel'],
    ['the first noel', 'Traditionnel'],
    ['o christmas tree', 'Traditionnel'],
    ['o tannenbaum', 'Traditionnel'],
    ['twinkle twinkle little star', 'Traditionnel'],
    ['ah vous dirai je maman', 'Traditionnel'],
    ['frere jacques', 'Traditionnel'],
    ['au clair de la lune', 'Traditionnel'],
    ['mary had a little lamb', 'Traditionnel'],
    ['happy birthday to you', 'Mildred et Patty Hill'],
    ['when the saints go marching in', 'Traditionnel'],
    ['house of the rising sun', 'Traditionnel'],
    ['korobeiniki', 'Traditionnel'],
    ['bella ciao', 'Traditionnel'],
    ['yellow rose of texas', 'Traditionnel'],
    ['swallowtail', 'Traditionnel'],
    ['a la claire fontaine', 'Traditionnel'],
    ['mon beau sapin', 'Traditionnel'],
    ['il est ne le divin enfant', 'Traditionnel'],
    ['row row row your boat', 'Traditionnel'],
    ['hava nagila', 'Traditionnel'],
    ['sakura sakura', 'Traditionnel'],
    ['arirang', 'Traditionnel'],
    ['god save the king', 'Traditionnel'],
    ['god save the queen', 'Traditionnel'],
    ['la marseillaise', 'Claude Joseph Rouget de Lisle'],
    ['el condor pasa', 'Daniel Alomía Robles'],
    ['oh susanna', 'Stephen Foster'],
    ['camptown races', 'Stephen Foster'],
    ['beautiful dreamer', 'Stephen Foster'],
    ['kalinka', 'Traditionnel'],
];

/** Œuvres à écarter même si le compositeur est admis. */
export const EXCLUDED_WORKS = [
    // Matveï Blanter (mort en 1990).
    'katyusha',
    // Adagio dit « d'Albinoni » : composé par Remo Giazotto (mort en 1998).
    'adagio in g minor',
    'albinoni',
    // Ave Maria dit « de Caccini » : composé par Vladimir Vavilov (mort en 1973).
    'caccini',
];

/** Texte sans accents ni ponctuation, en minuscules, entouré d'espaces. */
export const normalizeName = (text: string) =>
    ` ${fixMojibake(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()} `;

const REPLACEMENT = String.fromCharCode(0xfffd);

/** Répare un texte UTF-8 relu en Latin-1 (« DvoÅák » → « Dvořák »). */
export const fixMojibake = (text: string) => {
    if (!/[ÃÅÄÐÑÂ][\x80-\xbf]/.test(text)) return text;
    try {
        const fixed = Buffer.from(text, 'latin1').toString('utf-8');
        return fixed.includes(REPLACEMENT) ? text : fixed;
    } catch {
        return text;
    }
};

const has = (haystack: string, needle: string) =>
    haystack.includes(` ${needle} `);

const allowed = COMPOSERS.filter((x) => x.died <= DEATH_LIMIT);
const refused = COMPOSERS.filter((x) => x.died > DEATH_LIMIT);

export interface Attribution {
    /** Compositeur affiché (« Traditionnel » pour une œuvre populaire). */
    composer: string;
    /** Comment il a été reconnu. */
    how: 'composer' | 'dates' | 'traditional' | 'title';
}

/** Nom suivi de dates de vie, « James Hill (1811-1853) » ; null sinon. */
const lifeDates = (text: string): { name: string; died: number } | null => {
    const m = /\b1[4-9]\d\d\s*[-–]\s*(1[4-9]\d\d)\b/.exec(text);
    if (!m) return null;
    const name = text
        .slice(0, m.index)
        .replace(/[\s(,;:-]+$/, '')
        .trim();
    const [last, first, ...rest] = name.split(/\s*,\s*/);
    const ordered =
        first && !rest.length && !/\s/.test(last ?? '')
            ? `${first} ${last}`
            : name;
    return { name: fixMojibake(ordered), died: Number(m[1]) };
};

/** Medleys et montages : ils mêlent souvent des chansons protégées. */
const MEDLEY = /\+|\bmedley\b|\bmash ?up\b|\bremix\b|\bx\s+[A-Z]/i;

/** Genres de PDMX où « traditionnel » ou un titre célèbre ne suffisent pas. */
const MODERN_GENRES =
    /\b(pop|rock|electronic|hiphop|rap|rnb|metal|soundtrack|vocaloid|anime)\b/;

/** Noms vagues : « arr. par… », « transcrit par… », « original by… ». */
const VAGUE_NAME =
    /\b(arr|arranged|transcribed|original|by|version|cover)\b|:/i;

export interface AuthorFields {
    /** Champ compositeur (rempli par la personne qui a déposé la partition). */
    composer?: string;
    /** Artiste ou catégorie (« Misc Traditional ») : moins fiable. */
    artist?: string;
    /** Compositeur écrit dans le MusicXML. */
    creator?: string;
}

/**
 * Compositeur du domaine public reconnu dans les métadonnées, ou null.
 * Le titre sert aussi : auteur après un tiret (« Hosanna - J. B. Dykes »),
 * nom seul quand aucun auteur n'est donné, ou titre d'une œuvre célèbre.
 */
export const attribute = (
    { composer = '', artist = '', creator = '' }: AuthorFields,
    title: string,
    genres = '',
): Attribution | null => {
    if (MEDLEY.test(title)) return null;
    const nameText = normalizeName([composer, artist, creator].join(' | '));
    // « Traditionnel » : seulement dans le champ compositeur ou le XML (la
    // catégorie « Misc Traditional » est choisie sans contrôle).
    const authorText = normalizeName([composer, creator].join(' | '));
    const titleText = normalizeName(title);
    const all = `${nameText} ${titleText}`;
    if (EXCLUDED_WORKS.some((w) => has(all, w))) return null;
    // Un compositeur refusé nommé : écarté, même si un autre est admis.
    if (refused.some((x) => x.aliases.some((a) => has(all, a)))) return null;
    const modern = MODERN_GENRES.test(genres.toLowerCase());

    const empty = !nameText
        .replace(/\b(na|misc|composer|unknown|none)\b/g, '')
        .trim();
    // Auteur cité dans le titre après un tiret : « Titre - Auteur ».
    const afterDash = title
        .split(/\s[-–]\s/)
        .slice(1)
        .join(' ');
    const titleAuthor = normalizeName(afterDash);
    const texts = [nameText, titleAuthor, ...(empty ? [titleText] : [])];

    for (const text of texts) {
        const found = allowed.find((x) => x.aliases.some((a) => has(text, a)));
        if (found) return { composer: found.name, how: 'composer' };
    }
    if (modern) return null;
    for (const raw of [composer, artist, creator, afterDash]) {
        const dates = lifeDates(raw);
        if (
            dates &&
            dates.died <= DEATH_LIMIT &&
            /[a-z]{2,}.*\s.*[a-z]{2,}/i.test(dates.name) &&
            !VAGUE_NAME.test(dates.name)
        ) {
            return { composer: dates.name, how: 'dates' };
        }
    }
    const work = FAMOUS_WORKS.find(([t]) => has(titleText, t));
    if (work) return { composer: work[1], how: 'title' };
    if (TRADITIONAL.some((t) => has(authorText, t))) {
        return { composer: 'Traditionnel', how: 'traditional' };
    }
    return null;
};
