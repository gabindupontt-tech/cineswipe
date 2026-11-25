// Calculs communs à toutes les pages : indexation, couleur d'accent, données structurées.
import { jsonldFilm, jsonldSite, jsonldArticle } from "../lib/seo.js";

export default {
  eleventyComputed: {
    // Une page qui montre une fiche d'exemple n'est jamais indexée.
    noindex: (d) => {
      if (d.kind === "home" || d.kind === "swipe") return !d.contenu.courante || d.contenu.courante.exemple;
      if (d.kind === "film") return d.film.exemple;
      if (d.kind === "week") return d.semaine.exemple;
      if (d.kind === "tarifs") return d.contenu.aDesExemples;
      if (d.kind === "archives") return d.contenu.archives.some((x) => x.exemple);
      if (d.kind === "article") return d.article.enRelecture;
      return d.noindexForce === true;
    },
    // Charte : 3 couleurs vives par écran au maximum. La menthe ("Bon plan") prend la place du lilas décoratif.
    bonPlanPage: (d) => {
      if (d.kind === "home" || d.kind === "swipe") return !!d.contenu.courante?.bonPlan;
      if (d.kind === "film") return d.film.bonPlan || d.film.semaineBonPlan;
      if (d.kind === "week") return d.semaine.bonPlan;
      return false;
    },
    jsonld: (d) => {
      if (d.kind === "home") return jsonldSite();
      if (d.kind === "film") return jsonldFilm(d.film);
      if (d.kind === "article") return d.article.enRelecture ? [] : jsonldArticle(d.article);
      return [];
    },
    ogImage: (d) => (d.kind === "film" && d.film.poster ? d.film.poster.og : undefined),
    autresFilms: (d) => {
      if (d.kind !== "film") return [];
      const sem = d.contenu.semaines.find((x) => x.id === d.film.semaineId);
      return sem ? sem.films.filter((f) => f.slug !== d.film.slug) : [];
    },
    ogType: (d) => (d.kind === "film" ? "video.movie" : d.kind === "article" ? "article" : "website"),
  },
};
