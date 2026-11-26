# CinéSwipe, le site

Site statique (aucune base de données, aucun compte). Les pages sont fabriquées à partir de fichiers texte simples
dans le dossier `contenu/`, puis publiées gratuitement sur GitHub Pages.

```
contenu/reglages.yml     réglages du site (adresse, GA4, newsletter, équipe, mentions légales)
contenu/sources.yml      les chiffres de contexte de la page À propos, avec source, lien et date
contenu/films/           un fichier par film
contenu/cinemas/         un fichier par cinéma (adresse, coordonnées, site)
contenu/semaines/        un fichier par semaine (3 à 5 films, plus des films "en_plus" facultatifs)
contenu/affiches/        les images d'affiches (facultatif)
modeles/                 modèles commentés à copier : film.md, semaine.md et cinema.md
src/                     le code du site (on n'y touche pas pour publier)
```

## Publier une semaine (sans toucher au code)

Tout se fait depuis le site GitHub, dans le navigateur.

1. Pour chaque film : ouvrir `modeles/film.md`, copier tout le contenu, puis dans `contenu/films/` cliquer sur
   **Add file > Create new file**, nommer le fichier `nom-du-film.md` (minuscules, sans accent, avec des tirets) et coller.
   Remplacer chaque texte. Le tarif doit avoir sa source (lien) et sa date de relevé.
2. Faire pareil avec `modeles/semaine.md` dans `contenu/semaines/`, fichier nommé avec la date du mercredi (`2026-10-28.md`),
   en listant 3 à 5 noms de films (sans `.md`).
3. Cliquer sur **Commit changes**. Au bout de 2 minutes environ, le site est à jour.
4. Vérifier dans l'onglet **Actions** : une coche verte = publié. Une croix rouge = ouvrir l'exécution, le message
   "CONTENU À CORRIGER" dit quel fichier et quel champ corriger. Le site en ligne reste alors la version précédente.

### Films indépendants et reprises

Dans la fiche d'un film, `categorie` vaut `nouveau` (à l'affiche), `independant` (cinéma indépendant, petit distributeur) ou
`reprise` (film ancien ressorti en salle, par exemple chez Pathé). Une reprise demande aussi `annee` (année de sortie d'origine).
Dans le fichier de la semaine, la liste `en_plus` ajoute jusqu'à 6 de ces films au swipe, après la sélection. Ils ne comptent pas
dans la promesse "3 à 5 films" et portent une pastille "Indépendant" ou "Reprise 1998". Le visiteur peut les masquer avec les
filtres du swipe.

### Cinémas et "Où le voir près de toi"

1. Copier `modeles/cinema.md` dans `contenu/cinemas/` sous le nom du cinéma (`le-nom-du-cinema.md`). Les coordonnées `lat` et `lng`
   (clic droit sur le cinéma dans OpenStreetMap, ou Google Maps) servent à classer les cinémas par distance. Elles sont à relever
   pour chaque cinéma : le site n'en invente aucune.
2. Dans chaque fiche film, `projections` liste les cinémas qui passent le film (nom du fichier du cinéma). `url` est la page du
   film chez ce cinéma, sinon le bouton mène à l'accueil du cinéma. Un tarif propre à un cinéma peut être ajouté (montant, type,
   source, date, les cinq ensemble), comme pour le tarif principal.
3. Le site n'affiche pas d'horaires : ils changent chaque semaine. Il renvoie vers le cinéma.

Côté visiteur : bouton "Me localiser" (le navigateur demande l'accord), recherche d'adresse ou de ville, ou choix d'une ville
dans la liste (cette dernière ne fait aucune requête). La position est arrondie, gardée seulement le temps de l'onglet
(`sessionStorage`), jamais envoyée à CinéSwipe ni à GA4. La recherche d'adresse interroge la Base Adresse Nationale
(`api-adresse.data.gouv.fr`, gratuite, sans clé, l'adresse tapée lui est envoyée) ; si elle ne répond pas, le visiteur choisit une ville.

### Groupes entre amis (sans serveur)

La page `/groupes/` permet de créer un groupe, d'inviter par lien, et de voir qui garde quoi, des statistiques (participation,
film en tête, unanimité, goûts proches, budget, part de chaque catégorie) et les cinémas des films retenus.
Il n'y a pas de base de données : l'état du groupe est dans la partie du lien après `#` (jamais envoyée au serveur) et dans le
`localStorage` de chacun. Chaque ami envoie son lien, et l'ouvrir fusionne ses choix chez soi. **Ce n'est pas du temps réel** :
il faut échanger les liens. Un vrai groupe en direct demanderait un serveur et des comptes, ce qui sort du cadre du site.
Un lien n'est valable que pour la sélection de la semaine pour laquelle il a été créé (si le contenu change en cours de semaine,
le site le dit). Les groupes sont limités à 20 personnes, les prénoms à 20 caractères.

