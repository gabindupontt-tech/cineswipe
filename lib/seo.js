// Données structurées (JSON-LD). Les fiches d'exemple n'en produisent pas.
import { lireReglages } from "./reglages.js";

const r = lireReglages();
const isoDuree = (min) => `PT${Math.floor(min / 60)}H${min % 60}M`;

export function jsonldFilm(f) {
  if (f.exemple) return [];
  const film = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: f.titre,
    url: f.urlAbs,
    description: f.resume || f.description,
    datePublished: f.categorie === "reprise" && f.annee ? String(f.annee) : f.sortie,
  };
  if (f.titreOriginal) film.alternateName = f.titreOriginal;
  if (f.poster) film.image = f.poster.og;
  if (f.genres.length) film.genre = f.genres;
  if (f.realisateur) film.director = { "@type": "Person", name: f.realisateur };
  if (f.duree) film.duration = isoDuree(f.duree);
  const fil = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "CinéSwipe", item: r.origin + r.basePath + "/" },
      { "@type": "ListItem", position: 2, name: f.titre, item: f.urlAbs },
    ],
  };
  return [film, fil];
}

export function jsonldArticle(a) {
  const art = {
    "@context": "https://schema.org", "@type": "Article", headline: a.titre, description: a.description, url: a.urlAbs,
    inLanguage: "fr-FR", author: { "@type": "Person", name: a.auteur },
    publisher: { "@type": "Organization", name: "CinéSwipe" },
  };
  if (a.date) { art.datePublished = a.date; art.dateModified = a.date; }
  const fil = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "CinéSwipe", item: r.origin + r.basePath + "/" },
      { "@type": "ListItem", position: 2, name: "Articles", item: r.origin + r.basePath + "/articles/" },
      { "@type": "ListItem", position: 3, name: a.titre, item: a.urlAbs },
    ],
  };
  return [art, fil];
}

export function jsonldSite() {
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name: "CinéSwipe", url: r.origin + r.basePath + "/", inLanguage: "fr-FR" },
  ];
}
