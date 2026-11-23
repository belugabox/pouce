# Pouce — fonctionnalités et analyses

Appli web pour **trouver des partitions de piano gratuites** et **y noter les doigtés** (numéros de doigts 1 à 5),
avec une **suggestion automatique** des doigtés.

Ce fichier résume ce qui a été conçu, prototypé et analysé dans une conversation précédente sur claude.ai.
Le prototype s’appelait « Doigté » ; l’appli s’appelle désormais **Pouce**.
La v1 de ce dépôt reprend le prototype ; voir [README.md](../README.md) pour la stack retenue.

Prototype de référence (une seule page HTML) : https://claude.ai/artifact/Y926w7fsbogLXYHyLfXKtk

---

## 1. Fonctionnalités prototypées

### Recherche et bibliothèque

- Champ de recherche par titre, compositeur ou mot-clé, insensible aux accents.
- Bibliothèque intégrée de 6 morceaux du **domaine public**, encodés en MusicXML avec un niveau
  (Débutant / Facile / Intermédiaire) : Ode à la joie, Au clair de la lune, Frère Jacques,
  Ah ! vous dirai-je maman, Menuet en sol (Petzold, BWV Anh. 114), Prélude en do (Bach, BWV 846, mes. 1–4, arr. simplifié).
  Ils contiennent tempo, liaisons et staccatos pour tester la suggestion.
- Liens vers Mutopia, IMSLP et MuseScore, pré-remplis avec la recherche.
- Import de fichiers MusicXML : `.mxl` (compressé), `.musicxml`, `.xml`.
  Le format « timewise » n'est pas géré (message d'erreur explicite).
- Section « Mes partitions importées », conservée dans le navigateur.
- Nombre de doigtés déjà notés affiché à côté de chaque morceau.

### Annotation des doigtés

- Affichage de la partition à partir du MusicXML (prototype : OpenSheetMusicDisplay).
- On touche une note pour la sélectionner (surbrillance), puis on choisit un doigt sur un clavier en bas d'écran
  en forme de touches de piano : 1 à 5, plus « Effacer ».
- **Avance automatique** à la note suivante de la même portée après chaque saisie : on enchaîne vite.
- Code couleur : **main droite** en bleu, au-dessus de la portée du haut ; **main gauche** en rose, sous la portée du bas.
- Accords : les chiffres sont empilés dans l'ordre des notes (aigu en haut).
- Raccourcis clavier : 1–5, Retour arrière / Suppr pour effacer, flèches gauche/droite pour naviguer,
  haut/bas pour changer de portée, Échap pour désélectionner.
- Zoom + / −, mise en page adaptée au mobile.
- Sauvegarde automatique par morceau.
- Les doigtés déjà présents dans un fichier importé sont repris.

### Export

- Export MusicXML avec les doigtés écrits en `<notations><technical><fingering>`,
  lisible par MuseScore et les autres éditeurs de partitions.

### Suggestion automatique des doigtés

- Bouton « Suggérer les doigtés » : remplit toutes les notes vides, main droite et main gauche.
- Les doigtés saisis par l'utilisateur sont **prioritaires** : la suggestion s'adapte autour d'eux.
  On peut fixer 2 ou 3 notes clés puis relancer.
- Les suggestions s'affichent **en clair et en italique**. Elles deviennent normales dès que l'utilisateur
  confirme ou corrige la note.
- « Retirer les suggestions » efface uniquement les doigtés automatiques.

---

## 2. Algorithme de suggestion (analyse et choix faits)

### Principe

On cherche, pour toute une portée, la suite de doigts qui **minimise l'effort total**
(programmation dynamique / Viterbi), plutôt que de décider note par note.
Une portée = une main (portée du haut = main droite, du bas = main gauche).
Pour un accord, on n'envisage que des doigts dans l'ordre des hauteurs
(croissants à la main droite, décroissants à la main gauche).

### Coûts pris en compte

- **Déplacement de la main** : on estime la position de la main d'après chaque doigt
  (pouce = point de départ, doigts 2-3-4-5 décalés comme do-ré-mi-fa-sol).
- **Même doigt sur deux notes différentes** à la suite : forte pénalité (casse le legato).
- **Écarts trop grands** entre deux doigts, avec un écart confortable maximum par paire de doigts
  (ex. 1-5 ≈ une octave, 3-4 ≈ une tierce mineure).
