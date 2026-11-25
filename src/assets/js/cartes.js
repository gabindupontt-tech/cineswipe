/* Mes cartes : choix des cartes (gardé dans ce navigateur), calcul de rentabilité d'un abonnement,
   et prix personnalisé sur les fiches film. Aucune donnée n'est envoyée. */
(function () {
  var jsonEl = document.getElementById("cartes-data");
  if (!jsonEl) return;
  var data = JSON.parse(jsonEl.textContent);
  var cartes = data.cartes || [];
  var CLE = "cs_cartes";
  var base = document.body.getAttribute("data-base") || "/";
  function track(nom, params) { if (typeof window.csTrack === "function") window.csTrack(nom, params); }
  function fr(n, d) { return n.toFixed(d == null ? 2 : d).replace(".", ",").replace(/,00$/, ""); }
  function euros(n) { return fr(n) + " €"; }

  function lire() {
    try {
      var v = JSON.parse(localStorage.getItem(CLE));
      if (Array.isArray(v)) return v.filter(function (id) { return cartes.some(function (c) { return c.id === id; }); });
    } catch (e) {}
    return [];
  }
  function ecrire(ids) { try { localStorage.setItem(CLE, JSON.stringify(ids)); } catch (e) {} }
  function carte(id) { return cartes.filter(function (c) { return c.id === id; })[0]; }

  /* ---------- Page "Mes cartes" ---------- */
  var app = document.getElementById("cartes-app");
  if (app) {
    var mes = lire();
    app.querySelectorAll("input[data-carte]").forEach(function (cb) {
      cb.checked = mes.indexOf(cb.getAttribute("data-carte")) >= 0;
      cb.addEventListener("change", function () {
        var ids = lire().filter(function (i) { return i !== cb.getAttribute("data-carte"); });
        if (cb.checked) ids.push(cb.getAttribute("data-carte"));
        ecrire(ids);
        track("card_set", { carte: cb.getAttribute("data-carte"), etat: cb.checked ? "ajoutee" : "retiree" });
      });
    });

    var curseur = document.getElementById("simu-films");
    var valeur = document.getElementById("simu-films-val");
    var champPrix = document.getElementById("simu-prix");
    var base0 = (data.reference && data.reference.montant) || 8;
    var utilise = false;
    function calculer() {
      var films = parseFloat(curseur.value) || 0;
      var prix = parseFloat(champPrix.value);
      if (!(prix > 0)) prix = base0;
      valeur.textContent = films % 1 ? fr(films, 1) : String(films);
      app.querySelectorAll("[data-abo]").forEach(function (bloc) {
        var abo = parseFloat(bloc.getAttribute("data-prix"));
        var seance = films * prix;
        bloc.querySelector("[data-seance]").textContent = euros(seance);
        var seuil = abo / prix;
        var v = bloc.querySelector("[data-verdict]");
        var diff = Math.abs(seance - abo);
        var lab = films === 1 ? "1 film" : (films % 1 ? fr(films, 1) : String(films)) + " films";
        v.textContent = seance >= abo
          ? "À " + lab + " par mois, l'abonnement te fait économiser " + euros(diff) + " par mois."
          : "À " + lab + " par mois, payer à la séance coûte " + euros(diff) + " de moins par mois. L'abonnement devient rentable à partir d'environ " + fr(seuil, 1) + " films par mois.";
      });
      if (!utilise) { utilise = true; track("calculator_use", {}); }
    }
    curseur.addEventListener("input", calculer);
    champPrix.addEventListener("input", calculer);
    calculer();
    utilise = false; // le premier calcul automatique ne compte pas comme une utilisation
    return;
  }

  /* ---------- Fiche film : prix personnalisé ---------- */
  var mon = document.getElementById("mon-prix");
  if (!mon) return;
  var ids = lire();
  var type = (mon.getAttribute("data-tarif-type") || "").toLowerCase();
  var montant = parseFloat(mon.getAttribute("data-montant"));
  var seances = document.querySelectorAll(".seance[data-circuit]");
  var phrases = [];

  ids.forEach(function (id) {
    var c = carte(id);
    if (!c) return;
    if (c.type === "abonnement") {
      var chez = [];
      seances.forEach(function (s) {
        if ((s.getAttribute("data-circuit") || "").toLowerCase() === c.circuit.toLowerCase()) {
          chez.push(s.querySelector(".seance__nom").textContent);
          var p = document.createElement("p");
          p.className = "caption seance__carte";
          p.textContent = "Séance incluse avec ta carte " + c.nom + ".";
          var ref = s.querySelector(".seance__adresse");
          if (ref && ref.parentNode) ref.parentNode.insertBefore(p, ref.nextSibling); else s.appendChild(p);
        }
      });
      if (chez.length) phrases.push("Avec ta carte " + c.nom + " : séance incluse chez " + chez.join(", ") + " (abonnement " + c.prixMensuelFr + " par mois).");
    } else if (c.type === "reduction" && c.tarifType.toLowerCase() === type && !isNaN(montant)) {
      phrases.push("Avec ta carte (" + c.tarifType + ") : " + euros(montant) + " dans le cinéma où le tarif a été relevé.");
    }
  });

  if (phrases.length) { mon.textContent = phrases.join(" "); mon.hidden = false; }
  else if (!ids.length && cartes.length) {
    mon.textContent = "";
    var a = document.createElement("a");
    a.href = base + "cartes/";
    a.textContent = "Tu as une carte ou un abonnement ? Renseigne-le pour voir ton prix.";
    mon.appendChild(a);
    mon.hidden = false;
  }
})();
