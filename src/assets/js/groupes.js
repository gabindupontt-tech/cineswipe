/* Groupes entre amis, sans serveur ni compte.
   Chaque personne envoie un lien qui contient l'état du groupe (nom, prénoms, choix) dans la partie après "#",
   que le navigateur n'envoie à aucun serveur. Ouvrir le lien d'un ami fusionne ses choix dans ton exemplaire local.
   Ce n'est pas du temps réel : le groupe se met à jour quand les liens s'échangent.
   Si un service de compteurs est configuré (stats.endpoint dans reglages.yml), un groupe peut être "en direct" :
   le navigateur envoie les choix au service et récupère ceux des amis (lien court #j=). Même validation, même rendu.
   Tout ce qui vient d'un lien est traité comme une donnée non fiable : validé, nettoyé, affiché en texte seulement. */
(function () {
  var app = document.getElementById("groupes-app");
  var jsonEl = document.getElementById("groupes-data");
  if (!app || !jsonEl) return;

  var data = JSON.parse(jsonEl.textContent);
  var films = data.films, cinemas = data.cinemas, sem = data.semaine;
  var N = films.length;
  var CLE_G = "cs_groupes", CLE_P = "cs_profil";
  var MAX_MEMBRES = 20;
  var API = (document.body.getAttribute("data-api") || "").replace(/\/+$/, "");   // service de groupes en direct (facultatif)
  var memoireSeule = false;

  var el = {
    msg: document.getElementById("g-msg"),
    profil: document.getElementById("g-profil"),
    profilNote: document.getElementById("g-profil-note"),
    profilForm: document.getElementById("g-profil-form"),
    profilNom: document.getElementById("g-profil-nom"),
    principal: document.getElementById("g-principal"),
    salut: document.getElementById("g-salut"),
    profilEdit: document.getElementById("g-profil-edit"),
    nav: document.getElementById("g-liste-nav"),
    onglets: document.getElementById("g-onglets"),
    vue: document.getElementById("g-vue"),
    creerForm: document.getElementById("g-creer-form"),
    creerNom: document.getElementById("g-creer-nom"),
    rejoindreForm: document.getElementById("g-rejoindre-form"),
    rejoindreCode: document.getElementById("g-rejoindre-code"),
    sync: document.getElementById("g-sync"),
    demo: document.getElementById("g-demo")
  };

  var store = chargerStore();
  var profil = chargerProfil();
  var enAttente = null;       // lien reçu en attendant que la personne choisisse son prénom
  var enAttenteId = null;     // code de groupe en direct reçu, même principe
  var editionProfil = false;
  var confirmerQuitter = false;

  /* ---------- Stockage (try/catch : le stockage peut être indisponible) ---------- */
  function chargerStore() {
    try {
      var b = JSON.parse(localStorage.getItem(CLE_G));
      if (b && typeof b === "object" && b.groupes && typeof b.groupes === "object") return { actif: String(b.actif || ""), groupes: b.groupes };
    } catch (e) {}
    return { actif: "", groupes: {} };
  }
  function sauverStore() {
    try { localStorage.setItem(CLE_G, JSON.stringify(store)); } catch (e) { memoireSeule = true; }
  }
  function chargerProfil() {
    try {
      var b = JSON.parse(localStorage.getItem(CLE_P));
      if (b && typeof b.nom === "string" && b.nom) return { nom: b.nom };
    } catch (e) {}
    return null;
  }
  function sauverProfil() {
    try { localStorage.setItem(CLE_P, JSON.stringify(profil)); } catch (e) { memoireSeule = true; }
  }

  /* ---------- Outils ---------- */
  function creer(tag, classe, texte) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texte != null) n.textContent = texte;
    return n;
  }
  function message(t) { el.msg.textContent = t || ""; }
  function nettoyer(texte, max) {
    return String(texte == null ? "" : texte).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  }
  function cle(nom) { return nom.toLowerCase(); }
  function prixFr(n) { return n.toFixed(2).replace(".", ",").replace(",00", "") + " €"; }
  function pluriel(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function idAleatoire() {
    var a = new Uint8Array(6), t = "abcdefghijkmnpqrstuvwxyz23456789", r = "";
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < 6; i++) a[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < 6; j++) r += t.charAt(a[j] % t.length);
    return r;
  }
  function track(nom, params) { if (typeof window.csTrack === "function") window.csTrack(nom, params); }

  /* ---------- Mes choix, lus dans le swipe ---------- */
  function mesCodes() {
    var d = {};
    try { var b = JSON.parse(localStorage.getItem("cs_swipe_" + sem.id)); if (b && b.d) d = b.d; } catch (e) {}
    return films.map(function (f) { return d[f.slug] === "keep" ? "k" : d[f.slug] === "skip" ? "s" : "-"; }).join("");
  }
  function vides() { return new Array(N + 1).join("-"); }

  /* ---------- Encodage du lien (base64 sans caractères spéciaux, texte UTF-8) ---------- */
  function encoder(obj) {
    var b = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decoder(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }
  function valider(o) {
    if (!o || o.v !== 1 || typeof o.id !== "string" || !/^[a-z0-9]{4,12}$/.test(o.id)) return null;
    if (typeof o.s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.s)) return null;
    if (typeof o.h !== "string" || !/^[a-f0-9]{6}$/.test(o.h)) return null;
    if (!Array.isArray(o.m) || o.m.length === 0 || o.m.length > MAX_MEMBRES) return null;
    var membres = [];
    for (var i = 0; i < o.m.length; i++) {
      var m = o.m[i];
      if (!Array.isArray(m) || typeof m[1] !== "string" || !/^[ks-]{1,40}$/.test(m[1])) return null;
      var nom = nettoyer(m[0], 20);
      if (!nom) return null;
      var t = Number(m[2]);
      membres.push({ nom: nom, c: m[1], t: isFinite(t) ? t : 0 });
    }
    return { id: o.id, nom: nettoyer(o.n, 30) || "Groupe", s: o.s, h: o.h, membres: membres };
  }
  function extraire(texte) {
    texte = String(texte || "").trim();
    var i = texte.indexOf("g=");
    var brut = i >= 0 ? texte.slice(i + 2) : texte;
    var m = brut.match(/^[A-Za-z0-9_-]+/);
    if (!m) return null;
    try { return valider(decoder(m[0])); } catch (e) { return null; }
  }
  function objetDe(g) {
    var o = { v: 1, id: g.id, n: g.nom, s: g.sem, h: g.h, m: [] };
    Object.keys(g.membres).forEach(function (k) { var m = g.membres[k]; o.m.push([m.nom, m.c, m.t]); });
    return o;
  }
  function lienDe(g) {
    if (g.sync && API) return location.origin + location.pathname + "#j=" + g.id;   // groupe en direct : lien court
    return location.origin + location.pathname + "#g=" + encoder(objetDe(g));
  }

  /* ---------- Groupe en direct (facultatif) : le service garde le groupe 14 jours, les navigateurs se synchronisent ---------- */
  function pousser(g) {
    if (!API || !g.sync || g.sem !== sem.id || !g.moi || !g.membres[g.moi]) return;
    var m = g.membres[g.moi];
    if (g.pt === m.t) return;                       // déjà envoyé
    g.pt = m.t; sauverStore();
    fetch(API + "/g/" + encodeURIComponent(g.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(objetDe(g)) })
      .then(function (r) { if (!r.ok) g.pt = 0; }, function () { g.pt = 0; });
  }
  function tirer(g) {
    if (!API || !g.sync) return Promise.resolve(false);
    return fetch(API + "/g/" + encodeURIComponent(g.id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) {
        var lien = valider(o);
        if (!lien || lien.id !== g.id || lien.s !== sem.id || lien.h !== sem.hash) return false;
        var change = false;
        lien.membres.forEach(function (m) {
          var k = cle(m.nom);
          if (g.moi === k) return;
          var ex = g.membres[k];
          if (!ex && Object.keys(g.membres).length >= MAX_MEMBRES) return;
          if (!ex || m.t > ex.t) { g.membres[k] = { nom: m.nom, c: m.c.length === N ? m.c : vides(), t: m.t }; change = true; }
        });
        if (change) sauverStore();
        return change;
      })
      .catch(function () { return false; });
  }
  function rejoindreServeur(id) {
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (!/^[a-z0-9]{4,12}$/.test(id)) { message("Ce lien de groupe n'est pas lisible. Demande à ton ami de le renvoyer en entier."); return; }
    if (!API) { message("Ce lien demande la mise à jour en direct, qui n'est pas activée sur ce site pour l'instant."); return; }
    if (!profil) { enAttenteId = id; return; }
    message("Connexion au groupe…");
    fetch(API + "/g/" + encodeURIComponent(id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) {
        var lien = valider(o);
        if (!lien) { message("Ce groupe est introuvable ou a expiré (les groupes en direct sont gardés 14 jours). Demande à ton ami d'en créer un nouveau."); return; }
        var r = fusionner(lien);
        if (r.erreur) { message(r.erreur); rendre(); return; }
        r.g.sync = true; sauverStore();
        message("Tu as rejoint « " + r.g.nom + " »." + (r.renomme ? " Ce prénom était déjà pris : tu apparais comme « " + r.renomme + " »." : ""));
        rendre();
      })
      .catch(function () { message("Impossible de joindre le service du groupe pour le moment. Réessaie dans un instant."); });
  }

  /* ---------- Groupes ---------- */
  function groupeActif() { return store.groupes[store.actif] || null; }

  /* Met à jour mon entrée avec mon dernier tri, et passe à la semaine en cours si le groupe date d'avant. */
  function synchroniser(g) {
    if (g.sem < sem.id) {
      g.sem = sem.id; g.h = sem.hash;
      Object.keys(g.membres).forEach(function (k) { g.membres[k].c = vides(); });
    }
    if (g.sem === sem.id && g.moi && g.membres[g.moi]) {
      var c = mesCodes(), m = g.membres[g.moi];
      if (m.c !== c) { m.c = c; m.t = Date.now(); }
    }
  }
  function synchroniserTous() {
    Object.keys(store.groupes).forEach(function (id) { synchroniser(store.groupes[id]); });
    sauverStore();
    Object.keys(store.groupes).forEach(function (id) { pousser(store.groupes[id]); });
  }

  function creerGroupe(nom) {
    var g = { id: idAleatoire(), nom: nom, sem: sem.id, h: sem.hash, membres: {}, moi: cle(profil.nom) };
    g.membres[g.moi] = { nom: profil.nom, c: mesCodes(), t: Date.now() };
    g.sync = !!(API && el.sync && el.sync.checked);
    store.groupes[g.id] = g;
    store.actif = g.id;
    sauverStore();
    track("group_create", { semaine: sem.id });
    return g;
  }

  /* Fusionne un lien reçu. Retourne { g, nouveau, renomme } ou { erreur }. */
  function fusionner(lien) {
    if (lien.s > sem.id) return { erreur: "Ce lien vient d'une semaine plus récente que celle affichée dans ton navigateur. Recharge la page puis ouvre le lien de nouveau." };
    if (lien.s < sem.id) return { erreur: "Ce lien date d'une semaine passée. Demande à ton ami de renvoyer son lien de cette semaine." };
    if (lien.h !== sem.hash) return { erreur: "Ce lien vient d'une version différente de la sélection de la semaine (le site a été mis à jour entre-temps). Recharge la page ou demande à ton ami de renvoyer son lien." };
    var g = store.groupes[lien.id], nouveau = false, renomme = "";
    if (!g) {
      nouveau = true;
      g = { id: lien.id, nom: lien.nom, sem: sem.id, h: sem.hash, membres: {}, moi: null };
      store.groupes[g.id] = g;
    } else synchroniser(g);
    lien.membres.forEach(function (m) {
      var k = cle(m.nom);
      if (g.moi === k) return;                      // mon tri local fait foi
      var ex = g.membres[k];
      if (!ex || m.t > ex.t) g.membres[k] = { nom: m.nom, c: m.c.length === N ? m.c : vides(), t: m.t };
    });
    if (!g.moi) {
      var k = cle(profil.nom), nom = profil.nom, n = 2;
      while (g.membres[k]) { nom = profil.nom + " " + n; k = cle(nom); n++; }
      if (nom !== profil.nom) renomme = nom;
      if (Object.keys(g.membres).length >= MAX_MEMBRES) { delete store.groupes[g.id]; return { erreur: "Ce groupe est complet (" + MAX_MEMBRES + " personnes au maximum)." }; }
      g.moi = k;
      g.membres[k] = { nom: nom, c: mesCodes(), t: Date.now() };
    }
    store.actif = g.id;
    sauverStore();
    track("group_join", { semaine: sem.id, membres: Object.keys(g.membres).length });
    return { g: g, nouveau: nouveau, renomme: renomme };
  }

  function traiterLien(lien) {
    var r = fusionner(lien);
    if (r.erreur) { message(r.erreur); return false; }
    message(r.nouveau
      ? "Tu as rejoint « " + r.g.nom + " »." + (r.renomme ? " Ce prénom était déjà pris : tu apparais comme « " + r.renomme + " »." : "")
      : "Les choix de ce lien ont été ajoutés à « " + r.g.nom + " ».");
    return true;
  }

  function quitter(g) {
    delete store.groupes[g.id];
    var restants = Object.keys(store.groupes);
    store.actif = restants.length ? restants[0] : "";
    sauverStore();
    confirmerQuitter = false;
    message("Tu as quitté « " + g.nom + " » : il a été retiré de ce navigateur.");
  }

  function renommerProfil(nouveau) {
    var ancien = profil.nom;
    profil.nom = nouveau;
    sauverProfil();
    Object.keys(store.groupes).forEach(function (id) {
      var g = store.groupes[id];
      if (!g.moi || !g.membres[g.moi]) return;
      var m = g.membres[g.moi], k = cle(nouveau), nom = nouveau, n = 2;
      delete g.membres[g.moi];
      while (g.membres[k]) { nom = nouveau + " " + n; k = cle(nom); n++; }
      m.nom = nom; m.t = Date.now();
      g.membres[k] = m; g.moi = k;
    });
    sauverStore();
    return ancien;
  }

  /* ---------- Calculs pour la vue ---------- */
  function listeMembres(g) {
    return Object.keys(g.membres).map(function (k) { var m = g.membres[k]; return { cle: k, nom: m.nom, c: m.c, moi: k === g.moi }; })
      .sort(function (a, b) { return a.moi ? -1 : b.moi ? 1 : a.nom.localeCompare(b.nom, "fr"); });
  }
  function aCommence(m) { return m.c.replace(/-/g, "").length > 0; }
  function aFini(m) { return m.c.indexOf("-") < 0; }

  function parFilm(membres) {
    return films.map(function (f, i) {
      var k = [], s = [], p = [];
      membres.forEach(function (m) {
        var c = m.c.charAt(i);
        if (c === "k") k.push(m); else if (c === "s") s.push(m); else p.push(m);
      });
      return { film: f, i: i, gardent: k, passent: s, attente: p };
    });
  }

  /* Films retenus par le groupe : gardés par au moitié au moins de ceux qui ont trié le film (et par 1 au minimum). */
  function retenus(lignes) {
    return lignes.filter(function (l) {
      var avis = l.gardent.length + l.passent.length;
      return l.gardent.length >= 1 && l.gardent.length >= Math.ceil(avis / 2);
    });
  }

  function accords(membres) {
    var meilleur = null;
    for (var a = 0; a < membres.length; a++) for (var b = a + 1; b < membres.length; b++) {
      var commun = 0, ok = 0;
      for (var i = 0; i < N; i++) {
        var x = membres[a].c.charAt(i), y = membres[b].c.charAt(i);
        if (x !== "-" && y !== "-") { commun++; if (x === y) ok++; }
      }
      if (commun >= 3 && (!meilleur || ok / commun > meilleur.ok / meilleur.commun || (ok / commun === meilleur.ok / meilleur.commun && commun > meilleur.commun))) {
        meilleur = { a: membres[a].nom, b: membres[b].nom, ok: ok, commun: commun };
      }
    }
    return meilleur;
  }

  function tauxCategories(membres) {
    var t = { nouveau: [0, 0], independant: [0, 0], reprise: [0, 0] };
    films.forEach(function (f, i) {
      membres.forEach(function (m) {
        var c = m.c.charAt(i);
        if (c === "-") return;
        t[f.categorie][1]++;
        if (c === "k") t[f.categorie][0]++;
      });
    });
    return t;
  }

  /* ---------- Affichage ---------- */
  function pilule(m, etat) {
    var cl = "g-pilule g-pilule--" + (etat === "k" ? "garde" : etat === "s" ? "passe" : "attente");
    var p = creer("li", cl);
    p.appendChild(creer("span", "g-pilule__nom", m.nom + (m.moi ? " (toi)" : "")));
    p.appendChild(creer("span", "g-pilule__etat", etat === "k" ? "garde" : etat === "s" ? "passe" : "pas encore"));
    return p;
  }

  function titreSection(texte) { return creer("h3", "g-titre", texte); }

  function rendreVue(g) {
    var v = el.vue;
    v.textContent = "";
    var membres = listeMembres(g);
    var lignes = parFilm(membres);
    var nbFini = membres.filter(aFini).length;
    var nbCommence = membres.filter(aCommence).length;
    var moi = membres.filter(function (m) { return m.moi; })[0];

    /* En-tête */
    var tete = creer("div", "g-tete");
    tete.appendChild(creer("h2", "g-nom", g.nom));
    tete.appendChild(creer("p", "caption", sem.label + " · " + pluriel(membres.length, "personne", "personnes") +
      " · " + pluriel(nbFini, "tri terminé", "tris terminés")));
    v.appendChild(tete);
    if (g.demo) v.appendChild(creer("p", "stat-film stat-film--demo", "Démo : les trois amis de ce groupe sont fictifs, pour montrer les statistiques d'un groupe actif."));

    if (moi && !aCommence(moi)) {
      var inv = creer("p", "g-invite");
      inv.appendChild(document.createTextNode("Tu n'as pas encore trié la semaine. "));
      var a = creer("a", "btn btn--primary btn--small", "Trier dans le swipe");
      a.href = app.getAttribute("data-swipe") || "../swipe/";
      inv.appendChild(a);
      v.appendChild(inv);
    }

    /* Partage */
    var part = creer("div", "g-partage");
    part.appendChild(titreSection("Inviter des amis"));
    part.appendChild(creer("p", "caption", g.sync && API
      ? "Envoie ce lien. Quand un ami l'ouvre, il rejoint le groupe : vous voyez les choix de chacun, mis à jour environ toutes les quinze secondes tant que cette page est ouverte. Le groupe est gardé 14 jours sur notre serveur."
      : "Envoie ton lien. Quand un ami l'ouvre, il rejoint le groupe et tes choix s'ajoutent chez lui. Pour voir ses choix, il doit t'envoyer son lien aussi : ouvre-le et tout s'ajoute chez toi."));
    var texte = "Rejoins mon groupe « " + g.nom + " » sur CinéSwipe et dis quels films tu veux voir cette semaine : " + lienDe(g);
    var actions = creer("p", "partage__actions");
    var btnShare = creer("button", "btn btn--primary btn--small", "Partager");
    btnShare.type = "button"; btnShare.hidden = !navigator.share;
    btnShare.addEventListener("click", function () {
      navigator.share({ text: texte }).then(function () { track("group_share", { methode: "share", membres: membres.length }); }, function () {});
    });
    var wa = creer("a", "btn btn--secondary btn--small");
    wa.href = "https://wa.me/?text=" + encodeURIComponent(texte);
    wa.target = "_blank"; wa.rel = "noopener noreferrer";
    wa.appendChild(document.createTextNode("WhatsApp"));
    wa.appendChild(creer("span", "sr-only", " (s'ouvre dans un nouvel onglet)"));
    wa.addEventListener("click", function () { track("group_share", { methode: "whatsapp", membres: membres.length }); });
    var cp = creer("button", "btn btn--ghost btn--small", "Copier le lien");
    cp.type = "button";
    var live = creer("span", "sr-only"); live.setAttribute("aria-live", "polite");
    cp.addEventListener("click", function () {
      function ok() { cp.textContent = "Copié !"; live.textContent = "Lien copié."; window.setTimeout(function () { cp.textContent = "Copier le lien"; }, 2000); track("group_share", { methode: "copie", membres: membres.length }); }
      function manuel() { zone.focus(); zone.select(); live.textContent = "Message sélectionné : copie-le avec ton clavier ou ton menu."; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(ok, manuel);
      else manuel();
    });
    actions.appendChild(btnShare); actions.appendChild(wa); actions.appendChild(cp); actions.appendChild(live);
    part.appendChild(actions);
    var zoneLab = creer("label", "sr-only", "Message avec ton lien de groupe");
    var zone = creer("textarea", "lieu__champ g-zone g-zone--lien");
    zone.readOnly = true; zone.rows = 3; zone.value = texte; zone.id = "g-lien-texte";
    zoneLab.htmlFor = "g-lien-texte";
    zone.addEventListener("focus", function () { zone.select(); });
    part.appendChild(zoneLab); part.appendChild(zone);
    v.appendChild(part);

    /* Par film : qui garde quoi */
    var tri = lignes.slice().sort(function (a, b) { return b.gardent.length - a.gardent.length || a.i - b.i; });
    var sFilms = creer("section", "g-section");
    sFilms.appendChild(titreSection("Qui veut voir quoi"));
    if (nbCommence === 0) sFilms.appendChild(creer("p", "caption", "Personne n'a encore trié la semaine."));
    var ol = creer("ol", "g-films");
    tri.forEach(function (l) {
      var li = creer("li", "g-film");
      var tt = creer("div", "g-film__tete");
      var lien = creer("a", "g-film__titre", l.film.titre);
      lien.href = l.film.url;
      tt.appendChild(lien);
      if (l.film.categorie !== "nouveau") tt.appendChild(creer("span", "chip " + (l.film.categorie === "reprise" ? "chip--reprise" : "chip--indep"),
        l.film.categorie === "reprise" ? "Reprise" + (l.film.annee ? " " + l.film.annee : "") : "Indépendant"));
      tt.appendChild(creer("span", "g-film__score price", l.gardent.length + "/" + membres.length));
      tt.lastChild.appendChild(creer("span", "sr-only", " personnes gardent ce film"));
      li.appendChild(tt);
      var ul = creer("ul", "g-pilules");
      membres.forEach(function (m) { ul.appendChild(pilule(m, m.c.charAt(l.i))); });
      li.appendChild(ul);
      ol.appendChild(li);
    });
    sFilms.appendChild(ol);
    v.appendChild(sFilms);

    /* Chiffres du groupe */
    var sStats = creer("section", "g-section");
    sStats.appendChild(titreSection("Les chiffres du groupe"));
    var dl = creer("ul", "g-stats");
    function stat(titre, texte) {
      var li = creer("li", "g-stat");
      li.appendChild(creer("p", "g-stat__titre", titre));
      li.appendChild(creer("p", "g-stat__texte", texte));
      dl.appendChild(li);
    }
    stat("Participation", nbCommence === 0 ? "Personne n'a encore commencé." : nbFini + " sur " + membres.length + (nbFini > 1 ? " ont fini leur tri" : " a fini son tri") + (nbCommence - nbFini > 0 ? ", " + (nbCommence - nbFini) + " en cours" : "") + ".");
    var maxK = tri.length ? tri[0].gardent.length : 0;
    if (maxK > 0) {
      var tete1 = tri.filter(function (l) { return l.gardent.length === maxK; }).map(function (l) { return l.film.titre; });
      stat("Film en tête", tete1.join(", ") + " : gardé par " + maxK + " sur " + membres.length + ".");
    }
    var unanimes = lignes.filter(function (l) { return l.gardent.length >= 2 && l.passent.length === 0 && l.attente.length === 0; });
    if (unanimes.length) stat("Unanimité", unanimes.map(function (l) { return l.film.titre; }).join(", ") + " : tout le groupe est d'accord.");
    var aucun = lignes.filter(function (l) { return l.gardent.length === 0 && l.passent.length > 0 && l.attente.length === 0; });
    if (aucun.length) stat("Personne n'en veut", aucun.map(function (l) { return l.film.titre; }).join(", ") + ".");
    var ac = accords(membres);
    if (ac) stat("Goûts les plus proches", ac.a + " et " + ac.b + " : d'accord sur " + ac.ok + " film" + (ac.ok > 1 ? "s" : "") + " sur " + ac.commun + ".");
    var ret = retenus(lignes);
    if (ret.length) {
      var somme = ret.reduce(function (s, l) { return s + l.film.montant; }, 0);
      stat("Budget", "Aller voir les " + pluriel(ret.length, "film retenu", "films retenus") + " coûterait environ " + prixFr(somme) + " par personne, aux tarifs constatés sur chaque fiche (le prix peut varier d'un cinéma à l'autre).");
    }
    dl.hidden = dl.children.length === 0;
    sStats.appendChild(dl);

    var taux = tauxCategories(membres);
    var noms = { nouveau: "À l'affiche", independant: "Indépendants", reprise: "Reprises" };
    var cats = Object.keys(taux).filter(function (c) { return taux[c][1] > 0 && films.some(function (f) { return f.categorie === c; }); });
    if (cats.length > 1) {
      sStats.appendChild(creer("p", "g-stat__titre", "Ce que le groupe garde, par type de film"));
      var barres = creer("ul", "g-barres");
      cats.forEach(function (c) {
        var pct = Math.round(taux[c][0] / taux[c][1] * 100);
        var li = creer("li", "g-barre");
        li.appendChild(creer("span", "g-barre__nom", noms[c]));
        var piste = creer("span", "g-barre__piste");
        piste.setAttribute("aria-hidden", "true");
        var rempli = creer("span", "g-barre__rempli");
        rempli.style.width = pct + "%";
        piste.appendChild(rempli);
        li.appendChild(piste);
        li.appendChild(creer("span", "g-barre__val price", pct + " %"));
        barres.appendChild(li);
      });
      sStats.appendChild(barres);
    }
    v.appendChild(sStats);

    /* Par ami */
    var det = creer("details", "g-details");
    det.appendChild(creer("summary", "", "Les choix de chacun"));
    var ulA = creer("ul", "g-amis");
    membres.forEach(function (m) {
      var li = creer("li", "g-ami");
      li.appendChild(creer("p", "g-ami__nom", m.nom + (m.moi ? " (toi)" : "")));
      var gardes = films.filter(function (f, i) { return m.c.charAt(i) === "k"; }).map(function (f) { return f.titre; });
      var txt = !aCommence(m) ? "N'a pas encore trié la semaine."
        : gardes.length ? "Veut voir : " + gardes.join(", ") + (aFini(m) ? "." : ". Tri pas terminé.")
        : "N'a rien gardé" + (aFini(m) ? "." : " pour l'instant.");
      li.appendChild(creer("p", "caption", txt));
      ulA.appendChild(li);
    });
    det.appendChild(ulA);
    v.appendChild(det);

    /* Où aller ensemble */
    var sOu = creer("section", "g-section");
    sOu.appendChild(titreSection("Où les voir ensemble"));
    if (ret.length && cinemas.length && window.csLieu) {
      sOu.appendChild(creer("p", "caption", "Cinémas qui passent les films retenus par le groupe : " + ret.map(function (l) { return l.film.titre; }).join(", ") + "."));
      var zoneOu = creer("div");
      sOu.appendChild(zoneOu);
      window.csLieu.liste(zoneOu, ret.map(function (l) { return l.film; }), cinemas, { semaine: sem.id });
    } else {
      sOu.appendChild(creer("p", "caption", "Dès qu'un film est gardé par au moins la moitié de ceux qui l'ont trié, les cinémas qui le passent s'affichent ici."));
    }
    v.appendChild(sOu);

    /* Quitter */
    var q = creer("p", "g-quitter");
    var bq = creer("button", "btn btn--ghost btn--small", confirmerQuitter ? "Oui, quitter « " + g.nom + " »" : "Quitter le groupe");
    bq.type = "button";
    bq.addEventListener("click", function () {
      if (!confirmerQuitter) { confirmerQuitter = true; rendreVue(g); v.querySelector(".g-quitter .btn").focus(); return; }
      quitter(g); rendre();
    });
    q.appendChild(bq);
    if (confirmerQuitter) {
      var non = creer("button", "btn btn--ghost btn--small", "Annuler");
      non.type = "button";
      non.addEventListener("click", function () { confirmerQuitter = false; rendreVue(g); });
      q.appendChild(non);
    }
    q.appendChild(creer("span", "caption", " Le groupe est seulement retiré de ce navigateur ; tes amis le gardent."));
    v.appendChild(q);
  }

  function rendreOnglets() {
    var ids = Object.keys(store.groupes);
    el.nav.hidden = ids.length < 2;
    el.onglets.textContent = "";
    ids.forEach(function (id) {
      var li = creer("li");
      var b = creer("button", "toggle", store.groupes[id].nom);
      b.type = "button";
      b.setAttribute("aria-pressed", id === store.actif ? "true" : "false");
      b.addEventListener("click", function () { store.actif = id; confirmerQuitter = false; sauverStore(); rendre(); });
      li.appendChild(b); el.onglets.appendChild(li);
    });
  }

  function rendre() {
    var besoinProfil = !profil || editionProfil;
    el.profil.hidden = !besoinProfil;
    el.principal.hidden = !profil;
    if (besoinProfil) {
      el.profilNote.textContent = enAttente
        ? "Tu as reçu un lien vers le groupe « " + enAttente.nom + " ». Choisis ton prénom ou ton pseudo pour le rejoindre : il apparaîtra dans les liens que tu envoies."
        : enAttenteId ? "Tu as reçu un lien vers un groupe en direct. Choisis ton prénom ou ton pseudo pour le rejoindre : les autres membres le verront."
        : "Un prénom ou un pseudo suffit, pas ton nom complet : il apparaît dans les liens que tu envoies.";
      el.profilNom.value = profil ? profil.nom : "";
    }
    if (!profil) { el.vue.hidden = true; return; }
    el.salut.textContent = "Tu es « " + profil.nom + " » dans tes groupes.";
    synchroniserTous();
    rendreOnglets();
    var g = groupeActif();
    el.vue.hidden = !g;
    if (g) rendreVue(g);
    else el.vue.textContent = "";
    if (memoireSeule) message("Ton navigateur ne garde pas les données du site : ton groupe sera perdu quand tu fermeras cette page.");
  }

  /* ---------- Formulaires ---------- */
  el.profilForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var nom = nettoyer(el.profilNom.value, 20);
    if (!nom) { message("Écris un prénom ou un pseudo."); return; }
    if (profil && editionProfil) {
      if (nom !== profil.nom) renommerProfil(nom);
      editionProfil = false;
      message("Prénom mis à jour. Renvoie ton lien pour que tes amis voient le nouveau.");
    } else {
      profil = { nom: nom }; sauverProfil();
      message("");
      if (enAttente) { var l = enAttente; enAttente = null; traiterLien(l); }
      else if (enAttenteId) { var idg = enAttenteId; enAttenteId = null; rejoindreServeur(idg); }
    }
    rendre();
  });
  el.profilEdit.addEventListener("click", function () { editionProfil = true; message(""); rendre(); el.profilNom.focus(); });

  el.creerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var nom = nettoyer(el.creerNom.value, 30);
    if (!nom) { message("Donne un nom au groupe."); return; }
    var g = creerGroupe(nom);
    el.creerNom.value = "";
    message("Groupe « " + g.nom + " » créé. Envoie ton lien à tes amis.");
    confirmerQuitter = false;
    rendre();
    el.vue.scrollIntoView({ block: "start" });
  });

  el.rejoindreForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var lien = extraire(el.rejoindreCode.value);
    if (!lien) { message("Ce lien ou ce code n'est pas lisible. Copie-le en entier, depuis le message de ton ami."); return; }
    if (traiterLien(lien)) el.rejoindreCode.value = "";
    rendre();
    el.vue.scrollIntoView({ block: "start" });
  });

  /* Groupe de démonstration (mode démo) : amis fictifs, étiquetés comme tels, jamais envoyés. */
  if (el.demo) el.demo.addEventListener("click", function () {
    if (!profil) { message("Choisis d'abord ton prénom ci-dessus."); return; }
    function codes(f) { var c = ""; for (var i = 0; i < N; i++) c += f(i) ? "k" : "s"; return c; }
    var g = { id: "demo01", nom: "Démo : la coloc (fictif)", sem: sem.id, h: sem.hash, membres: {}, moi: cle(profil.nom), demo: true };
    g.membres[g.moi] = { nom: profil.nom, c: mesCodes(), t: Date.now() };
    g.membres["léa"] = { nom: "Léa (fictive)", c: codes(function (i) { return i % 2 === 0; }), t: Date.now() };
    g.membres["hugo"] = { nom: "Hugo (fictif)", c: codes(function (i) { return i % 3 !== 0; }), t: Date.now() };
    g.membres["sam"] = { nom: "Sam (fictif)", c: codes(function (i) { return i % 4 < 2; }), t: Date.now() };
    store.groupes[g.id] = g; store.actif = g.id; sauverStore();
    message("Groupe de démonstration ajouté. Les trois amis sont fictifs, ton tri est le tien.");
    confirmerQuitter = false;
    rendre();
    el.vue.scrollIntoView({ block: "start" });
  });

  /* Reprise des données quand on revient sur l'onglet après un tri dans le swipe */
  document.addEventListener("visibilitychange", function () { if (!document.hidden && profil && !editionProfil) { var s = document.activeElement; if (!s || s === document.body) rendre(); } });
  window.addEventListener("pageshow", function (e) { if (e.persisted && profil) rendre(); });

  /* ---------- Démarrage : lien reçu dans l'adresse ? ---------- */
  function lireHash() {
    var h = location.hash || "";
    if (h.indexOf("#j=") === 0) { rejoindreServeur(h.slice(3).replace(/[^a-z0-9]/g, "")); return true; }
    if (h.indexOf("#g=") !== 0) return false;
    var lienRecu = extraire(h);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (!lienRecu) message("Ce lien de groupe n'est pas lisible. Demande à ton ami de le renvoyer en entier.");
    else if (!profil) enAttente = lienRecu;
    else traiterLien(lienRecu);
    return true;
  }
  /* Lien ouvert alors que la page est déjà ouverte : seul le "#" change, la page n'est pas rechargée. */
  window.addEventListener("hashchange", function () { if (lireHash()) { confirmerQuitter = false; editionProfil = false; rendre(); } });
  lireHash();
  rendre();

  /* Groupe en direct : on récupère les choix des amis au chargement puis toutes les 15 secondes, page visible. */
  if (API) {
    var g0 = groupeActif();
    if (g0 && g0.sync) tirer(g0).then(function (c) { if (c) rendre(); });
    window.setInterval(function () {
      if (document.hidden || !profil || editionProfil) return;
      var g = groupeActif();
      if (!g || !g.sync) return;
      synchroniser(g); sauverStore(); pousser(g);
      tirer(g).then(function (change) {
        if (!change) return;
        var a = document.activeElement;
        if (!a || a === document.body) rendre();
      });
    }, 15000);
  }
})();
