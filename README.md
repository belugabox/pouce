# 🖐️ Pouce

Appli web pour trouver des partitions de piano libres de droits et y noter les doigtés (1 à 5), avec une suggestion automatique. Voir la [spécification](docs/SPEC.md).

- **Recherche** dans le catalogue partagé (domaine public uniquement), insensible aux accents, et liens vers Mutopia, IMSLP et MuseScore.
- **Import** de fichiers MusicXML (`.mxl`, `.musicxml`, `.xml`) : ils restent dans le navigateur (IndexedDB), avec leurs doigtés.
- **Annotation** : touche une note, puis un doigt sur le clavier en bas d'écran ; avance automatique à la note suivante. Raccourcis : 1–5, Retour arrière / Suppr, flèches, Échap.
- **Suggestion** de tous les doigtés vides (programmation dynamique sur toute la portée, tempo, silences, liaisons, staccatos). Les doigtés saisis sont prioritaires.
- **Export** MusicXML avec les doigtés (`<technical><fingering>`), lisible par MuseScore.
- **Hors ligne** (PWA) une fois l'appli ouverte une première fois.

## Développement

Prérequis : Node 22 et pnpm 10.

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
pnpm dev
```

- Appli : http://localhost:5173. Le client Vite renvoie `/api` vers le serveur, sur le port 3001.
- Données locales (base SQLite du catalogue) : `apps/server/data/`, ignoré par Git.
- `pnpm test`, `pnpm lint`, `pnpm build`.

### Organisation

- `apps/client` : React 19, Mantine 7, Vite 6. Le moteur (lecture du MusicXML, suggestion, import, export) est dans `src/core/`, en TypeScript pur, testé sans navigateur. Le rendu de la partition passe par [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/) (`src/editor/`).
- `apps/server` : Hono, Drizzle et SQLite. Sert le client compilé et le catalogue (`/api/catalog`, `/api/catalog/:id`, `/api/health`).
- `apps/server/catalog` : partitions du catalogue intégré (`catalog.json` et un `<id>.musicxml` par partition), écrites en base à chaque démarrage.

### Base de données

SQLite avec [Drizzle](https://orm.drizzle.team). Le schéma est dans `apps/server/src/db/schema.ts` et les migrations dans `apps/server/drizzle/`. Elles sont appliquées automatiquement au démarrage. Après une modification du schéma :

```sh
pnpm --filter server db:generate --name <nom>
```

Ne jamais modifier ni régénérer une migration qu'une base a pu appliquer : en générer une nouvelle.

## Configuration

| Variable    | Défaut                           | Rôle                               |
| ----------- | -------------------------------- | ---------------------------------- |
| `PORT`      | `3001`                           | Port HTTP                          |
| `LOG_LEVEL` | `info`                           | `debug`, `info`, `warn` ou `error` |
| `DATA_PATH` | `./data` (`/config` dans Docker) | Base SQLite                        |

## Déploiement

Une image Docker (serveur et client) est construite par GitHub Actions et publiée sur GHCR à chaque push sur `main` ou `dev`.

```yaml
services:
    pouce:
        image: ghcr.io/<compte>/<dépôt>:main
        ports:
            - '3001:3001'
        volumes:
            - ./config:/config
        restart: unless-stopped
```
