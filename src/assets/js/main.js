/* Mesure des deux actions transverses (envoyées uniquement si l'utilisateur a accepté les cookies de mesure). */
(function () {
  function track(nom, params) { if (typeof window.csTrack === "function") window.csTrack(nom, params); }

  // Clic sortant vers une réservation : screening_click
  document.addEventListener("click", function (e) {
    var lien = e.target.closest && e.target.closest('[data-track="screening_click"]');
    if (!lien) return;
    track("screening_click", {
      film_slug: lien.getAttribute("data-film") || "",
      cinema: lien.getAttribute("data-cinema") || "",
      semaine: lien.getAttribute("data-semaine") || "",
      link_url: lien.href
    });
  });

  // Clic sur le lien de newsletter : newsletter_click
  document.addEventListener("click", function (e) {
    var l = e.target.closest && e.target.closest('[data-track="newsletter_click"]');
    if (!l) return;
    track("newsletter_click", { position: l.getAttribute("data-position") || "", link_url: l.href });
  });

  // Bande-annonce et partage d'une fiche film : trailer_click, film_share
  document.addEventListener("click", function (e) {
    var l = e.target.closest && e.target.closest('[data-track="trailer_click"],[data-track="film_share"]');
    if (!l) return;
    var nom = l.getAttribute("data-track");
    var p = { film_slug: l.getAttribute("data-film") || "", semaine: l.getAttribute("data-semaine") || "" };
    if (nom === "film_share") p.methode = l.getAttribute("data-methode") || "";
    track(nom, p);
  });
  var partager = document.getElementById("film-share");
  if (partager && navigator.share) {
    partager.hidden = false;
    partager.addEventListener("click", function () {
      navigator.share({ title: partager.getAttribute("data-titre"), text: partager.getAttribute("data-texte"), url: partager.getAttribute("data-url") })
        .then(function () { track("film_share", { film_slug: partager.getAttribute("data-film"), semaine: partager.getAttribute("data-semaine"), methode: "share" }); }, function () {});
    });
  }

  // Page de retour de la plateforme d'emailing après confirmation : newsletter_confirmed
  var cible = document.querySelector("[data-event-on-load]");
  if (cible) track(cible.getAttribute("data-event-on-load"), {});
})();
