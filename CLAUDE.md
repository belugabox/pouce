# Pouce — notes pour Claude

Appli web (nommée Pouce ; « Doigté » dans le prototype et la spec d’origine) pour trouver des partitions de piano libres et y noter les doigtés, avec suggestion automatique. Fonctionnalités dans [README.md](README.md), spécification, analyses et idées dans [docs/SPEC.md](docs/SPEC.md). Stack et conventions reprises de `O:/PERSO/bento` (demandé). Ce fichier ne contient que ce que le code ne dit pas.

## Travailler avec l'utilisateur

- Réponses en français, avec tutoiement, concises. Code, commentaires et interface en français ; messages de commit en anglais.
- Branche de travail : `feat/v1-port` (port du prototype, novembre 2026). Ne pas fusionner dans `main`, ne pas ouvrir de PR sans demande explicite.
- v1 décidée le 20 novembre 2026 : port du prototype, serveur minimal **sans comptes** (catalogue seulement) ; imports et doigtés dans le navigateur. Index PDMX, OMR, comptes et synchro viendront plus tard.

## Règles impératives

- **Droits d'auteur** : le catalogue partagé (`apps/server/catalog`, table `scores`) ne contient que du domaine public ou du CC-0. Pas de scraping de MuseScore.com ni de sites commerciaux, aucune source pirate. Une partition protégée reste un import personnel, jamais dans le catalogue.
- **Migrations Drizzle** : ne jamais modifier ni régénérer une migration qu'une base a pu appliquer ; en générer une nouvelle (`pnpm --filter server db:generate --name <nom>`).
- **Moteur de doigtés** (`apps/client/src/core/fingering/costs.ts`) : coûts repris tels quels du prototype, réglés à la main pour obtenir les doigtés vérifiés (gamme de do, Menuet en sol, Ode à la joie). Toute retouche doit garder `suggest.test.ts` vert.
- **Processus** : ne jamais tuer de processus en masse. Arrêter seulement un PID identifié et vérifié (le serveur de bento peut tourner sur 3001).

## Environnement (Windows)

- Shell : Git Bash. Pour une modification de plusieurs lignes, écrire un script Python dans le dossier temporaire avec l'outil Write, puis le lancer avec `python -I`.
- L'outil Write transforme les échappements `\u0300` d'un fichier en caractères bruts (arrivé dans les regex d'accents) : écrire ces lignes par un script Python, puis vérifier avec `grep`.
- Vérifications avant chaque commit :
    - serveur : `cd apps/server && pnpm test` (tsc des tests, puis vitest) ;
    - client : `cd apps/client && npx tsc -b && npx eslint . && npx vitest run` ;
    - le tout : `pnpm build` à la racine, puis vérifier que `apps/client/dist/sw.js` ne contient plus `__ASSETS__` ni `__VERSION__` (le plugin échoue sinon).
- jsdom met ~40 s à démarrer la première fois dans vitest : normal.
- Pas de Docker sur ce poste : l'image n'est construite que par la CI.
- Essai dans un vrai navigateur : `playwright-core@1.57.0` (Chromium 1200 déjà installé dans `~/AppData/Local/ms-playwright`), installé dans le dossier temporaire, contre `node apps/server/dist/main.js` lancé avec `PORT=3300` et `DATA_PATH` dans le dossier temporaire.

## Repères techniques

- **Clé d'une note** : `partie|mesure|portée|attaque|rang` (attaque en rondes, 4 décimales ; rang dans l'accord du grave à l'aigu). Calculée par `indexScore` (`core/musicxml.ts`, depuis le XML) et par `collectPositions` (`editor/osmd.ts`, depuis OSMD) : les deux doivent rester identiques. Vérifié sur le Menuet : 49 notes, 49 positions.
- Le moteur ne lit que le MusicXML (MIDI, temps en noires, tempo, liaisons, staccato, point d'orgue) ; OSMD ne sert qu'au dessin et aux positions. Portée 1 = main droite, toutes les autres = main gauche (limite connue).
- Une note « cue » prend son temps sans être jouée (corrigé par rapport au prototype, qui décalait la suite).
- Doigtés stockés par partition (`storage/db.ts`, clé `catalogue/<id>` ou `import/<id>`) : `f` (tous) et `auto` (suggérés, affichés en clair et en italique). Saisir une note la retire de `auto`.
- OSMD : le zoom est la propriété `Zoom` (majuscule). Le calque des doigtés (`#fingering-layer`) est redessiné après chaque `render()`. Le paquet optionnel `gl` d'OSMD (rendu côté serveur) est ignoré à l'installation : inutile.
- Couleurs propres à Pouce (mains, sélection, touches) dans `src/global.css` ; le reste en props Mantine. La partition reste sur fond blanc en mode sombre ; le calque utilise des couleurs fixes.
- Notifications en haut de l'écran : en bas, le clavier de saisie les cachait.
- Service worker (`sw/sw.js`) : application précachée (OSMD compris, ~1,2 Mo), `/api/catalog*` en réseau d'abord puis cache (`pouce-api`). Les `.woff` ne sont pas précachés (les `.woff2` suffisent).
