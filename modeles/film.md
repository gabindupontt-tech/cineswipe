---
# ====================================================================
#  MODÈLE DE FICHE FILM
#  Comment l'utiliser :
#   1. Copie tout ce fichier dans le dossier  contenu/films/
#   2. Donne-lui le nom du film, en minuscules, sans accent ni espace,
#      avec des tirets : par exemple  le-nom-du-film.md
#   3. Remplace chaque texte entre guillemets. Garde les deux-points et les retraits (espaces) tels quels.
#   4. Ajoute le nom du fichier (sans .md) dans le fichier de la semaine (dossier contenu/semaines/).
#  Les lignes qui commencent par # sont des commentaires : elles ne s'affichent pas sur le site.
#  Si un champ obligatoire manque, la mise en ligne échoue et le message dit quel fichier corriger.
# ====================================================================

titre: "Titre du film"                 # obligatoire
titre_original: ""                     # facultatif, à laisser vide si identique
categorie: nouveau                     # nouveau = à l'affiche | independant = film de cinéma indépendant, petit distributeur |
                                       # reprise = film ancien ressorti en salle (ex. une reprise dans un circuit)
# annee: 1998                          # OBLIGATOIRE pour une reprise : année de sortie d'origine du film
sortie: 2026-10-21                     # obligatoire : date de sortie (ou de ressortie pour une reprise) en France (AAAA-MM-JJ)
duree: 112                             # facultatif : durée en minutes, nombre entier
genres: [Comédie, Drame]               # facultatif : 1 à 3 genres, entre crochets, séparés par des virgules
realisateur: "Prénom Nom"              # facultatif
resume: "Une phrase écrite par nous."  # facultatif : ne recopie pas le synopsis d'un site, écris le tien

# Verdict : 3 lignes, toujours dans cet ordre. Une phrase courte chacune (160 caractères maximum).
verdict:
  pour_qui: "Qui va aimer ce film, et avec qui y aller."
  prix: "Ce que vaut la séance par rapport à son tarif."
  pourquoi_en_salle: "Ce que la salle apporte et que l'écran de chez toi ne donne pas."

# Bande-annonce officielle (facultatif) : simple lien, rien n'est intégré à la page. Garde la page du distributeur ou une chaîne officielle.
# bande_annonce: https://...

bon_plan: false                        # true = une pastille verte "Bon plan" apparaît sur la carte

# Tarif constaté : relevé par nous, sur une page précise, un jour précis. Rien n'est publiable sans source ni date.
tarif:
  montant: 8.26                        # nombre avec un POINT, pas une virgule
  type: "étudiant"                     # court (14 caractères maximum) : étudiant, plein tarif, moins de 26...
  cinema: "Nom du cinéma"
  source_nom: "Nom de la page (ex. Tarifs du cinéma X)"
  source_url: https://...              # lien complet de la page où tu as relevé le prix
  date: 2026-10-19                     # jour du relevé (AAAA-MM-JJ)

# Bouton "Réserver sur le site du cinéma" : la page de réservation du cinéma lui-même.
reservation:
  cinema: "Nom du cinéma"
  url: https://...

# Où le voir : les cinémas qui passent le film. Chaque "cinema" est le nom d'un fichier de contenu/cinemas/ (sans .md).
# "url" est facultatif : la page de CE film chez ce cinéma. Sans "url", le bouton mène à la page d'accueil du cinéma.
# Si le prix est différent dans un cinéma, ajoute pour lui montant, type, source_nom, source_url et date (les cinq ensemble,
# comme dans "tarif" ci-dessus). Sinon, le site dit que le tarif a été relevé dans le cinéma de "tarif" et de vérifier le reste.
projections:
  - cinema: nom-du-fichier-du-cinema
    url: https://...
  # - cinema: un-autre-cinema
  #   montant: 6.5
  #   type: "étudiant"
  #   source_nom: "Tarifs du cinéma"
  #   source_url: https://...
  #   date: 2026-10-19

# "Et à la maison ?" (facultatif) : 1 ou 2 titres du même registre déjà sur une plateforme, pour ceux qui préfèrent attendre.
# Obligatoire avec ce bloc : la date de vérification et la page où tu as vérifié (les catalogues changent). Rien d'inventé.
# maison:
#   verifie_le: 2026-10-26
#   source_nom: "Page de la plateforme où tu as vérifié"
#   source_url: https://...
#   titres:
#     - titre: "Titre du film ou de la série"
#       plateforme: "Nom de la plateforme"
#       pourquoi: "Pourquoi c'est le bon plan pour la même envie, en une phrase."
#   abonnement:                        # facultatif : pour comparer au prix de la séance
#     plateforme: "Nom de la plateforme"
#     montant: 0.00                    # prix mensuel, avec un point
#     source_nom: "Page des tarifs"
#     source_url: https://...
#     date: 2026-10-26

# Affiche (facultatif). Dépose l'image dans contenu/affiches/ puis écris son nom ici.
# Format jpg ou png. Le site la redimensionne tout seul. Vérifie que tu as le droit de l'utiliser.
# affiche: nom-du-fichier.jpg
# affiche_alt: "Description de l'affiche pour les personnes qui ne la voient pas"
# affiche_credit: "Crédit exact de l'affiche (distributeur, photographe...)"
---

Tout ce qui est écrit ici, sous la ligne ci-dessus, est facultatif. Cela s'affiche comme un court
paragraphe en bas de la fiche (une note de la rédaction, par exemple). Efface ce texte si tu n'en as pas besoin.
