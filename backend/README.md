# Service de compteurs CinéSwipe (stats de la communauté et groupes en direct)

Ce service est facultatif. Sans lui, le site fonctionne comme avant : pas de pourcentage sur les fiches, groupes par liens.
Avec lui : (1) « 78 % des 64 personnes qui ont trié ce film l'ont gardé » sur les fiches film, (2) des groupes qui se mettent
à jour tout seuls (lien court, choix de chacun visibles sans renvoyer de lien).

C'est un Cloudflare Worker (offre gratuite) avec un espace de stockage KV. À faire une seule fois, par une personne de l'équipe
(proposé : Noé, qui gère le web). Compte Cloudflare gratuit nécessaire, Node 20 ou plus.

1. Dans ce dossier `backend/` : `npx wrangler login`.
2. `npx wrangler kv namespace create CINESWIPE` : copie l'identifiant affiché dans `wrangler.toml` (ligne `id`).
3. Dans `wrangler.toml`, remplace `ALLOWED_ORIGIN` par l'adresse du site (`https://NOM-DU-COMPTE.github.io`, sans `/` final et sans le nom du dépôt).
4. `npx wrangler deploy`. Wrangler affiche l'adresse du service, de la forme `https://cineswipe-compteurs.XXX.workers.dev`.
5. Dans `contenu/reglages.yml`, colle cette adresse dans `stats > endpoint` (sans `/` final). Le seuil par défaut est 30 personnes par film.
6. Publie le site. La bannière de consentement apparaît (même sans GA4) : le comptage ne part qu'après « Accepter ».
7. Test : ouvre le site sur deux navigateurs, accepte, trie la semaine, crée un groupe avec « Mise à jour en direct », rejoins-le avec le lien court sur l'autre navigateur.

## Avant le lancement réel
Les tris faits par l'équipe et les camarades pendant les tests comptent dans les chiffres. Remets les compteurs à zéro :
`npx wrangler kv key list --binding CINESWIPE --remote`, puis `npx wrangler kv key delete --binding CINESWIPE --remote "stats:2026-10-28"`
(une clé par semaine, et `g:...` pour les groupes de test).

## Ce que le service stocke
- Statistiques : par semaine, le nombre de participations et, par film, combien l'ont gardé ou écarté. Aucun nom, aucun identifiant.
- Groupes en direct : nom du groupe, prénoms ou pseudos, choix de chacun, pendant 14 jours. À écrire dans la politique de confidentialité (déjà fait par le site quand `endpoint` est rempli).

## Limites à connaître (à écrire dans l'annexe du dossier si les chiffres sont cités)
- Les participations ne sont pas dédoublonnées : un pourcentage est un ordre de grandeur, pas une mesure d'audience.
- Les chiffres ne comptent que les visiteurs qui ont accepté le comptage, donc ce sont des planchers, et un échantillon qui n'est pas représentatif des 18 à 25 ans.
- Un accroche « X % » n'apparaît qu'à partir du seuil. Sous le seuil, ne pas l'inventer à la main.
- Quiconque connaît le code d'un groupe peut lire et modifier ses entrées : ne pas y mettre de nom complet.
