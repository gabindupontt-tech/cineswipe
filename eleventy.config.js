import { lireReglages } from "./lib/reglages.js";
import { dateFr } from "./lib/format.js";
import { jsonldFilm, jsonldSite } from "./lib/seo.js";

export default function (eleventyConfig) {
  const r = lireReglages();

  // Fichiers copiés tels quels : CSS, JS, polices, logo.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Le contenu édité par l'équipe déclenche une reconstruction en mode développement.
  eleventyConfig.addWatchTarget("contenu/");
  eleventyConfig.addWatchTarget("lib/");

  // URL absolue (pour canonical, partage, sitemap) en tenant compte du préfixe GitHub Pages.
  eleventyConfig.addFilter("abs", (chemin) => r.origin + r.basePath + chemin);
  eleventyConfig.addFilter("dateFr", (iso) => dateFr(iso));
  // JSON sûr à injecter dans un <script> (empêche la fermeture prématurée de la balise).
  eleventyConfig.addFilter("jsonSur", (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(new RegExp("[\u2028\u2029]", "g"), ""));
  eleventyConfig.addFilter("estAcompleter", (v) => typeof v === "string" && v.startsWith("A_COMPLETER"));
  eleventyConfig.addFilter("sansAcompleter", (v) => String(v).replace(/^A_COMPLETER\s*:?\s*/, ""));
  eleventyConfig.addFilter("jsonldFilm", jsonldFilm);
  eleventyConfig.addFilter("jsonldSite", jsonldSite);
  eleventyConfig.addFilter("initiale", (t) => String(t).trim().charAt(0));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    pathPrefix: r.pathPrefix,
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
