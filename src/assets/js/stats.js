/* Statistiques de la communauté : "78 % des personnes qui ont trié ce film l'ont gardé".
   - Envoi : seulement si la personne a accepté le comptage (bannière), une seule fois par semaine et par navigateur,
     sans nom ni identifiant : seulement la semaine et, pour chaque film, "gardé" ou "écarté".
   - Affichage : seulement si assez de personnes ont trié le film (seuil dans reglages.yml). En dessous, rien.
   Sans adresse de service (stats.endpoint vide), ce fichier ne fait rien. */
(function () {
  var API = (document.body.getAttribute("data-api") || "").replace(/\/+$/, "");
  var SEUIL = parseInt(document.body.getAttribute("data-seuil"), 10) || 30;
  var DEMO = document.body.getAttribute("data-demo") === "1" && !API;
  if (!API && !DEMO) return;

  function accepte() { return typeof window.csConsent === "function" && window.csConsent() === "granted"; }

  window.csStats = {
    envoyer: function (semaine, decisions) {
      if (!accepte() || !/^\d{4}-\d{2}-\d{2}$/.test(semaine)) return;
      var cle = "cs_stats_" + semaine;
      try { if (localStorage.getItem(cle)) return; } catch (e) {}
      var v = {}, n = 0;
      Object.keys(decisions || {}).forEach(function (slug) {
        if (decisions[slug] === "keep" || decisions[slug] === "skip") { v[slug] = decisions[slug] === "keep" ? "k" : "s"; n++; }
      });
      if (!n) return;
      fetch(API + "/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ s: semaine, v: v }), keepalive: true })
        .then(function (r) { if (r.ok) { try { localStorage.setItem(cle, "1"); } catch (e) {} } }, function () {});
    }
  };

  var el = document.getElementById("stat-film");
  if (!el) return;

  /* Mode démo : pourcentage et effectif FICTIFS, calculés à partir du nom du film, toujours étiquetés comme tels. */
  if (DEMO) {
    var h = 0, nom = el.getAttribute("data-slug");
    for (var i = 0; i < nom.length; i++) h = (h * 31 + nom.charCodeAt(i)) >>> 0;
    var pct = 52 + (h % 41), n = 38 + (h % 97);
    el.textContent = "Démo, données fictives : " + pct + " % des " + n + " personnes ont gardé ce film dans le swipe.";
    el.classList.add("stat-film--demo");
    el.hidden = false;
    return;
  }
  var slug = el.getAttribute("data-slug"), semaine = el.getAttribute("data-semaine");
  var CACHE = "cs_statcache_" + semaine;

  function afficher(films) {
    var c = films && films[slug];
    if (!Array.isArray(c)) return;
    var k = Number(c[0]) || 0, s = Number(c[1]) || 0, n = k + s;
    if (n < SEUIL) return;
    var pct = Math.round(100 * k / n);
    el.textContent = pct + " % des " + n + " personnes qui ont trié ce film dans le swipe l'ont gardé.";
    el.hidden = false;
  }

  try {
    var c = JSON.parse(sessionStorage.getItem(CACHE));
    if (c && Date.now() - c.t < 300000) { afficher(c.f); return; }
  } catch (e) {}
  fetch(API + "/stats/" + encodeURIComponent(semaine))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (o) {
      if (!o || typeof o.films !== "object") return;
      try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), f: o.films })); } catch (e) {}
      afficher(o.films);
    })
    .catch(function () {});
})();
