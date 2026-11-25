// Charge contenu/sources.yml (les chiffres du contexte, avec source, lien et date) et vérifie que rien n'est sans source.
import fs from "node:fs";
import path from "node:path";
import { load as chargerYaml } from "js-yaml";
import { lireReglages } from "../../lib/reglages.js";
import { isoDate, dateFr } from "../../lib/format.js";

export default function () {
  const { racine } = lireReglages();
  const fichier = path.join(racine, "contenu", "sources.yml");
  if (!fs.existsSync(fichier)) return { contexte: [] };
  let brut;
  try { brut = chargerYaml(fs.readFileSync(fichier, "utf8")) || {}; }
  catch (e) { throw new Error(`\n\n  CONTENU À CORRIGER AVANT PUBLICATION\n\n  - contenu/sources.yml : fichier mal écrit. Détail : ${e.reason || e.message}\n`); }
  const erreurs = [];
  const contexte = (brut.contexte || []).map((x, i) => {
    const n = `contenu/sources.yml, chiffre ${i + 1}`;
    if (!x.chiffre) erreurs.push(`${n} : "chiffre" est vide.`);
    if (!x.texte) erreurs.push(`${n} : "texte" est vide.`);
    if (!x.source_nom) erreurs.push(`${n} : "source_nom" est vide : un chiffre sans source n'est pas publiable.`);
    if (!/^https:\/\/[^\s]+$/.test(String(x.source_url || ""))) erreurs.push(`${n} : "source_url" doit être un lien complet (https://...).`);
    const publie = isoDate(x.publie), consulte = isoDate(x.consulte);
    if (!consulte) erreurs.push(`${n} : "consulte" doit être la date où l'équipe a ouvert la page (2026-10-26).`);
    if (x.publie != null && !publie) erreurs.push(`${n} : "publie" doit être une date au format 2026-10-26.`);
    if (!Number.isInteger(x.sources) || x.sources < 1) erreurs.push(`${n} : "sources" est le nombre de sources indépendantes (1, 2...).`);
    return {
      chiffre: String(x.chiffre || ""), texte: String(x.texte || ""),
      sourceNom: String(x.source_nom || ""), sourceUrl: String(x.source_url || ""),
      publieFr: publie ? dateFr(publie) : "", consulteFr: consulte ? dateFr(consulte) : "",
      sources: x.sources, calcul: x.calcul === true, note: x.note ? String(x.note) : "",
    };
  });
  if (erreurs.length) throw new Error("\n\n  CONTENU À CORRIGER AVANT PUBLICATION\n\n  - " + erreurs.join("\n  - ") + "\n");
  return { contexte };
}
