/* Localisation : position choisie par la personne, distances à vol d'oiseau, cinémas qui passent les films.
   Rien n'est envoyé à CinéSwipe ni à Google Analytics. La position (arrondie) reste dans sessionStorage,
   donc elle disparaît quand l'onglet se ferme. Seule une adresse tapée est envoyée à la Base Adresse Nationale
   (api-adresse.data.gouv.fr, service de l'État), et seulement quand la personne lance la recherche. */
(function () {
  var CLE = "cs_pos";
  var BAN = "https://api-adresse.data.gouv.fr/search/";
  var ecouteurs = [];
  var compteur = 0;
  var etat = lire();

  /* Un écouteur par conteneur : quand on redessine un conteneur, l'ancien écouteur est retiré. */
  function enregistrer(f, pour) {
    f.pour = pour;
    ecouteurs = ecouteurs.filter(function (x) { return !pour || x.pour !== pour; });
    ecouteurs.push(f);
  }

  /* ---------- Position ---------- */
  function lire() {
    try {
      var b = JSON.parse(sessionStorage.getItem(CLE));
      if (b && isFinite(b.lat) && isFinite(b.lng)) return b;
    } catch (e) {}
    return null;
  }
  function ecrire(p, suivi) {
    etat = p;
    try { if (p) sessionStorage.setItem(CLE, JSON.stringify(p)); else sessionStorage.removeItem(CLE); } catch (e) {}
    if (p && suivi && typeof window.csTrack === "function") window.csTrack("location_used", { methode: p.m });
    ecouteurs.slice().forEach(function (f) { f(etat); });
  }
  function arrondi(n, dec) { var k = Math.pow(10, dec); return Math.round(n * k) / k; }

  function distance(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function kmFr(d) {
    if (d < 1) { var m = Math.max(50, Math.round(d * 20) * 50); return m >= 1000 ? "1 km" : m + " m"; }
    if (d < 10) return (Math.round(d * 10) / 10).toString().replace(".", ",") + " km";
    return Math.round(d) + " km";
  }

  function localiser() {
    return new Promise(function (ok, ko) {
      if (!navigator.geolocation) { ko(new Error("indisponible")); return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        ok({ lat: arrondi(pos.coords.latitude, 2), lng: arrondi(pos.coords.longitude, 2), label: "ta position (arrondie à 1 km près)", m: "gps" });
      }, function (err) { ko(err); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    });
  }

  /* Recherche d'adresse ou de ville (Base Adresse Nationale). Rejette si le service ne répond pas. */
  function chercher(q) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var minuterie = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    return fetch(BAN + "?limit=5&autocomplete=0&q=" + encodeURIComponent(q), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (j) {
        window.clearTimeout(minuterie);
        return (j.features || []).map(function (f) {
          var type = f.properties && f.properties.type;
          return {
            label: f.properties.label + (f.properties.postcode && type === "municipality" ? " (" + f.properties.postcode + ")" : ""),
            lat: arrondi(f.geometry.coordinates[1], type === "municipality" ? 2 : 3),
            lng: arrondi(f.geometry.coordinates[0], type === "municipality" ? 2 : 3),
            m: "adresse"
          };
        });
      }, function (e) { window.clearTimeout(minuterie); throw e; });
  }

  /* Villes des cinémas : liste de secours quand la géolocalisation et la recherche ne marchent pas. */
  function villes(cinemas) {
    var par = {};
    cinemas.forEach(function (c) {
      if (c.lat == null || c.lng == null) return;
      var v = par[c.ville] || (par[c.ville] = { n: 0, lat: 0, lng: 0 });
      v.n++; v.lat += c.lat; v.lng += c.lng;
    });
    return Object.keys(par).sort(function (a, b) { return a.localeCompare(b, "fr"); }).map(function (nom) {
      var v = par[nom];
      return { label: nom, lat: arrondi(v.lat / v.n, 3), lng: arrondi(v.lng / v.n, 3), m: "ville" };
    });
  }

  /* Pour des films et des cinémas : quels cinémas passent quoi, du plus proche au plus éloigné.
     films : objets du JSON de swipe (avec "seances"). Retourne [{cinema, items:[{film, u, uf, m, t}], d}]. */
  function classer(cinemas, films) {
    var parId = {};
    cinemas.forEach(function (c) { parId[c.id] = { cinema: c, items: [], d: null }; });
    films.forEach(function (f) {
      (f.seances || []).forEach(function (s) {
        if (parId[s.c]) parId[s.c].items.push({ film: f, u: s.u, uf: s.uf, m: s.m, t: s.t });
      });
    });
    var liste = Object.keys(parId).map(function (k) { return parId[k]; }).filter(function (x) { return x.items.length; });
    if (etat) liste.forEach(function (x) { if (x.cinema.lat != null) x.d = distance(etat, x.cinema); });
    liste.sort(function (a, b) {
      if (etat && a.d != null && b.d != null && a.d !== b.d) return a.d - b.d;
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.cinema.nom.localeCompare(b.cinema.nom, "fr");
    });
    return liste;
  }

  /* ---------- Outils DOM ---------- */
  function creer(tag, classe, texte) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texte != null) el.textContent = texte;
    return el;
  }
  function sr(texte) { return creer("span", "sr-only", texte); }

  /* ---------- Sélecteur de lieu ---------- */
  function monter(conteneur, listeVilles) {
    conteneur.textContent = "";
    var n = ++compteur;
    var racine = creer("div", "lieu");
    var etatP = creer("p", "lieu__etat");
    etatP.setAttribute("aria-live", "polite");
    var outils = creer("div", "lieu__outils");
    var msg = creer("p", "lieu__msg caption");
    msg.setAttribute("role", "status");

    var btnGps = creer("button", "btn btn--secondary btn--small", "Me localiser");
    btnGps.type = "button";

    var form = creer("form", "lieu__form");
    form.setAttribute("role", "search");
    var lab = creer("label", "lieu__label", "Adresse ou ville");
    lab.htmlFor = "lieu-q-" + n;
    var champ = creer("input", "lieu__champ");
    champ.type = "search"; champ.id = "lieu-q-" + n; champ.autocomplete = "off"; champ.maxLength = 120;
    champ.placeholder = "ex. place de Jaude, Clermont-Ferrand";
    var btnQ = creer("button", "btn btn--secondary btn--small", "Chercher");
    btnQ.type = "submit";
    form.appendChild(lab); form.appendChild(champ); form.appendChild(btnQ);

    var resultats = creer("ul", "lieu__resultats");
    resultats.hidden = true;

    var bloc = creer("p", "lieu__villes");
    var labV = creer("label", "lieu__label", "Ou choisis une ville");
    labV.htmlFor = "lieu-v-" + n;
    var sel = creer("select", "lieu__select");
    sel.id = "lieu-v-" + n;
    var o0 = creer("option", "", "Choisir une ville");
    o0.value = "";
    sel.appendChild(o0);
    listeVilles.forEach(function (v, i) { var o = creer("option", "", v.label); o.value = String(i); sel.appendChild(o); });
    bloc.appendChild(labV); bloc.appendChild(sel);

    var btnChanger = creer("button", "btn btn--ghost btn--small", "Changer");
    btnChanger.type = "button";
    var btnEffacer = creer("button", "btn btn--ghost btn--small", "Effacer");
    btnEffacer.type = "button";

    outils.appendChild(btnGps);
    outils.appendChild(form);
    outils.appendChild(resultats);
    outils.appendChild(bloc);

    racine.appendChild(etatP);
    var actionsEtat = creer("p", "lieu__actions");
    actionsEtat.appendChild(btnChanger); actionsEtat.appendChild(btnEffacer);
    racine.appendChild(actionsEtat);
    racine.appendChild(outils);
    racine.appendChild(msg);
    conteneur.appendChild(racine);

    var edition = false;
    function rafraichir() {
      var p = etat;
      if (p && !edition) {
        etatP.textContent = "Distances calculées depuis : " + p.label + ". Elles sont à vol d'oiseau.";
        outils.hidden = true; actionsEtat.hidden = false;
      } else {
        etatP.textContent = p ? "Choisis un autre lieu." : "Pour classer les cinémas du plus proche au plus éloigné, dis-nous d'où tu pars. Ta position reste dans ton navigateur.";
        outils.hidden = false; actionsEtat.hidden = true;
      }
    }
    function choisir(p) { edition = false; msg.textContent = ""; resultats.hidden = true; resultats.textContent = ""; ecrire(p, true); }

    btnGps.addEventListener("click", function () {
      msg.textContent = "Recherche de ta position…";
      localiser().then(choisir, function (err) {
        msg.textContent = err && err.code === 1
          ? "Ta position n'a pas été partagée. Tape une adresse ou choisis une ville."
          : "Ta position est introuvable pour l'instant. Tape une adresse ou choisis une ville.";
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = champ.value.trim();
      if (q.length < 3) { msg.textContent = "Tape au moins 3 caractères."; return; }
      msg.textContent = "Recherche…";
      resultats.hidden = true; resultats.textContent = "";
      chercher(q).then(function (liste) {
        if (!liste.length) { msg.textContent = "Aucun résultat. Essaie avec le nom de la ville, ou choisis-la dans la liste."; return; }
        msg.textContent = liste.length + " résultat" + (liste.length > 1 ? "s" : "") + ", choisis le bon.";
        liste.forEach(function (p) {
          var li = creer("li");
          var b = creer("button", "lieu__choix", p.label);
          b.type = "button";
          b.addEventListener("click", function () { choisir(p); });
          li.appendChild(b); resultats.appendChild(li);
        });
        resultats.hidden = false;
      }, function () {
        msg.textContent = "La recherche d'adresse ne répond pas pour l'instant. Choisis plutôt une ville dans la liste.";
      });
    });
    sel.addEventListener("change", function () {
      if (sel.value !== "") choisir(listeVilles[Number(sel.value)]);
    });
    btnChanger.addEventListener("click", function () { edition = true; rafraichir(); btnGps.focus(); });
    btnEffacer.addEventListener("click", function () { edition = false; msg.textContent = ""; ecrire(null); });
    enregistrer(function () { edition = false; rafraichir(); }, conteneur);
    rafraichir();
  }

  /* ---------- Liste de cinémas pour plusieurs films (swipe, groupe) ---------- */
  function ligneCinema(x, nbFilms, semaine) {
    var c = x.cinema;
    var li = creer("li", "seance");
    var tete = creer("div", "seance__tete");
    var h = creer("h4", "seance__nom", c.nom);
    var puce = creer("span", "chip", c.type === "independant" ? "Indépendant" : (c.circuit || "Circuit"));
    tete.appendChild(h); tete.appendChild(puce);
    if (x.d != null) {
      var d = creer("p", "seance__dist price", kmFr(x.d));
      d.appendChild(sr(" à vol d'oiseau"));
      tete.appendChild(d);
    }
    li.appendChild(tete);
    var adr = creer("p", "caption seance__adresse");
    if (c.osm) {
      var a = creer("a", "", c.adresse);
      a.href = c.osm; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.appendChild(sr(" sur la carte OpenStreetMap (s'ouvre dans un nouvel onglet)"));
      adr.appendChild(a);
    } else adr.textContent = c.adresse;
    li.appendChild(adr);
    li.appendChild(creer("p", "seance__couverture", nbFilms > 1
      ? "Passe " + x.items.length + " de tes " + nbFilms + " films :"
      : "Passe ce film :"));
    var ul = creer("ul", "seance__liens");
    x.items.forEach(function (it) {
      var l = creer("li");
      var lien = creer("a", "btn btn--secondary btn--small", it.film.titre);
      lien.href = it.u; lien.target = "_blank"; lien.rel = "noopener noreferrer";
      lien.setAttribute("data-track", "screening_click");
      lien.setAttribute("data-film", it.film.slug);
      lien.setAttribute("data-cinema", c.nom);
      lien.setAttribute("data-semaine", semaine || "");
      lien.appendChild(sr(it.uf ? " : séances sur le site de " + c.nom + " (s'ouvre dans un nouvel onglet)" : " : site de " + c.nom + ", cherche le film (s'ouvre dans un nouvel onglet)"));
      l.appendChild(lien);
      var info = [];
      if (it.m) info.push(it.m + (it.t ? " " + it.t : ""));
      if (!it.uf) info.push("accueil du cinéma");
      if (info.length) l.appendChild(creer("span", "caption seance__info", info.join(", ")));
      ul.appendChild(l);
    });
    li.appendChild(ul);
    return li;
  }

  /* conteneur : élément vide. films : films du swipe (avec seances). cinemas : JSON des cinémas.
     opts : { semaine, limite (5 par défaut), titreId } */
  function liste(conteneur, films, cinemas, opts) {
    opts = opts || {};
    var limite = opts.limite || 5;
    conteneur.textContent = "";
    if (!films.length) return;
    var zoneLieu = creer("div");
    var zoneListe = creer("div", "seances");
    conteneur.appendChild(zoneLieu);
    conteneur.appendChild(zoneListe);
    monter(zoneLieu, villes(cinemas));
    var tout = false;

    function dessiner() {
      zoneListe.textContent = "";
      var l = classer(cinemas, films);
      if (!l.length) {
        zoneListe.appendChild(creer("p", "caption", "Aucun cinéma n'est renseigné pour ces films pour l'instant. Les séances sont sur la page de chaque film."));
        return;
      }
      var visibles = tout ? l : l.slice(0, limite);
      var ol = creer("ol", "seances__liste");
      visibles.forEach(function (x) { ol.appendChild(ligneCinema(x, films.length, opts.semaine)); });
      zoneListe.appendChild(ol);
      if (l.length > visibles.length) {
        var p = creer("p");
        var b = creer("button", "btn btn--ghost btn--small", "Voir les " + (l.length - visibles.length) + " autres cinémas");
        b.type = "button";
        b.addEventListener("click", function () { tout = true; dessiner(); });
        p.appendChild(b); zoneListe.appendChild(p);
      }
      zoneListe.appendChild(creer("p", "caption", etat
        ? "Classés du plus proche au plus éloigné, à vol d'oiseau : le trajet réel peut être plus long. Les horaires sont sur le site du cinéma."
        : "Classés par nombre de films que tu as gardés. Donne ton lieu pour les classer par distance. Les horaires sont sur le site du cinéma."));
    }
    enregistrer(dessiner, zoneListe);
    dessiner();
  }

  /* ---------- Fiche film : liste rendue côté serveur, ici on ajoute les distances et le tri ---------- */
  function initFiche() {
    var ul = document.getElementById("ou-voir-liste");
    var zone = document.getElementById("ou-voir-lieu");
    if (!ul || !zone) return;
    var lis = Array.prototype.slice.call(ul.querySelectorAll("li.seance"));
    var cinemas = lis.map(function (li) {
      return { id: li.getAttribute("data-cinema"), ville: li.getAttribute("data-ville"), lat: parseFloat(li.getAttribute("data-lat")), lng: parseFloat(li.getAttribute("data-lng")) };
    });
    monter(zone, villes(cinemas));
    zone.hidden = false;
    lis.forEach(function (li, i) { li.setAttribute("data-ordre", String(i)); });
    function trier() {
      lis.forEach(function (li) {
        var cible = li.querySelector(".seance__dist");
        var p = etat;
        var lat = parseFloat(li.getAttribute("data-lat")), lng = parseFloat(li.getAttribute("data-lng"));
        if (p && isFinite(lat) && isFinite(lng)) {
          var d = distance(p, { lat: lat, lng: lng });
          li.setAttribute("data-d", String(d));
          cible.textContent = kmFr(d);
          cible.appendChild(sr(" à vol d'oiseau"));
          cible.hidden = false;
        } else { li.removeAttribute("data-d"); cible.textContent = ""; cible.hidden = true; }
      });
      lis.slice().sort(function (a, b) {
        var da = a.getAttribute("data-d"), db = b.getAttribute("data-d");
        if (da != null && db != null && da !== db) return parseFloat(da) - parseFloat(db);
        return Number(a.getAttribute("data-ordre")) - Number(b.getAttribute("data-ordre"));
      }).forEach(function (li) { ul.appendChild(li); });
      var note = document.getElementById("ou-voir-note");
      if (note) note.textContent = etat
        ? "Classés du plus proche au plus éloigné, à vol d'oiseau : le trajet réel peut être plus long."
        : "Donne ton lieu pour classer les cinémas par distance.";
    }
    enregistrer(trier, ul);
    trier();
  }

  window.csGeo = {
    get: function () { return etat; },
    distance: distance, kmFr: kmFr, villes: villes, classer: classer,
    surChangement: function (f, pour) { enregistrer(f, pour); }
  };
  window.csLieu = { monter: monter, liste: liste };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initFiche);
  else initFiche();
})();
