// Petites fonctions de mise en forme (français).
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

export function isoDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  return null;
}

// "2026-10-26" -> "26 octobre 2026"
export function dateFr(iso, avecAnnee = true) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-").map(Number);
  const jour = j === 1 ? "1er" : String(j);
  return `${jour} ${MOIS[m - 1]}${avecAnnee ? " " + a : ""}`;
}

export function ajouteJours(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function aujourdhuiParis() {
  if (process.env.BUILD_DATE) return process.env.BUILD_DATE;
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

// 8.26 -> "8,26 €" (espace insécable)
export function prixFr(n) {
  return n.toFixed(2).replace(".", ",") + " €";
}

export function dureeFr(min) {
  if (!min) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export function tronque(texte, max) {
  const t = String(texte).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max - 1);
  return coupe.slice(0, coupe.lastIndexOf(" ")).replace(/[,;:\-–]$/, "") + "…";
}

export function finDePhrase(t) {
  const s = String(t).trim();
  return /[.!?…]$/.test(s) ? s : s + ".";
}
