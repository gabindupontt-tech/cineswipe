---
# ====================================================================
#  MODÈLE DE CINÉMA
#  1. Copie ce fichier dans contenu/cinemas/ sous le nom du cinéma, en minuscules, sans accent ni espace :
#     par exemple  cinema-de-la-ville.md
#  2. Remplace chaque valeur. Les fiches de film utilisent ce nom de fichier (sans .md) dans "projections".
#  Les coordonnées servent à classer les cinémas du plus proche au plus éloigné. Elles ne quittent jamais
#  l'appareil du visiteur : le site compare simplement deux positions dans son navigateur.
# ====================================================================
nom: "Nom du cinéma"
ville: "Ville"
adresse: "12 rue Exemple, 63000 Ville"   # numéro, rue, code postal
type: independant                       # circuit (UGC, Pathé, CGR...) ou independant (art et essai, salle associative, cinéma de ville)
# circuit: "Pathé"                       # facultatif : nom du circuit
lat: 45.0000                            # latitude : nombre avec un POINT. Clic droit sur le cinéma dans OpenStreetMap > "Afficher l'adresse"
lng: 3.0000                             # longitude : nombre avec un POINT
site: https://...                       # page d'accueil du cinéma (https:// obligatoire)
---
