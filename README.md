# 🖐️ Pouce

Appli web pour trouver des partitions de piano et y noter les doigtés (1 à 5), avec une suggestion automatique. Voir la [spécification](docs/SPEC.md).

- **Bibliothèque** de 16 500 partitions de piano tirées de [PDMX](https://zenodo.org/records/15571083) : classique, chansons, musiques de films et séries, de jeux vidéo. La recherche est insensible aux accents, tolère les fautes de frappe et comprend « facile », « débutant »… On filtre par niveau (estimé d'après les notes) et par genre, on trie par popularité, facilité ou titre. Les versions d'un même morceau sont regroupées, de la plus facile à la plus difficile.
- **Favoris** : une étoile sur chaque partition (liste ou éditeur) ; les favoris s'affichent en tête de l'accueil et restent disponibles hors ligne.
- **Import** de fichiers MusicXML (`.mxl`, `.musicxml`, `.xml`) : ils restent dans le navigateur (IndexedDB), avec leurs doigtés et un niveau estimé.
- **Annotation** : touche une note, puis un doigt sur le clavier en bas d'écran ; avance automatique à la note suivante.
    - Annuler et rétablir.
    - Raccourcis : 1–5, Retour arrière / Suppr, flèches, Échap, Ctrl+Z / Ctrl+Maj+Z, Espace (écouter).
- **Suggestion** de tous les doigtés vides : programmation dynamique sur toute la portée, en tenant compte du tempo, des silences, des liaisons et des staccatos.
    - Les doigtés saisis sont prioritaires.
    - Le tempo de jeu est réglable.
    - On choisit la main de chaque portée : chant et piano, partitions à plusieurs portées.
- **Écoute** de la partition, depuis la liste ou depuis une note dans l'éditeur : sons d'un vrai piano (Salamander Grand Piano, deux forces de frappe), nuances et accents de la partition. Les sons sont gardés après la première écoute (hors ligne).
- **Export** MusicXML avec les doigtés (`<technical><fingering>`), lisible par MuseScore, et **impression** de la partition avec ses doigtés.
- **Fiche** de chaque partition : niveau, durée, licence et source. Un bouton permet de **signaler** une partition fausse ou illisible.
- **Hors ligne** (PWA) : l'appli et les partitions déjà ouvertes restent disponibles sans réseau.

## Développement

Prérequis : Node 22 et pnpm 10.

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
pnpm dev
```

- Appli : http://localhost:5173. Le client Vite renvoie `/api` vers le serveur, sur le port 3001.
- Données locales (base SQLite, paquet PDMX) : `apps/server/data/`, ignoré par Git.
- `pnpm test`, `pnpm lint`, `pnpm build`.

### Organisation

- `apps/client` : React 19, Mantine 7, Vite 6.
    - Le moteur (lecture du MusicXML, suggestion, difficulté, import, export) est dans `src/core/`, en TypeScript pur, testé sans navigateur.
    - Le rendu de la partition passe par [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/) (`src/editor/`).
- `apps/server` : Hono, Drizzle et SQLite. Il sert le client compilé et l'API :
    - `/api/catalog` : recherche, avec `q`, `level`, `sort`, `offset` et `limit` ;
    - `/api/catalog/:id` : une partition ;
    - `/api/catalog/:id/report` (POST) : signalement ;
    - `/api/health`.
- `apps/server/catalog` : catalogue intégré (`catalog.json` et un `<id>.musicxml` par partition), écrit en base à chaque démarrage. Après une modification, `pnpm --filter server catalog:levels` recalcule niveaux et durées.
- `apps/server/scripts/pdmx` : fabrication du paquet PDMX (voir plus bas).

### Base de données

SQLite avec [Drizzle](https://orm.drizzle.team). Le schéma est dans `apps/server/src/db/schema.ts` et les migrations dans `apps/server/drizzle/`. Elles sont appliquées automatiquement au démarrage. Après une modification du schéma :

```sh
pnpm --filter server db:generate --name <nom>
```

Ne jamais modifier ni régénérer une migration qu'une base a pu appliquer : en générer une nouvelle.

## Catalogue PDMX

[PDMX](https://zenodo.org/records/15571083) (Long et al., 2024, CC BY 4.0) réunit 254 000 partitions MusicXML de MuseScore, marquées CC0 ou domaine public par la personne qui les dépose, souvent à tort.

Pouce est un projet personnel et expérimental : le script garde **toutes** les partitions de piano, sans tri sur les droits. Il écarte seulement :

- ce qui n'est pas un piano seul à deux portées où les deux mains jouent ;
- les doublons : parmi les versions d'un même morceau, la meilleure selon PDMX, puis la plus populaire à titre et auteur égaux ;
- les partitions illisibles, très courtes (moins de 24 notes) ou très longues (plus de 1 500 mesures).

Le compositeur est reconnu quand c'est possible (`scripts/pdmx/composers.ts`, nom complet), sinon repris tel qu'il est écrit.

```sh
# Depuis Zenodo, en flux (~2,1 Go lus, rien de gardé) :
pnpm --filter server pdmx
# Ou depuis des fichiers déjà téléchargés :
pnpm --filter server pdmx --csv PDMX.csv --mxl mxl.tar.gz
```

Le script (~1 h) produit `apps/server/data/pdmx.jsonl.gz` (~160 Mo, 16 500 partitions) et un rapport `pdmx-report.tsv` qui liste chaque partition retenue. Le serveur charge le paquet au démarrage, quand il a changé. En production, copier le fichier dans le volume `/config` puis redémarrer.

### Signalements

Les signalements envoyés depuis l'appli sont en base. Pour les lire et retirer une partition :

```sh
node apps/server/dist/tools/admin.js signalements
node apps/server/dist/tools/admin.js retirer <id>    # remettre <id> pour annuler
```

Dans Docker : `docker exec <conteneur> node apps/server/dist/tools/admin.js …`, puis redémarrer le conteneur. Une partition retirée le reste quand le paquet est rechargé.

## Configuration

| Variable       | Défaut                           | Rôle                                                                |
| -------------- | -------------------------------- | ------------------------------------------------------------------- |
| `PORT`         | `3001`                           | Port HTTP                                                           |
| `LOG_LEVEL`    | `info`                           | `debug`, `info`, `warn` ou `error`                                  |
| `DATA_PATH`    | `./data` (`/config` dans Docker) | Base SQLite et paquet PDMX                                          |
| `CATALOG_PACK` | `<DATA_PATH>/pdmx.jsonl.gz`      | Paquet de partitions PDMX                                           |
| `TRUST_PROXY`  | `false`                          | Lire l'adresse du client dans `X-Forwarded-For` (derrière un proxy) |

## Déploiement

Une image Docker (serveur et client) est construite par GitHub Actions et publiée sur GHCR à chaque push sur `main` ou `dev`.

```yaml
services:
    pouce:
        image: ghcr.io/<compte>/<dépôt>:main
        ports:
            - '3001:3001'
        volumes:
            - ./config:/config # y copier pdmx.jsonl.gz
        restart: unless-stopped
```

## Crédits

- Partitions : [PDMX](https://zenodo.org/records/15571083), Phillip Long, Zachary Novack, Taylor Berg-Kirkpatrick et Julian McAuley, « PDMX: A Large-Scale Public Domain MusicXML Dataset for Symbolic Music Processing », 2024, CC BY 4.0.
- Sons de piano : [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3), Alexander Holm, CC BY 3.0 ; extraits dans `apps/client/public/piano/` (voir `LICENCE.txt`).
- Rendu : [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/), BSD-3-Clause.
