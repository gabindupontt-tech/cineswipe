// Lit contenu/reglages.yml et calcule les valeurs dérivées (origine, préfixe de chemin).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as chargerYaml } from "js-yaml";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function lireReglages() {
  const brut = chargerYaml(fs.readFileSync(path.join(racine, "contenu", "reglages.yml"), "utf8")) || {};
  const urlBrute = String(process.env.SITE_URL || brut.url || "http://localhost:8080").replace(/\/+$/, "");
  const u = new URL(urlBrute);
  const basePath = u.pathname.replace(/\/+$/, ""); // "" ou "/cineswipe"
  return {
    ...brut,
    ga4_id: String(process.env.GA4_ID ?? brut.ga4_id ?? "").trim(),
    url: urlBrute,
    origin: u.origin,
    basePath,
    pathPrefix: basePath + "/",
    racine,
  };
}
