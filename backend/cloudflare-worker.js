// Service de compteurs et de groupes en direct pour CinéSwipe (Cloudflare Workers + KV, offre gratuite).
// Routes :
//   POST /stats            { s: "2026-10-28", v: { "slug-du-film": "k" | "s" } }   ajoute une participation anonyme
//   GET  /stats/:semaine   { s, films: { "slug": [gardés, écartés] } }
//   POST /g/:id            charge utile d'un groupe (voir groupes.js) : fusionne les membres, le plus récent gagne
//   GET  /g/:id            la charge utile du groupe, ou 404
// Aucune adresse IP, aucun identifiant n'est stocké par ce code. Les groupes expirent après 14 jours.
// Limites connues, à dire à l'équipe : les participations ne sont pas dédoublonnées (une personne qui efface ses données
// du navigateur peut revoter), les compteurs ne sont pas atomiques (quelques votes simultanés peuvent se perdre),
// et quiconque connaît le code d'un groupe peut le lire et le modifier.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]{4,12}$/;
const MAX_FILMS = 14;
const MAX_MEMBRES = 20;
const TTL_GROUPE = 14 * 24 * 3600;
const TTL_STATS = 120 * 24 * 3600;
const MAX_CORPS = 6000;

function cors(env, req) {
  const origine = req.headers.get("Origin") || "";
  const autorise = String(env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = autorise.includes(origine);
  return {
    "Access-Control-Allow-Origin": ok ? origine : (autorise[0] || "null"),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function rep(env, req, corps, statut = 200, extra = {}) {
  return new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(env, req), ...extra },
  });
}
async function lireJson(req) {
  const t = await req.text();
  if (t.length > MAX_CORPS) throw new Error("trop long");
  return JSON.parse(t);
}
const propre = (t, max) => String(t == null ? "" : t).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

function validerGroupe(o) {
  if (!o || o.v !== 1 || !ID.test(String(o.id)) || !DATE.test(String(o.s)) || !/^[a-f0-9]{6}$/.test(String(o.h))) return null;
  if (!Array.isArray(o.m) || o.m.length < 1 || o.m.length > MAX_MEMBRES) return null;
  const m = [];
  for (const x of o.m) {
    if (!Array.isArray(x) || typeof x[1] !== "string" || !/^[ks-]{1,40}$/.test(x[1])) return null;
    const nom = propre(x[0], 20);
    const t = Number(x[2]);
    if (!nom || !Number.isFinite(t)) return null;
    m.push([nom, x[1], t]);
  }
  return { v: 1, id: String(o.id), n: propre(o.n, 30) || "Groupe", s: String(o.s), h: String(o.h), m };
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return rep(env, req, null, 204);
    const url = new URL(req.url);
    const [racine, param] = url.pathname.split("/").filter(Boolean);
    try {
      // ---------- Statistiques ----------
      if (racine === "stats" && req.method === "POST" && !param) {
        const o = await lireJson(req);
        if (!o || !DATE.test(String(o.s)) || !o.v || typeof o.v !== "object") return rep(env, req, { erreur: "format" }, 400);
        const entrees = Object.entries(o.v);
        if (!entrees.length || entrees.length > MAX_FILMS) return rep(env, req, { erreur: "format" }, 400);
        for (const [slug, choix] of entrees) if (!SLUG.test(slug) || slug.length > 80 || (choix !== "k" && choix !== "s")) return rep(env, req, { erreur: "format" }, 400);
        const cle = "stats:" + o.s;
        const cur = JSON.parse((await env.CINESWIPE.get(cle)) || '{"n":0,"films":{}}');
        cur.n += 1;
        for (const [slug, choix] of entrees) {
          if (!cur.films[slug] && Object.keys(cur.films).length >= 40) continue;
          const c = cur.films[slug] || [0, 0];
          c[choix === "k" ? 0 : 1] += 1;
          cur.films[slug] = c;
        }
        await env.CINESWIPE.put(cle, JSON.stringify(cur), { expirationTtl: TTL_STATS });
        return rep(env, req, { ok: true }, 200);
      }
      if (racine === "stats" && req.method === "GET" && param && DATE.test(param)) {
        const cur = JSON.parse((await env.CINESWIPE.get("stats:" + param)) || '{"n":0,"films":{}}');
        return rep(env, req, { s: param, participants: cur.n, films: cur.films }, 200, { "Cache-Control": "public, max-age=60" });
      }

      // ---------- Groupes en direct ----------
      if (racine === "g" && param && ID.test(param)) {
        const cle = "g:" + param;
        if (req.method === "GET") {
          const brut = await env.CINESWIPE.get(cle);
          return brut ? rep(env, req, JSON.parse(brut)) : rep(env, req, { erreur: "introuvable" }, 404);
        }
        if (req.method === "POST") {
          const entree = validerGroupe(await lireJson(req));
          if (!entree || entree.id !== param) return rep(env, req, { erreur: "format" }, 400);
          const brut = await env.CINESWIPE.get(cle);
          let g = brut ? JSON.parse(brut) : null;
          if (!g || entree.s > g.s) g = entree;                   // nouveau groupe ou nouvelle semaine : on repart de l'entrée
          else if (entree.s < g.s || entree.h !== g.h) return rep(env, req, { erreur: "semaine" }, 409);
          else {
            const index = new Map(g.m.map((x) => [x[0].toLowerCase(), x]));
            for (const x of entree.m) {
              const k = x[0].toLowerCase();
              const ex = index.get(k);
              if (!ex && index.size >= MAX_MEMBRES) continue;
              if (!ex || x[2] > ex[2]) index.set(k, x);
            }
            g.m = [...index.values()];
          }
          await env.CINESWIPE.put(cle, JSON.stringify(g), { expirationTtl: TTL_GROUPE });
          return rep(env, req, { ok: true });
        }
      }
      return rep(env, req, { erreur: "introuvable" }, 404);
    } catch (e) {
      return rep(env, req, { erreur: "requête invalide" }, 400);
    }
  },
};
