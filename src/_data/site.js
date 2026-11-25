import { lireReglages } from "../../lib/reglages.js";

const r = lireReglages();

// Repère les champs du fichier de réglages qui commencent encore par A_COMPLETER.
const aCompleter = [];
(function parcourir(o, chemin) {
  if (typeof o === "string" && o.startsWith("A_COMPLETER")) aCompleter.push(chemin);
  else if (Array.isArray(o)) o.forEach((x, i) => parcourir(x, `${chemin}[${i}]`));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) parcourir(v, chemin ? `${chemin} > ${k}` : k);
})(r, "");
const ignores = ["racine"];

if (r.url.includes("a-completer")) aCompleter.push("url");
if (aCompleter.length) console.warn("[cinéswipe] ⚠ contenu/reglages.yml : à compléter avant la mise en ligne : " + aCompleter.join(", "));
if (!r.ga4_id) console.warn("[cinéswipe] ⚠ ga4_id est vide : aucune mesure d'audience et pas de bannière de consentement (normal tant que GA4 n'est pas branché).");
if (!r.newsletter?.lien) console.warn("[cinéswipe] ⚠ newsletter > lien est vide : le bouton de newsletter est affiché mais désactivé.");

export default {
  nom: "CinéSwipe",
  slogan: "Les films qui valent le prix, et comment les réserver.",
  ...Object.fromEntries(Object.entries(r).filter(([k]) => !ignores.includes(k))),
  aCompleter,
};
