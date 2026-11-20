# 🖐️ Pouce

Appli web pour trouver des partitions de piano libres de droits et y noter les doigtés (1 à 5), avec une suggestion automatique. Voir la [spécification](docs/SPEC.md).

- **Bibliothèque** de plus de 2 300 partitions de piano du domaine public, tirées de [PDMX](https://zenodo.org/records/15571083) et filtrées œuvre par œuvre. La recherche est insensible aux accents et tolère les fautes de frappe. On peut filtrer par niveau (estimé d'après les notes) et trier par popularité, facilité ou titre.
- **Import** de fichiers MusicXML (`.mxl`, `.musicxml`, `.xml`) : ils restent dans le navigateur (IndexedDB), avec leurs doigtés et un niveau estimé.
- **Annotation** : touche une note, puis un doigt sur le clavier en bas d'écran ; avance automatique à la note suivante.
    - Annuler et rétablir.
    - Raccourcis : 1–5, Retour arrière / Suppr, flèches, Échap, Ctrl+Z / Ctrl+Maj+Z.
- **Suggestion** de tous les doigtés vides : programmation dynamique sur toute la portée, en tenant compte du tempo, des silences, des liaisons et des staccatos.
    - Les doigtés saisis sont prioritaires.
    - Le tempo de jeu est réglable.
    - On choisit la main de chaque portée : chant et piano, partitions à plusieurs portées.
- **Export** MusicXML avec les doigtés (`<technical><fingering>`), lisible par MuseScore, et **impression** de la partition avec ses doigtés.
- **Fiche** de chaque partition : niveau, durée, licence et source. Un bouton permet de **signaler** une partition protégée ou fausse.
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

[PDMX](https://zenodo.org/records/15571083) (Long et al., 2024, CC BY 4.0) réunit 254 000 partitions MusicXML de MuseScore, marquées CC0 ou domaine public. Cette licence est déclarée par la personne qui dépose la partition, et elle est souvent fausse : on y trouve des chansons récentes « dans le domaine public ».

Le script ne garde une partition que si :

- c'est un piano seul, à deux portées, et les deux mains jouent ;
- la licence est CC0 ou domaine public, sans conflit signalé par PDMX ; parmi les versions d'un même morceau, seule la meilleure est gardée ;
- **l'œuvre elle-même** est libre :
    - son compositeur est dans une liste fermée de compositeurs morts en 1955 au plus tard (`scripts/pdmx/composers.ts`) ;
    - ou ses dates de vie sont écrites ;
    - ou c'est une œuvre libre célèbre, reconnue par son titre ;
    - ou « traditionnel » est écrit dans le champ compositeur.

Les medleys sont écartés. Les paroles et les mentions de droits sont retirées du MusicXML.

```sh
# Depuis Zenodo, en flux (~2,1 Go lus, rien de gardé) :
pnpm --filter server pdmx
# Ou depuis des fichiers déjà téléchargés :
pnpm --filter server pdmx --csv PDMX.csv --mxl mxl.tar.gz
```

Le script produit `apps/server/data/pdmx.jsonl.gz` (~30 Mo, 2 335 partitions) et un rapport `pdmx-report.tsv` qui liste chaque partition retenue et la raison. Le serveur charge le paquet au démarrage, quand il a changé. En production, copier le fichier dans le volume `/config` puis redémarrer.

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
- Rendu : [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/), BSD-3-Clause.