- Dans un accord : doigts trop serrés ou trop écartés par rapport à l'intervalle.
- **Pouce ou 5e doigt sur une touche noire** : pénalité.
- **Croisements** : le passage du pouce sous les doigts 2, 3 (ou 4, un peu plus cher) et le croisement
  par-dessus le pouce sont autorisés à coût modéré. Tout autre croisement est très pénalisé.
- Note répétée : changer de doigt coûte un peu, sauf en répétition rapide où l'alternance est favorisée.

### Prise en compte de la musique (lue dans le MusicXML)

- **Tempo** : `<sound tempo>` ou indication métronomique ; ♩ = 100 par défaut.
- **Temps réel entre deux attaques** (en secondes) : en passage rapide, les déplacements coûtent
  jusqu'à 2× plus ; sur des notes longues, presque rien.
- **Silences, points d'orgue, fins de liaison** = respirations : la main peut se replacer ;
  déplacements, sauts et répétitions de doigt y sont très peu pénalisés.
- **Notes sous une même liaison** = legato : répétition de doigt et déplacements plus chers.
- **Staccato** : rejouer avec le même doigt devient acceptable.

### Résultats vérifiés

- Gamme de do montante : main droite **1-2-3-1-2-3-4-5**, main gauche **5-4-3-2-1-3-2-1**
  (comme dans les méthodes). Le passage du pouce après le 4e doigt a dû être rendu plus cher pour y arriver.
- Menuet en sol, mesure 1 main droite : **5-1-2-3-4-5**, le doigté classique.
- Menuet, mesure 7 (fa♯ sol la si sol) : **2-1-2-3-1**, celui de la plupart des éditions.
- Ode à la joie : reste en position de do, sans déplacement inutile.

Ces résultats sont gardés par les tests de `apps/client/src/core/fingering/suggest.test.ts`.

### Limites connues

- Ne voit pas le phrasé implicite (sans liaisons écrites) ni les nuances.
- Choix arbitraire entre deux doigtés de même coût (ex. 4-1 ou 5-1 sur une quinte à la main gauche).
- Main de chaque portée choisie par défaut (piano : haut à droite, bas à gauche ; chant ignoré), réglable par partition depuis la v2.
- Sur les passages complexes, quelques corrections manuelles restent nécessaires.

### Pistes d'amélioration identifiées

- **Apprendre des corrections de l'utilisateur** : enregistrer le contexte (intervalle, doigt proposé et choisi,
  tempo, legato) à chaque correction et ajuster les coûts. Les suggestions s'adaptent à sa main.
- **Apprendre à partir de vrais doigtés** : jeu de données PIG (doigtés annotés par des pianistes,
  Université de Nagoya), pour estimer les coûts au lieu de les fixer à la main (modèle de Markov caché
  ou petit réseau de neurones).
- ~~Réglage manuel du tempo pour la suggestion.~~ Fait en v2.
- Référence open source existante : le projet Python « pianoplayer ».

---

## 3. Analyse : où récupérer des partitions

### Sources libres, à intégrer

- **PDMX** (recommandé comme base) : plus de 250 000 fichiers MusicXML sous licence CC-0 ou marqués
  domaine public, collectés sur MuseScore, avec métadonnées (genre, tags, popularité).
  Disponible sur Zenodo (record 13763756), GitHub (pnlong/PDMX) et en miroir sur Hugging Face (`openmusic/pdmx`).
  Les notes de popularité sont un bon indicateur de qualité (montré par les auteurs).
  Attention : la licence est celle déclarée par la personne qui a déposé le fichier → prévoir un bouton « signaler ».
- **IMSLP** : énorme catalogue classique, surtout en **PDF** ; a une API.
- **Mutopia Project** : partitions libres, souvent en MusicXML ou LilyPond.

### À ne pas intégrer automatiquement

- **MuseScore.com** : licences variables et téléchargement automatisé restreint → pas de scraping.
- Sites commerciaux (Musicnotes, Sheet Music Plus, Sheet Music Direct, Hal Leonard…) : à l'achat uniquement.

### Approche recommandée

