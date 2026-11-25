/* Consentement + Google Analytics 4.
   Règle : sans accord explicite, AUCUN script Google n'est chargé et rien n'est mesuré.
   Le choix (accepter ou refuser) est gardé 6 mois dans le navigateur. */
(function () {
  var GA = document.body.getAttribute("data-ga") || "";
  var API = document.body.getAttribute("data-api") || "";
  var CLE = "cs_consent";
  var DUREE = 183 * 24 * 3600 * 1000; // environ 6 mois
  var banniere = document.getElementById("consent");
  var declencheur = null;

  function lire() {
    try {
      var v = JSON.parse(localStorage.getItem(CLE));
      if (v && (v.v === "granted" || v.v === "denied") && Date.now() - v.t < DUREE) return v.v;
    } catch (e) {}
    return null;
  }
  function ecrire(valeur) {
    try { localStorage.setItem(CLE, JSON.stringify({ v: valeur, t: Date.now() })); } catch (e) {}
  }

  function chargerGA() {
    if (!GA || window.__csGA) return;
    window.__csGA = true;
    window["ga-disable-" + GA] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA, {
      cookie_expires: 34128000, // 13 mois maximum
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA);
    document.head.appendChild(s);
  }

  function supprimerCookiesGA() {
    var hote = location.hostname.split(".");
    var domaines = [location.hostname];
    for (var i = 1; i < hote.length - 1; i++) domaines.push("." + hote.slice(i).join("."));
    document.cookie.split(";").forEach(function (c) {
      var nom = c.split("=")[0].trim();
      if (nom === "_ga" || nom.indexOf("_ga_") === 0 || nom === "_gid") {
        domaines.forEach(function (d) {
          document.cookie = nom + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + d;
        });
        document.cookie = nom + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      }
    });
  }

  function appliquer(valeur) {
    if (valeur === "granted") chargerGA();
    else if (GA) { window["ga-disable-" + GA] = true; window.__csGA = false; supprimerCookiesGA(); }
  }

  function montrer(focus) {
    if (!banniere) return;
    banniere.hidden = false;
    if (focus) { banniere.setAttribute("tabindex", "-1"); banniere.focus(); }
  }
  function cacher() { if (banniere) banniere.hidden = true; }

  /* API de mesure : n'envoie rien tant que le consentement n'est pas accordé. */
  window.csTrack = function (nom, params) {
    if (window.__csGA && typeof window.gtag === "function") window.gtag("event", nom, params || {});
  };

  /* Lecture du choix par les autres scripts (stats.js) : "granted", "denied" ou null. */
  window.csConsent = lire;

  if (GA || API) {
    var choix = lire();
    appliquer(choix);
    if (!choix) montrer(false);

    document.addEventListener("click", function (e) {
      var bouton = e.target.closest && e.target.closest("[data-consent]");
      if (bouton) {
        var valeur = bouton.getAttribute("data-consent");
        ecrire(valeur);
        appliquer(valeur);
        cacher();
        if (declencheur && document.body.contains(declencheur)) declencheur.focus();
        declencheur = null;
        return;
      }
      var ouvrir = e.target.closest && e.target.closest("[data-consent-open]");
      if (ouvrir) { declencheur = ouvrir; montrer(true); }
    });
  }
})();