Une semaine préparée à l'avance apparaît toute seule le jour de sa date (le site se reconstruit chaque matin).
La semaine la plus récente est l'accueil et le swipe, les précédentes passent dans les archives.

Les fiches marquées `exemple: true` sont des exemples : elles affichent une pastille "Exemple à remplacer" et leurs pages
ne sont pas indexées par Google. Supprimer les fichiers d'exemple (et la semaine qui les utilise) avant la mise en ligne.

## Mise en place, une seule fois

1. Créer un dépôt GitHub, y mettre ce dossier. Dans **Settings > Pages**, choisir la source **GitHub Actions**.
2. Dans `contenu/reglages.yml`, renseigner `url` (adresse publique, sans `/` final) puis tous les champs `A_COMPLETER`
   (directeur de publication, contact, plateforme d'emailing). L'équipe, la méthode et l'éditeur sont déjà remplis d'après le
   one-pager du Milestone 2 : relire, et vérifier que chaque membre est d'accord pour que son nom apparaisse sur un site public.
   Le build rappelle ce qui reste à compléter. Les chiffres de la page À propos sont dans `contenu/sources.yml` : les ré-ouvrir
   avant la mise en ligne et mettre à jour la date de consultation.
3. **Logo** : remplacer `src/assets/img/logo-signe.svg` par le SVG officiel du signe (même nom de fichier). Le fichier actuel est provisoire.
4. **Image de partage** : `src/assets/img/og-default.png` (1200 x 630) s'affiche dans les aperçus de lien WhatsApp et réseaux.
   Elle contient seulement le mot "cinéswipe" et des bulles, à remplacer par l'export Canva si besoin.
5. **Newsletter** : dans la plateforme d'emailing, créer un formulaire d'inscription avec confirmation par e-mail, copier
   l'adresse d'envoi du formulaire dans `newsletter > action` et le nom du champ e-mail dans `champ_email`.
   Régler la page affichée après confirmation sur `<url du site>/newsletter/merci/` : c'est elle qui déclenche l'événement
   "inscription confirmée".
6. **Google Analytics 4** : créer la propriété, copier l'identifiant de mesure (`G-...`) dans `ga4_id`. La bannière de
   consentement apparaît alors toute seule. Tant que `ga4_id` est vide, rien n'est chargé et il n'y a pas de bannière.
7. **Search Console** : ajouter le site comme propriété, choisir la vérification par balise HTML, coller la valeur de `content`
   dans `search_console_verification`, puis soumettre `<url du site>/sitemap.xml`. Lier ensuite Search Console à GA4
   (GA4 > Admin > Liens de produits > Search Console).
8. **Textes légaux** : les mentions légales et la politique de confidentialité (page `À propos`) sont un modèle rédigé à partir de
   ce que fait le site. À relire par l'équipe et l'enseignant avant publication, en particulier la durée de conservation dans GA4
   (le texte annonce 2 mois, valeur par défaut de GA4 : à vérifier dans le compte).

## Mesure (GA4)

Onze événements, envoyés uniquement si le visiteur a cliqué sur Accepter :

| Événement | Quand | Paramètres |
|---|---|---|
| `swipe_complete` | la dernière carte du paquet est triée (une seule fois par semaine) | `semaine`, `films_gardes`, `films_total`, `categories` |
| `screening_click` | clic sur un bouton de réservation (fiche film ou liste du swipe) | `film_slug`, `cinema`, `semaine`, `link_url` |
| `newsletter_confirmed` | affichage de `/newsletter/merci/` après confirmation | aucun |
| `location_used` | la personne choisit un lieu (position, adresse ou ville) | `methode` (`gps`, `adresse` ou `ville`), jamais de coordonnées |
| `group_create` | création d'un groupe | `semaine` |
| `group_join` | un lien de groupe est ouvert et fusionné | `semaine`, `membres` |
| `group_share` | partage ou copie du lien du groupe | `methode`, `membres` |
| `card_set` | une carte est cochée ou décochée sur `/cartes/` | `carte` (id), `etat` (`ajoutee` ou `retiree`) |
| `calculator_use` | première utilisation du curseur ou du prix du simulateur | aucun |
| `film_share` | partage d'une fiche film (WhatsApp ou partage du téléphone) | `film_slug`, `semaine`, `methode` |
| `trailer_click` | clic sur la bande-annonce d'une fiche | `film_slug`, `semaine` |

Dans GA4 : marquer comme événements clés `swipe_complete`, `screening_click` et `newsletter_confirmed`, et créer des dimensions
personnalisées (portée Événement) pour `film_slug`, `cinema`, `semaine`, `films_gardes`, `films_total`, `categories` et `methode` si on veut les voir dans les rapports.
Les chiffres sont des planchers : les visiteurs qui refusent ne sont pas comptés. Les cookies GA durent 13 mois au maximum,
le choix du visiteur est gardé 6 mois.

## Tester chez soi (facultatif)

Avec Node 20 ou plus : `npm install` puis `npm run dev`, et ouvrir l'adresse affichée.
Pour tester sans préfixe d'adresse : `SITE_URL=http://localhost:8080 npm run dev`.
`GA4_ID=G-TEST npm run build` permet de voir la bannière en local.

## Choix techniques

- Eleventy (génération statique) : Markdown et YAML seulement. Pas de base de données, pas de compte, pas de serveur.
- Les polices (Fredoka, Figtree, Caveat, depuis Google Fonts) sont hébergées dans `src/assets/fonts/` : aucun appel à Google
  au chargement, ce qui évite de devoir demander un consentement pour elles.
- Les affiches sont redimensionnées et converties en WebP automatiquement à la construction.
- La liste du swipe, les filtres, le prénom et les groupes sont dans le `localStorage` du navigateur du visiteur, rien n'est envoyé.
- Le contenu d'un lien de groupe est traité comme non fiable : validé, nettoyé et affiché en texte seulement.
- Le site ne contient aucune donnée de film réelle : tarifs, dates et sources sont à relever et saisir par la rédaction.

## Nouveautés de la version 2

### Mes cartes et prix perso (`contenu/cartes.yml`, page `/cartes/`)
Le visiteur coche ses cartes (gardées dans son navigateur). Les fiches film affichent alors son prix (séance incluse avec un
abonnement du bon circuit, ou tarif réduit identique au type du tarif de la fiche). La page `/cartes/` calcule à partir de combien de
films par mois un abonnement est rentable, avec le prix de référence et sa source. Pour ajouter une carte : copier un bloc de
`cartes.yml`. Chaque prix demande source, lien et date. `circuit` doit être le même mot que le champ `circuit` des fiches cinéma.

### "Et à la maison ?" et bande-annonce (fiche film)
Champs facultatifs `maison` (1 ou 2 titres, date et page de vérification obligatoires, abonnement facultatif) et `bande_annonce`
(lien sortant, rien n'est intégré). Voir `modeles/film.md`. Le bloc est hors du verdict en trois lignes.

### Statistiques de la communauté et groupes en direct (facultatif)
Voir `backend/README.md`. Tant que `stats.endpoint` est vide dans `contenu/reglages.yml`, rien ne change : pas de pourcentage,
groupes par liens. Une fois le service déployé : accroche « X % des N personnes qui ont trié ce film l'ont gardé » sur les fiches
(à partir de `stats.seuil` personnes, 30 par défaut), et groupes en direct avec lien court. L'envoi des tris demande que le visiteur
ait accepté le comptage (la bannière apparaît même sans GA4).

### Mode démo pour la présentation (`stats.demo: true`)
Affiche des pourcentages et un groupe de démonstration FICTIFS, étiquetés « Démo, données fictives », pour montrer toutes les
fonctionnalités sans utilisateurs. S'éteint seul dès que `stats.endpoint` est rempli. À remettre sur `false` avant de citer le moindre
chiffre dans un livrable : les chiffres de la démo ne sont pas des résultats.

### Guide des tarifs (`/tarifs/`) et fraîcheur des prix
La page rassemble les prix moyens de `contenu/cartes.yml` (bloc `prix_moyens`), les abonnements, et un tableau des relevés de l'équipe
cinéma par cinéma, construit automatiquement à partir des tarifs saisis dans les fiches film (le plus récent par cinéma et par type).
Chaque relevé affiche son ancienneté. Au-delà de `fraicheur_jours` (reglages.yml, 14 par défaut, (H)), la fiche et la page affichent
« à revérifier » et la construction du site le signale. Le site se reconstruit chaque jour : l'ancienneté se met à jour toute seule.

## Version WordPress (démo)

Le dossier `wordpress/` contient le thème WordPress CinéSwipe (`cineswipe-theme.zip`) et `blueprint.json`, qui installe
WordPress, le thème, le contenu de départ et les réglages. Démo publique, gratuite et sans hébergeur :

https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/gabindupontt-tech/cineswipe/main/wordpress/blueprint.json

Le site est construit dans le navigateur de chaque visiteur (quelques secondes au premier chargement). Ce qu'on y modifie
n'est pas enregistré et la démo n'est pas référencée par les moteurs de recherche.
