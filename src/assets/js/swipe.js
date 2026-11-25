/* Swipe : l'utilisateur garde ou écarte les films de la semaine, puis obtient un message partageable.
   Aucune donnée n'est envoyée : la liste reste dans le localStorage de son navigateur. */
(function () {
  var app = document.getElementById("swipe-app");
  var jsonEl = document.getElementById("swipe-data");
  if (!app || !jsonEl) return;

  var films = JSON.parse(jsonEl.textContent);
  var cinemasEl = document.getElementById("swipe-cinemas");
  var cinemas = cinemasEl ? JSON.parse(cinemasEl.textContent) : [];
  var parSlug = {};
  films.forEach(function (f) { parSlug[f.slug] = f; });
  var semaineId = app.getAttribute("data-semaine");
  var semaineLabel = app.getAttribute("data-label");
  var CLE = "cs_swipe_" + semaineId;
  var CLE_FILTRE = "cs_filtre";
  var CATEGORIES = ["nouveau", "independant", "reprise"];
  var SEUIL = 90;

  var pile = document.getElementById("swipe-stack");
  var cartes = Array.prototype.slice.call(pile.querySelectorAll(".swipe-card"));
  var top = document.getElementById("swipe-top");
  var intro = document.getElementById("swipe-intro");
  var progres = document.getElementById("swipe-progress");
  var annuler = document.getElementById("swipe-undo");
  var actions = document.getElementById("swipe-actions");
  var live = document.getElementById("swipe-live");
  var resultat = document.getElementById("swipe-result");
  var titreRes = document.getElementById("swipe-result-titre");
  var liste = document.getElementById("swipe-liste");
  var partage = document.getElementById("swipe-partage");
  var texteEl = document.getElementById("swipe-texte");
  var btnShare = document.getElementById("swipe-share");
  var btnWa = document.getElementById("swipe-whatsapp");
  var btnCopy = document.getElementById("swipe-copy");
  var copyLive = document.getElementById("swipe-copy-live");
  var btnRestart = document.getElementById("swipe-restart");
  var filtreEl = document.getElementById("swipe-filtre");
  var resteEl = document.getElementById("swipe-reste");
  var resteTexte = document.getElementById("swipe-reste-texte");
  var resteBtn = document.getElementById("swipe-reste-btn");
  var ouEl = document.getElementById("swipe-ou");
  var ouZone = document.getElementById("swipe-ou-zone");
  var groupeEl = document.getElementById("swipe-groupe");

  var etat = { d: {}, h: [], fini: false, evt: false };
  var filtre = { nouveau: true, independant: true, reprise: true };
  var animation = false;

  /* ---------- Persistance (try/catch : le stockage peut être indisponible) ---------- */
  function charger() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf("cs_swipe_") === 0 && k !== CLE) localStorage.removeItem(k);
      });
      var brut = JSON.parse(localStorage.getItem(CLE));
      if (brut && brut.d) {
        Object.keys(brut.d).forEach(function (s) {
          if (parSlug[s] && (brut.d[s] === "keep" || brut.d[s] === "skip")) etat.d[s] = brut.d[s];
        });
        etat.h = (brut.h || []).filter(function (s) { return etat.d[s]; });
        etat.fini = !!brut.fini;
        etat.evt = !!brut.evt;
      }
      var f = JSON.parse(localStorage.getItem(CLE_FILTRE));
      if (f && typeof f === "object") {
        CATEGORIES.forEach(function (c) { if (f[c] === false) filtre[c] = false; });
        if (!CATEGORIES.some(function (c) { return filtre[c]; })) filtre = { nouveau: true, independant: true, reprise: true };
      }
    } catch (e) {}
  }
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
  }
  function sauverFiltre() {
    try { localStorage.setItem(CLE_FILTRE, JSON.stringify(filtre)); } catch (e) {}
  }

  /* ---------- Catégories ---------- */
  function actif(slug) { return filtre[parSlug[slug].categorie]; }
  function nbParCat(cat) { return films.filter(function (f) { return f.categorie === cat; }).length; }
  function dessinerFiltre() {
    if (!filtreEl) return;
    var presentes = CATEGORIES.filter(function (c) { return nbParCat(c) > 0; });
    filtreEl.hidden = presentes.length < 2;
    filtreEl.querySelectorAll("[data-cat]").forEach(function (b) {
      var c = b.getAttribute("data-cat");
      b.hidden = nbParCat(c) === 0;
      b.setAttribute("aria-pressed", filtre[c] ? "true" : "false");
      var n = b.querySelector(".toggle__n");
      if (n) n.textContent = "(" + nbParCat(c) + ")";
    });
  }
  function etiquette(f) {
    return f.categorie === "reprise" ? "reprise" + (f.annee ? " " + f.annee : "") : (f.categorie === "independant" ? "indépendant" : "");
  }

  /* ---------- Affichage de la pile ---------- */
  function restantes() {
    return cartes.filter(function (c) { var sl = c.getAttribute("data-slug"); return !etat.d[sl] && actif(sl); });
  }
  function carteDuHaut() { return restantes()[0] || null; }

  function dessiner() {
    var reste = restantes();
    cartes.forEach(function (c) {
      var slug = c.getAttribute("data-slug");
      c.classList.remove("is-dragging");
      c.style.transform = "";
      c.style.opacity = "";
      c.querySelectorAll(".swipe-stamp").forEach(function (s) { s.style.opacity = ""; });
      if (etat.d[slug] || !actif(slug)) {
        c.classList.add("is-gone");
        c.removeAttribute("data-pos");
        c.setAttribute("inert", "");
        c.setAttribute("aria-hidden", "true");
      } else {
        c.classList.remove("is-gone");
        var rang = reste.indexOf(c);
        c.setAttribute("data-pos", rang < 3 ? String(rang) : "far");
        if (rang === 0) { c.removeAttribute("inert"); c.removeAttribute("aria-hidden"); }
        else { c.setAttribute("inert", ""); c.setAttribute("aria-hidden", "true"); }
      }
    });
    var total = films.filter(function (f) { return filtre[f.categorie]; }).length;
    var fait = total - reste.length;
    progres.textContent = reste.length ? "Film " + (fait + 1) + " sur " + total : total + " films triés";
    dessinerFiltre();
    annuler.disabled = etat.h.length === 0;
  }

  function montrerPile() {
    resultat.hidden = true;
    if (intro) intro.hidden = false;
    top.hidden = false;
    actions.hidden = false;
    pile.hidden = false;
    dessiner();
  }

  /* ---------- Décision ---------- */
  function decider(choix) {
    if (animation) return;
    var carte = carteDuHaut();
    if (!carte) return;
    var slug = carte.getAttribute("data-slug");
    var sens = choix === "keep" ? 1 : -1;
    animation = true;
    carte.classList.remove("is-dragging");
    carte.style.transform = "translateX(" + sens * window.innerWidth * 0.9 + "px) rotate(" + sens * 24 + "deg)";
    carte.style.opacity = "0";
    window.setTimeout(function () {
      etat.d[slug] = choix;
      etat.h.push(slug);
      animation = false;
      live.textContent = (choix === "keep" ? "Gardé : " : "Écarté : ") + parSlug[slug].titre + ".";
      if (restantes().length === 0) terminer(true);
      else { sauver(); dessiner(); }
    }, 260);
  }

  function annulerDernier() {
    if (!etat.h.length) return;
    var slug = etat.h.pop();
    delete etat.d[slug];
    etat.fini = false;
    sauver();
    live.textContent = "Dernier choix annulé : " + parSlug[slug].titre + ".";
    montrerPile();
  }

  function recommencer() {
    etat = { d: {}, h: [], fini: false, evt: false };
    sauver();
    montrerPile();
    top.scrollIntoView({ block: "start" });
  }

  /* ---------- Résultat et partage ---------- */
  function messagePartage(gardes) {
    var lignes = ["Ma sélection CinéSwipe (" + semaineLabel.charAt(0).toLowerCase() + semaineLabel.slice(1) + ") :", ""];
    gardes.forEach(function (f, i) {
      var cat = etiquette(f);
      lignes.push((i + 1) + ". " + f.titre + (cat ? " (" + cat + ")" : "") + ", " + f.montantFr + " (" + f.tarifType + ")");
      lignes.push(f.urlAbs);
    });
    lignes.push("", "Qui vient ?");
    return lignes.join("\n");
  }

  function creer(tag, classe, texte) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texte) el.textContent = texte;
    return el;
  }

  function terminer(nouveau) {
    etat.fini = true;
    sauver();
    var gardes = films.filter(function (f) { return etat.d[f.slug] === "keep"; });

    pile.hidden = true;
    if (intro) intro.hidden = true;
    top.hidden = true;
    actions.hidden = true;

    var tries = Object.keys(etat.d).length;
    titreRes.textContent = gardes.length
      ? "Ta sélection : " + gardes.length + " film" + (gardes.length > 1 ? "s" : "") + " sur " + tries
      : "Tu n'as rien gardé cette semaine";

    /* Films pas encore triés parce que leur catégorie était masquée. */
    var nonTries = films.filter(function (f) { return !etat.d[f.slug]; });
    if (resteEl) {
      resteEl.hidden = nonTries.length === 0;
      if (nonTries.length) {
        var cats = [];
        nonTries.forEach(function (f) { var e = f.categorie === "reprise" ? "reprises" : "indépendants"; if (f.categorie !== "nouveau" && cats.indexOf(e) < 0) cats.push(e); });
        resteTexte.textContent = "Il reste " + nonTries.length + " film" + (nonTries.length > 1 ? "s" : "") + " à trier" + (cats.length ? " (" + cats.join(", ") + ")" : "") + ".";
      }
    }

    liste.textContent = "";
    gardes.forEach(function (f) {
      var li = creer("li");
      var gauche = creer("div");
      var lien = creer("a", "swipe-liste__titre", f.titre);
      lien.href = f.url;
      gauche.appendChild(lien);
      gauche.appendChild(creer("span", "swipe-liste__prix price", f.montantFr));
      if (f.categorie !== "nouveau") {
        var chips = creer("ul", "chips");
        chips.setAttribute("aria-label", "Catégorie");
        chips.appendChild(creer("li", f.categorie === "reprise" ? "chip chip--reprise" : "chip chip--indep",
          f.categorie === "reprise" ? "Reprise" + (f.annee ? " " + f.annee : "") : "Indépendant"));
        gauche.appendChild(chips);
      }
      var droite = creer("div", "swipe-liste__actions");
      var resa = creer("a", "btn btn--secondary btn--small");
      resa.href = f.reservationUrl;
      resa.target = "_blank";
      resa.rel = "noopener noreferrer";
      resa.setAttribute("data-track", "screening_click");
      resa.setAttribute("data-film", f.slug);
      resa.setAttribute("data-cinema", f.cinema);
      resa.setAttribute("data-semaine", semaineId);
      resa.appendChild(document.createTextNode("Réserver"));
      resa.appendChild(creer("span", "sr-only", " " + f.titre + " sur le site du cinéma (s'ouvre dans un nouvel onglet)"));
      droite.appendChild(resa);
      li.appendChild(gauche);
      li.appendChild(droite);
      liste.appendChild(li);
    });

    if (gardes.length) {
      var texte = messagePartage(gardes);
      texteEl.textContent = texte;
      btnWa.href = "https://wa.me/?text=" + encodeURIComponent(texte);
      btnShare.hidden = !navigator.share;
      partage.hidden = false;
    } else {
      partage.hidden = true;
    }

    /* Où les voir : cinémas qui passent les films gardés, du plus proche au plus éloigné. */
    if (ouEl) {
      var peutLocaliser = gardes.length > 0 && cinemas.length > 0 && window.csLieu;
      ouEl.hidden = !peutLocaliser;
      if (peutLocaliser) window.csLieu.liste(ouZone, gardes, cinemas, { semaine: semaineId });
    }
    if (groupeEl) groupeEl.hidden = false;

    resultat.hidden = false;
    if (nouveau) {
      if (!etat.evt) {
        etat.evt = true;
        sauver();
        if (window.csStats) window.csStats.envoyer(semaineId, etat.d);
        if (typeof window.csTrack === "function") {
          window.csTrack("swipe_complete", {
            semaine: semaineId, films_gardes: gardes.length, films_total: tries,
            categories: CATEGORIES.filter(function (c) { return filtre[c]; }).join(",")
          });
        }
      }
      resultat.focus();
      resultat.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  btnShare.addEventListener("click", function () {
    if (navigator.share) navigator.share({ text: texteEl.textContent }).catch(function () {});
  });
  btnCopy.addEventListener("click", function () {
    var texte = texteEl.textContent;
    function ok() { copyLive.textContent = "Message copié."; btnCopy.textContent = "Copié !"; window.setTimeout(function () { btnCopy.textContent = "Copier le message"; }, 2000); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(ok, function () { selectionner(); });
    } else selectionner();
    function selectionner() {
      var r = document.createRange();
      r.selectNodeContents(texteEl);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      copyLive.textContent = "Message sélectionné, copie-le avec ton clavier ou ton menu.";
    }
  });

  /* ---------- Boutons et clavier ---------- */
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-swipe]");
    if (b) decider(b.getAttribute("data-swipe"));
  });
  annuler.addEventListener("click", annulerDernier);
  if (filtreEl) filtreEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cat]");
    if (!b || animation) return;
    var c = b.getAttribute("data-cat");
    var autres = CATEGORIES.filter(function (x) { return x !== c && filtre[x] && nbParCat(x) > 0; });
    if (filtre[c] && autres.length === 0) { live.textContent = "Garde au moins une catégorie."; return; }
    filtre[c] = !filtre[c];
    sauverFiltre();
    live.textContent = b.firstChild.textContent.trim() + (filtre[c] ? " : affichés." : " : masqués.");
    if (restantes().length === 0) terminer(true); else dessiner();
  });
  if (resteBtn) resteBtn.addEventListener("click", function () {
    filtre = { nouveau: true, independant: true, reprise: true };
    sauverFiltre();
    etat.fini = false;
    sauver();
    montrerPile();
    top.scrollIntoView({ block: "start" });
  });
  btnRestart.addEventListener("click", recommencer);
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !resultat.hidden) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); decider("keep"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); decider("skip"); }
  });

  /* ---------- Geste tactile / souris ---------- */
  var drag = null;
  pile.addEventListener("pointerdown", function (e) {
    if (animation || (e.button && e.button !== 0)) return;
    var carte = carteDuHaut();
    if (!carte || !carte.contains(e.target) || e.target.closest("a, button")) return;
    drag = { carte: carte, x: e.clientX, id: e.pointerId, dx: 0, actif: false };
  });
  pile.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    if (!drag.actif && Math.abs(drag.dx) > 6) {
      drag.actif = true;
      drag.carte.classList.add("is-dragging");
      try { drag.carte.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (drag.actif) {
      drag.carte.style.transform = "translateX(" + drag.dx + "px) rotate(" + drag.dx / 18 + "deg)";
      var force = Math.min(Math.abs(drag.dx) / SEUIL, 1);
      drag.carte.querySelector(".swipe-stamp--keep").style.opacity = drag.dx > 0 ? force : 0;
      drag.carte.querySelector(".swipe-stamp--skip").style.opacity = drag.dx < 0 ? force : 0;
    }
  });
  function finGeste(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag;
    drag = null;
    if (!d.actif) return;
    if (e && e.type === "pointerup" && Math.abs(d.dx) > SEUIL) {
      decider(d.dx > 0 ? "keep" : "skip");
    } else {
      d.carte.classList.remove("is-dragging");
      d.carte.style.transform = "";
      d.carte.querySelectorAll(".swipe-stamp").forEach(function (s) { s.style.opacity = ""; });
    }
  }
  pile.addEventListener("pointerup", finGeste);
  pile.addEventListener("pointercancel", finGeste);
  /* ---------- Démarrage ---------- */
  charger();
  if (etat.fini || restantes().length === 0) { dessiner(); terminer(false); }
  else montrerPile();
})();