Construire **notre propre index** de partitions libres (à partir de PDMX, filtré sur le piano) plutôt que
d'interroger des sites tiers à la volée : recherche instantanée, tolérante aux fautes, filtres
compositeur / difficulté, tri par popularité. Idée plus avancée : **recherche sémantique**
(« un morceau lent et mélancolique pour débutant »).

**Fait en v2** : index de 16 500 partitions de piano tirées de PDMX (`apps/server/scripts/pdmx`, voir le README).

- Licence déclarée ≠ licence réelle : parmi les partitions de piano « CC0 / domaine public », les plus vues sont des chansons récentes (Lewis Capaldi, Coldplay…). Une première version ne gardait que les œuvres reconnues libres (2 335 partitions) ; depuis le 20 novembre 2026, **plus aucun tri sur les droits** (projet personnel, un essai avant tout) : tout le piano de PDMX entre.
- Piano à deux portées vérifié dans le MusicXML (le CSV ne le dit pas).
- Doublons : la version la plus populaire. Popularité = vues, favoris et notes, en échelle logarithmique.
- Difficulté estimée par le client (`core/difficulty.ts`) : vitesse, accords, écarts, sauts, touches noires, voix, indépendance des mains, effort du meilleur doigté. Réglée sur des morceaux connus (comptines en Débutant, Menuet en sol en Facile, Lettre à Élise et 1er mouvement de la Sonate au clair de lune en Intermédiaire, Clair de lune de Debussy et Rhapsodie hongroise n° 2 en Avancé).
- Recherche en mémoire côté serveur : tolérante aux fautes (distance d'édition), équivalences français/anglais (valse/waltz, « lettre à Élise »…), filtre par niveau, tri.
- Bouton « Signaler » sur chaque fiche ; un outil en ligne de commande liste les signalements et retire une partition.

### PDF et photos → MusicXML (reconnaissance optique, OMR)

Pour exploiter les PDF d'IMSLP, un PDF acheté ou une partition papier photographiée.

- **Audiveris** (open source, AGPL) : importe PDF et images, éditeur de correction, export MusicXML.
- **homr** (open source) : photos ou PDF → MusicXML.
- **oemer** (open source) : redresse les photos prises au téléphone avant reconnaissance ; une image à la fois.
- **API OMR de Flat.io** : clé en main, payante, modèle maison de deep learning.
  La reconnaissance n'est jamais parfaite → prévoir une **étape de vérification** avant l'annotation.

---

## 4. Règles produit sur les droits d'auteur

- ~~L'index ou la bibliothèque partagée de l'appli ne contient **que** du domaine public ou du CC-0.~~
  Abandonné le 20 novembre 2026 : Pouce reste un projet personnel et expérimental, le catalogue prend
  tout le piano de PDMX sans tri sur les droits.
- Morceaux protégés (exemple étudié : musiques de _KPop Demon Hunters_, 2025, aucune version gratuite légale) :
  l'utilisateur achète la partition (ex. recueil officiel Hal Leonard « Easy Piano », arrangements à ~5 $
  sur Sheet Music Direct / Musicnotes), la convertit si besoin par OMR, puis l'importe.
  Le fichier reste **personnel** et n'entre jamais dans l'index partagé.

---

## 5. Idées de fonctionnalités non encore faites

- Import PDF / photo avec OMR et écran de vérification.
- **Mode PDF « calque »** pour les partitions sans MusicXML : afficher le PDF et poser les doigtés
  à des positions libres, export en PDF annoté.
- Apprentissage à partir des corrections de l'utilisateur.
- Réglage du tempo pour la suggestion.
- Sauvegarde en ligne et partage des partitions annotées.
- Partitions à plusieurs instruments : en partie (choix des portées jouées, v2).

Fait en v1 : hors ligne (PWA), suppression d'une partition importée.

Fait en v2 : index PDMX, recherche serveur (fautes, niveaux, tris), fiche et signalement, partitions du catalogue gardées hors ligne, niveau estimé des imports, mains par portée, tempo de la suggestion, annuler / rétablir, impression avec les doigtés, catalogue complet sans tri sur les droits, genres, versions regroupées, écoute, favoris (à la place de la liste des partitions ouvertes).

## 6. Conventions d'interface retenues

- Interface en **français**, tutoiement, typographie française (espace fine insécable avant ? ! : ;, apostrophe ’).
- Pensée **mobile d'abord**, thème clair et sombre (la partition reste sur fond blanc).
