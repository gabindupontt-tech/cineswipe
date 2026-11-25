# CinéSwipe, version 2 : ce qui change par rapport au zip du 26 octobre

Fichiers nouveaux : `contenu/cartes.yml`, `src/cartes.njk`, `src/assets/js/stats.js`, `src/assets/js/cartes.js`, `backend/` (service de compteurs),
`MODIFICATIONS_V2.md`.
Fichiers modifiés : `lib/contenu.js` (validation de `bande_annonce`, `maison`, `cartes.yml`), `src/film.njk`, `src/swipe.njk`, `src/groupes.njk`,
`src/a-propos.njk` (confidentialité), `src/_includes/base.njk` (navigation, bannière), `src/sitemap.njk`, `src/assets/js/{consent,main,swipe,groupes}.js`,
`src/assets/css/styles.css` (ajouts en fin de fichier), `modeles/film.md`, `contenu/reglages.yml` (bloc `stats`), `contenu/films/exemple-film-1.md`
(exemple de `maison` et `bande_annonce`), `README.md`.

Si le dépôt en ligne a changé depuis le zip du 26 octobre, appliquer ces fichiers un par un plutôt que d'écraser le dépôt.
Testé : build, et simulation navigateur (jsdom) du swipe vers les compteurs, du seuil d'affichage, des groupes en direct à trois personnes,
de la page cartes et du prix perso. Non testé : déploiement réel du service Cloudflare, rendu visuel sur téléphone.
