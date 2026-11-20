# Pouce — notes pour Claude

Appli web (nommée Pouce ; « Doigté » dans le prototype et la spec d’origine) pour trouver des partitions de piano libres et y noter les doigtés, avec suggestion automatique. Fonctionnalités dans [README.md](README.md), spécification, analyses et idées dans [docs/SPEC.md](docs/SPEC.md). Stack et conventions reprises de `O:/PERSO/bento` (demandé). Ce fichier ne contient que ce que le code ne dit pas.

## Travailler avec l'utilisateur

- Réponses en français, avec tutoiement, concises. Code, commentaires et interface en français ; messages de commit en anglais.
- Branches : `main` (commit initial vide), `feat/v1-port` (port du prototype, PR #1 ouverte pour lancer la CI, ne pas fusionner sans demande), `feat/v2` (catalogue PDMX et améliorations, partie de `feat/v1-port`). Pas de PR ni de fusion sans demande explicite.
- `gh` n'est pas installé : l'API GitHub s'appelle avec curl et le jeton de Git Credential Manager (`git credential fill`), sans jamais l'afficher.
- v1 (20 novembre 2026) : port du prototype, serveur minimal **sans comptes**. v2 : catalogue PDMX filtré, recherche serveur, hors-ligne des partitions ouvertes. OMR, comptes et synchro viendront plus tard.

## Règles impératives

- **Droits d'auteur** : le catalogue partagé (`apps/server/catalog`, table `scores`, paquet PDMX) ne contient que du domaine public ou du CC-0. Pas de scraping de MuseScore.com ni de sites commerciaux, aucune source pirate. Une partition protégée reste un import personnel, jamais dans le catalogue.
- **PDMX** : la licence y est déclarée par la personne qui dépose, souvent à tort (chansons récentes « domaine public »). Une partition n'entre que si l'**œuvre** est reconnue libre par `apps/server/scripts/pdmx/composers.ts` : compositeur de la liste fermée (mort en 1955 au plus tard), dates de vie, titre d'une œuvre libre connue, ou « traditionnel » écrit dans le champ compositeur. Ne jamais assouplir sans relire le rapport `data/pdmx-report.tsv` ; ajouter un cas réel aux tests de `test/pdmx.test.ts` à chaque faux positif trouvé.
- **Migrations Drizzle** : ne jamais modifier ni régénérer une migration qu'une base a pu appliquer ; en générer une nouvelle (`pnpm --filter server db:generate --name <nom>`). drizzle-kit pose une question (renommage de colonne ?) qu'il ne peut pas poser hors terminal : ajouter et retirer une colonne en deux migrations.
- **Moteur de doigtés** (`apps/client/src/core/fingering/costs.ts`) : coûts repris tels quels du prototype, réglés à la main pour obtenir les doigtés vérifiés (gamme de do, Menuet en sol, Ode à la joie). Toute retouche doit garder `suggest.test.ts` vert. Les poids de la difficulté (`core/difficulty.ts`) sont réglés sur des morceaux connus : garder `difficulty.test.ts` vert.
- **Processus** : ne jamais tuer de processus en masse. Arrêter seulement un PID identifié et vérifié (le serveur de bento peut tourner sur 3001).

## Environnement (Windows)

- Shell : Git Bash. Pour une modification de plusieurs lignes, écrire un script Python dans le dossier temporaire avec l'outil Write, puis le lancer avec `python -I` (`python -I -X utf8` pour afficher de l'UTF-8 : `-I` ignore `PYTHONIOENCODING`).
- L'outil Write transforme les échappements `\u0300` d'un fichier en caractères bruts (arrivé dans les regex d'accents) : écrire ces lignes par un script Python, puis vérifier avec `grep`. Ailleurs, préférer `\p{M}` ou `String.fromCharCode`.
- Vérifications avant chaque commit :
    - serveur : `cd apps/server && pnpm test` (tsc des tests et des scripts, puis vitest) ;
    - client : `cd apps/client && npx tsc -b && npx eslint . && npx vitest run` ;
    - le tout : `pnpm build` à la racine, puis vérifier que `apps/client/dist/sw.js` ne contient plus `__ASSETS__` ni `__VERSION__` (le plugin échoue sinon).
- jsdom met ~40 s à démarrer la première fois dans vitest : normal. Les alias `@/` et `@server/types` sont aussi déclarés dans `vitest.config.ts` : `vite-tsconfig-paths` les perd quand la lettre du lecteur change de casse (`o:` / `O:`).
- Pas de Docker sur ce poste : l'image n'est construite que par la CI.
- Essai dans un vrai navigateur : `playwright-core@1.57.0` (Chromium 1200 déjà installé dans `~/AppData/Local/ms-playwright`), installé dans le dossier temporaire, contre `node apps/server/dist/main.js` lancé avec `PORT=3300` et `DATA_PATH` dans le dossier temporaire (y copier `pdmx.jsonl.gz` pour avoir le catalogue complet).
- Données PDMX de travail (2,1 Go, `PDMX.csv` et `mxl.tar.gz`) : dans le dossier temporaire de la session, à retélécharger au besoin (le script lit aussi Zenodo en flux). Le paquet produit (`apps/server/data/pdmx.jsonl.gz`, ~30 Mo) n'est pas versionné.

## Repères techniques

- **Clé d'une note** : `partie|mesure|portée|attaque|rang` (attaque en rondes, 4 décimales ; rang dans l'accord du grave à l'aigu). Calculée par `indexScore` (`core/musicxml.ts`, depuis le XML) et par `collectPositions` (`editor/osmd.ts`, depuis OSMD) : les deux doivent rester identiques. Vérifié sur le Menuet (49/49) et la Lettre à Élise de PDMX (812/812).
- Le moteur ne lit que le MusicXML (MIDI, temps en noires, tempo, liaisons, staccato, point d'orgue) ; OSMD ne sert qu'au dessin et aux positions.
- **Mains** (`core/fingering/hands.ts`) : par défaut, dans la première partie à plusieurs portées, la portée du haut à droite et les autres à gauche, les autres parties ignorées ; sinon la 1re portée à droite, la 2e à gauche. Réglable par partition (`settings` dans IndexedDB), avec le tempo de la suggestion.
- `core/` est aussi utilisé hors navigateur par les scripts du serveur (`scripts/pdmx`, `scripts/catalog-levels.ts`, avec linkedom) : pas de dépendance au DOM réel ni à React dans `core/`.
- Une note « cue » prend son temps sans être jouée (corrigé par rapport au prototype, qui décalait la suite).
- IndexedDB `pouce` (v2) : `imports`, `annotations` (`f` tous, `auto` suggérés, clé `catalogue/<id>` ou `import/<id>`), `library` (partitions du catalogue déjà ouvertes, pour le hors-ligne), `settings` (mains, tempo).
- Catalogue côté serveur : XML compressé (gzip) en base ; recherche en mémoire (`catalog/search.ts`), rechargée au démarrage seulement. Paquet PDMX chargé au démarrage si sa signature (taille, date) a changé ; les partitions retirées (`hidden`) le restent.
- Recherche, niveau et tri de la page d'accueil : état React local recopié dans l'adresse. Lire l'adresse à chaque frappe perdait des changements (navigations de React Router en transition).
- OSMD : le zoom est la propriété `Zoom` (majuscule). Le calque des doigtés (`#fingering-layer`) est redessiné après chaque `render()`. Le paquet optionnel `gl` d'OSMD (rendu côté serveur) est ignoré à l'installation : inutile.
- Couleurs propres à Pouce (mains, sélection, touches) dans `src/global.css` ; le reste en props Mantine. La partition reste sur fond blanc en mode sombre ; le calque utilise des couleurs fixes. Impression : feuille `@media print` (interface masquée, suggestions à pleine opacité).
- Notifications en haut de l'écran : en bas, le clavier de saisie les cachait.
- Service worker (`sw/sw.js`) : application précachée (OSMD compris, ~1,2 Mo) ; seule la liste du catalogue sans recherche est gardée (`pouce-api-2`, nom à changer quand le format de l'API change). Les `.woff` ne sont pas précachés (les `.woff2` suffisent).
