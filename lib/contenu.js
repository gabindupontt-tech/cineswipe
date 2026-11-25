// Charge contenu/films/*.md et contenu/semaines/*.md, les valide et prépare tout ce que les gabarits utilisent.
// Si une erreur est détectée, la construction du site s'arrête avec un message en français qui dit quel fichier corriger.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { load as chargerYaml } from "js-yaml";
import MarkdownIt from "markdown-it";
import Image from "@11ty/eleventy-img";
import { lireReglages } from "./reglages.js";
import { isoDate, dateFr, ajouteJours, aujourdhuiParis, prixFr, dureeFr, tronque, finDePhrase } from "./format.js";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const estHttps = (u) => {
  if (typeof u !== "string" || !/^https:\/\/[^\s]+$/.test(u)) return false;
  try { const h = new URL(u).hostname; return h.includes(".") && !h.includes("..") && !h.startsWith(".") && !h.endsWith("."); }
  catch { return false; }
};

export const RUBRIQUES = {
  "ca-vaut-le-prix": { nom: "Ça vaut le prix ?", intro: "Le verdict de la semaine : pour qui, combien, pourquoi en salle." },
  "budget-cine": { nom: "Budget ciné", intro: "Tarifs, cartes et calculs pour aller au cinéma sans se ruiner." },
  "en-bande": { nom: "En bande", intro: "Choisir et organiser une sortie à plusieurs." },
  "sur-le-terrain": { nom: "Sur le terrain", intro: "Les cinémas de Clermont-Ferrand, vus de l'intérieur." },
};
export const CATEGORIES = { nouveau: "À l'affiche", independant: "Indépendant", reprise: "Reprise" };
const TYPES_CINEMA = { circuit: "Circuit", independant: "Indépendant" };
const ANNEE_COURANTE = Number(aujourdhuiParis().slice(0, 4));

// Fraîcheur d'un relevé de prix : nombre de jours depuis la date du relevé, comparé au seuil de reglages.yml (fraicheur_jours).
const joursEntre = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
function fraicheur(dateIso, aujourdhui, seuil) {
  const n = joursEntre(dateIso, aujourdhui);
  const texte = n <= 0 ? "Relevé aujourd'hui" : n === 1 ? "Relevé hier" : `Relevé il y a ${n} jours`;
  return { jours: n, texte, ancien: n > seuil };
}

function lireDossier(dossier) {
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier).filter((f) => f.endsWith(".md")).sort();
}

export async function chargerContenu() {
  const reglages = lireReglages();
  const { racine, origin, basePath } = reglages;
  const erreurs = [];
  const alertes = [];
  const aujourdhui = aujourdhuiParis();
  const seuilFraicheur = Number.isInteger(reglages.fraicheur_jours) && reglages.fraicheur_jours > 0 ? reglages.fraicheur_jours : 14;
  const abs = (chemin) => origin + basePath + chemin;

  // ---------- Cinémas ----------
  const cinemas = new Map();
  const cinemasExemples = [];
  for (const fichier of lireDossier(path.join(racine, "contenu", "cinemas"))) {
    const id = fichier.replace(/\.md$/, "");
    const nom = `contenu/cinemas/${fichier}`;
    const err = (m) => erreurs.push(`${nom} : ${m}`);
    const warn = (m) => alertes.push(`${nom} : ${m}`);
    if (!SLUG.test(id)) err(`le nom du fichier doit être en minuscules, sans accent ni espace (ex. le-nom-du-cinema.md).`);
    let data;
    try {
      ({ data } = matter(fs.readFileSync(path.join(racine, nom), "utf8")));
    } catch (e) {
      err(`le bloc d'en-tête (entre les deux lignes ---) est mal écrit. Détail : ${e.reason || e.message}`);
      continue;
    }
    if (!data.nom) err(`"nom" est vide.`);
    if (!data.ville) err(`"ville" est vide.`);
    if (!data.adresse) err(`"adresse" est vide (numéro, rue, code postal : elle s'affiche à côté de la distance).`);
    const type = data.type == null ? "circuit" : String(data.type);
    if (!TYPES_CINEMA[type]) err(`"type" doit être circuit ou independant.`);
    const lat = data.lat, lng = data.lng;
    if (typeof lat !== "number" || typeof lng !== "number") err(`"lat" et "lng" doivent être des nombres avec un point (ex. lat: 45.7772, lng: 3.0870). Astuce : clic droit sur le cinéma dans OpenStreetMap ou Google Maps, "Que se trouve-t-il ici ?".`);
    else {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) err(`"lat" doit être entre -90 et 90 et "lng" entre -180 et 180. Vérifie que les deux ne sont pas inversés.`);
      else if (lat < 41 || lat > 51.5 || lng < -5.5 || lng > 9.8) warn(`les coordonnées sont hors de la France métropolitaine : vérifie que "lat" (environ 41 à 51) et "lng" (environ -5 à 9) ne sont pas inversés.`);
    }
    if (!estHttps(data.site)) err(`"site" doit être le lien complet du site du cinéma (https://...).`);
    const exemple = data.exemple === true;
    if (exemple) cinemasExemples.push(id);
    cinemas.set(id, {
      id, exemple,
      nom: String(data.nom || id),
      ville: String(data.ville || ""),
      adresse: String(data.adresse || ""),
      type, typeLabel: TYPES_CINEMA[type] || "",
      circuit: data.circuit ? String(data.circuit) : "",
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
      site: data.site || "",
      osm: typeof lat === "number" && typeof lng === "number" ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}` : "",
    });
  }
  const cinemasUtilises = new Set();

  // ---------- Films ----------
  const films = new Map();
  const exemples = [];
  for (const fichier of lireDossier(path.join(racine, "contenu", "films"))) {
    const slug = fichier.replace(/\.md$/, "");
    const nom = `contenu/films/${fichier}`;
    const err = (m) => erreurs.push(`${nom} : ${m}`);
    const warn = (m) => alertes.push(`${nom} : ${m}`);
    if (!SLUG.test(slug)) err(`le nom du fichier doit être en minuscules, sans accent ni espace (ex. le-nom-du-film.md).`);

    let data, corps;
    try {
      ({ data, content: corps } = matter(fs.readFileSync(path.join(racine, nom), "utf8")));
    } catch (e) {
      err(`le bloc d'en-tête (entre les deux lignes ---) est mal écrit. Détail : ${e.reason || e.message}`);
      continue;
    }
    const v = data.verdict || {};
    const t = data.tarif || {};
    const r = data.reservation || {};

    if (!data.titre) err(`"titre" est vide.`);
    const sortie = isoDate(data.sortie);
    if (!sortie) err(`"sortie" doit être une date au format 2026-10-21.`);
    for (const [cle, etiquette] of [["pour_qui", "Pour qui"], ["prix", "Prix"], ["pourquoi_en_salle", "Pourquoi en salle"]]) {
      if (!v[cle] || !String(v[cle]).trim()) err(`verdict > ${cle} (${etiquette}) est vide : les trois lignes du verdict sont obligatoires.`);
      else if (String(v[cle]).length > 160) warn(`verdict > ${cle} fait ${String(v[cle]).length} caractères : au-delà de 160, la ligne sera longue à lire sur téléphone.`);
    }
    if (typeof t.montant !== "number" || !(t.montant > 0)) err(`tarif > montant doit être un nombre écrit avec un point (ex. 8.26).`);
    if (!t.type || String(t.type).length > 14) err(`tarif > type est obligatoire et fait 14 caractères au maximum (ex. "étudiant").`);
    if (!t.cinema) err(`tarif > cinema est vide.`);
    if (!t.source_nom) err(`tarif > source_nom est vide : un tarif sans source n'est pas publiable.`);
    if (!estHttps(t.source_url)) err(`tarif > source_url doit être un lien complet qui commence par https://.`);
    const dateTarif = isoDate(t.date);
    if (!dateTarif) err(`tarif > date doit être la date du relevé, au format 2026-10-21.`);
    const fraicheurTarif = dateTarif ? fraicheur(dateTarif, aujourdhui, seuilFraicheur) : null;
    if (fraicheurTarif && fraicheurTarif.jours < 0) warn(`tarif > date est dans le futur.`);
    else if (fraicheurTarif && fraicheurTarif.ancien) warn(`tarif relevé il y a ${fraicheurTarif.jours} jours (seuil ${seuilFraicheur}) : à revérifier avant publication.`);
    if (!estHttps(r.url)) err(`reservation > url doit être le lien complet de la page de réservation du cinéma (https://...).`);
    if (data.duree != null && !(Number.isInteger(data.duree) && data.duree > 0)) err(`"duree" est un nombre entier de minutes (ex. 112).`);

    const categorie = data.categorie == null ? "nouveau" : String(data.categorie);
    if (!CATEGORIES[categorie]) err(`"categorie" doit être nouveau, independant ou reprise.`);
    let annee = null;
    if (data.annee != null) {
      if (!Number.isInteger(data.annee) || data.annee < 1895 || data.annee > ANNEE_COURANTE) err(`"annee" est l'année de sortie d'origine du film, en 4 chiffres (ex. 1998).`);
      else annee = data.annee;
    }
    if (categorie === "reprise" && !annee) err(`une reprise doit avoir "annee" : l'année de sortie d'origine du film (ex. 1998).`);
    if (categorie !== "reprise" && annee && annee < ANNEE_COURANTE - 2) warn(`"annee" ${annee} mais "categorie" n'est pas "reprise" : si le film ressort en salle, mets categorie: reprise.`);

    const projections = [];
    if (data.projections != null && !Array.isArray(data.projections)) err(`"projections" doit être une liste de cinémas (voir le modèle).`);
    else {
      const vus = new Set();
      for (const [i, p] of (data.projections || []).entries()) {
        const n = `projections, élément ${i + 1}`;
        if (!p || typeof p !== "object" || !p.cinema) { err(`${n} : "cinema" est vide (nom du fichier du cinéma dans contenu/cinemas/, sans .md).`); continue; }
        const cid = String(p.cinema);
        const cin = cinemas.get(cid);
        if (!cin) { err(`${n} : le cinéma "${cid}" est introuvable dans contenu/cinemas/.`); continue; }
        if (vus.has(cid)) { err(`${n} : le cinéma "${cid}" est listé deux fois.`); continue; }
        vus.add(cid);
        cinemasUtilises.add(cid);
        if (p.url != null && !estHttps(p.url)) err(`${n} : "url" doit être un lien complet qui commence par https://.`);
        const champsTarif = ["montant", "type", "source_nom", "source_url", "date"];
        const presents = champsTarif.filter((k) => p[k] != null && p[k] !== "");
        let tarifProj = null;
        if (presents.length) {
          if (presents.length < champsTarif.length) err(`${n} : un tarif propre à ce cinéma demande ${champsTarif.join(", ")} (il manque : ${champsTarif.filter((k) => !presents.includes(k)).join(", ")}).`);
          else if (typeof p.montant !== "number" || !(p.montant > 0)) err(`${n} : "montant" doit être un nombre avec un point (ex. 8.26).`);
          else if (!estHttps(p.source_url)) err(`${n} : "source_url" doit être un lien complet (https://...).`);
          else if (!isoDate(p.date)) err(`${n} : "date" doit être la date du relevé (2026-10-21).`);
          else {
            const dp = isoDate(p.date);
            tarifProj = { montant: p.montant, montantFr: prixFr(p.montant), type: String(p.type), sourceNom: String(p.source_nom), sourceUrl: p.source_url, date: dp, dateFr: dateFr(dp), fraicheur: fraicheur(dp, aujourdhui, seuilFraicheur) };
            if (tarifProj.fraicheur.jours < 0) warn(`${n} : la date du relevé est dans le futur.`);
            else if (tarifProj.fraicheur.ancien) warn(`${n} : tarif relevé il y a ${tarifProj.fraicheur.jours} jours (seuil ${seuilFraicheur}) : à revérifier avant publication.`);
          }
        }
        projections.push({
          cinemaId: cid, cinema: cin,
          url: p.url || cin.site, urlFilm: !!p.url,
          tarif: tarifProj,
        });
      }
    }

    let poster = null;
    if (data.affiche) {
      const f = path.join(racine, "contenu", "affiches", String(data.affiche));
      if (!fs.existsSync(f)) err(`l'affiche "${data.affiche}" est introuvable dans contenu/affiches/.`);
      else {
        if (!data.affiche_alt) warn(`"affiche_alt" (description de l'affiche pour les lecteurs d'écran) est vide.`);
        if (!data.affiche_credit) warn(`"affiche_credit" est vide : le crédit de l'affiche est à indiquer.`);
        const meta = await Image(f, {
          widths: [320, 640],
          formats: ["webp", "jpeg"],
          outputDir: path.join(racine, "_site", "img"),
          urlPath: basePath + "/img/",
          filenameFormat: (_id, _src, largeur, format) => `${slug}-${largeur}.${format}`,
          sharpWebpOptions: { quality: 76 },
          sharpJpegOptions: { quality: 76 },
        });
        const grand = meta.jpeg[meta.jpeg.length - 1];
        poster = {
          webpSrcset: meta.webp.map((m) => `${m.url} ${m.width}w`).join(", "),
          jpegSrc: meta.jpeg[0].url,
          jpegSrcset: meta.jpeg.map((m) => `${m.url} ${m.width}w`).join(", "),
          largeur: grand.width,
          hauteur: grand.height,
          og: origin + grand.url,
        };
      }
    }

    // Bande-annonce (facultative) : simple lien sortant, aucune vidéo n'est intégrée à la page (pas de tiers chargé).
    let bandeAnnonce = "";
    if (data.bande_annonce != null && data.bande_annonce !== "") {
      if (!estHttps(data.bande_annonce)) err(`"bande_annonce" doit être le lien complet de la bande-annonce officielle (https://...).`);
      else bandeAnnonce = data.bande_annonce;
    }

    // "Et à la maison ?" (facultatif) : 1 ou 2 titres sur une plateforme, avec la date et la page de vérification.
    let maison = null;
    if (data.maison != null) {
      const m = data.maison;
      if (typeof m !== "object" || Array.isArray(m)) err(`"maison" doit être un bloc avec verifie_le, source_nom, source_url et titres (voir le modèle).`);
      else {
        const dv = isoDate(m.verifie_le);
        if (!dv) err(`maison > verifie_le doit être la date où tu as vérifié la disponibilité, au format 2026-10-21.`);
        if (!m.source_nom) err(`maison > source_nom est vide : une disponibilité sans source n'est pas publiable.`);
        if (!estHttps(m.source_url)) err(`maison > source_url doit être un lien complet (https://...).`);
        const lt = Array.isArray(m.titres) ? m.titres : [];
        if (lt.length < 1 || lt.length > 2) err(`maison > titres : 1 ou 2 titres (il y en a ${lt.length}).`);
        const titres = [];
        lt.forEach((x, i) => {
          const n = `maison > titres, élément ${i + 1}`;
          if (!x || !x.titre || !x.plateforme || !x.pourquoi) { err(`${n} : "titre", "plateforme" et "pourquoi" sont obligatoires.`); return; }
          if (String(x.pourquoi).length > 160) warn(`${n} : "pourquoi" fait ${String(x.pourquoi).length} caractères (160 maximum conseillés).`);
          titres.push({ titre: String(x.titre), plateforme: String(x.plateforme), pourquoi: String(x.pourquoi) });
        });
        let abonnement = null;
        if (m.abonnement != null) {
          const a = m.abonnement;
          const da = a && isoDate(a.date);
          if (!a || !a.plateforme || typeof a.montant !== "number" || !(a.montant > 0) || !a.source_nom || !estHttps(a.source_url) || !da)
            err(`maison > abonnement demande plateforme, montant (nombre avec un point, par mois), source_nom, source_url (https://...) et date.`);
          else abonnement = { plateforme: String(a.plateforme), montant: a.montant, montantFr: prixFr(a.montant), sourceNom: String(a.source_nom), sourceUrl: a.source_url, dateFr: dateFr(da) };
        }
        if (dv && titres.length) maison = { verifieLe: dateFr(dv), sourceNom: String(m.source_nom || ""), sourceUrl: m.source_url || "", titres, abonnement };
      }
    }

    const exemple = data.exemple === true;
    if (exemple) exemples.push(slug);
    if (projections.length === 0) warn(`"projections" est vide : la fiche n'affichera pas "Où le voir près de toi".`);

    const url = `/films/${slug}/`;
    const montantFr = typeof t.montant === "number" ? prixFr(t.montant) : "";
    const genres = Array.isArray(data.genres) ? data.genres.map(String) : [];
    const duree = data.duree || null;
    const description = data.meta_description
      ? String(data.meta_description)
      : tronque(`${finDePhrase(v.pour_qui || "")} ${finDePhrase(v.prix || "")} Tarif ${t.type || ""} constaté : ${montantFr}.`, 155);

    films.set(slug, {
      slug, url, urlAbs: abs(url), exemple,
      titre: String(data.titre || slug),
      titreOriginal: data.titre_original || "",
      sortie, sortieFr: sortie ? dateFr(sortie) : "",
      duree, dureeFr: dureeFr(duree),
      genres,
      realisateur: data.realisateur || "",
      resume: data.resume || "",
      bonPlan: data.bon_plan === true,
      bandeAnnonce, maison,
      categorie, categorieLabel: CATEGORIES[categorie] || "", annee, enPlus: false,
      projections,
      verdict: { pourQui: v.pour_qui || "", prix: v.prix || "", pourquoiEnSalle: v.pourquoi_en_salle || "" },
      tarif: {
        montant: t.montant, montantFr, type: t.type || "", cinema: t.cinema || "",
        sourceNom: t.source_nom || "", sourceUrl: t.source_url || "",
        date: dateTarif, dateFr: dateTarif ? dateFr(dateTarif) : "", fraicheur: fraicheurTarif,
      },
      reservation: { url: r.url || "", cinema: r.cinema || t.cinema || "" },
      poster, afficheAlt: data.affiche_alt || "", afficheCredit: data.affiche_credit || "",
      noteHtml: corps && corps.trim() ? md.render(corps) : "",
      description,
      titreSeo: tronque(`${data.titre} : verdict, tarif ${t.type || ""} et réservation`, 50),
      noindex: exemple,
    });
  }

  // ---------- Semaines ----------
  const semainesBrutes = [];
  for (const fichier of lireDossier(path.join(racine, "contenu", "semaines"))) {
    const id = fichier.replace(/\.md$/, "");
    const nom = `contenu/semaines/${fichier}`;
    let data, corps;
    try {
      ({ data, content: corps } = matter(fs.readFileSync(path.join(racine, nom), "utf8")));
    } catch (e) {
      erreurs.push(`${nom} : le bloc d'en-tête est mal écrit. Détail : ${e.reason || e.message}`);
      continue;
    }
    const date = isoDate(data.date);
    if (!date) { erreurs.push(`${nom} : "date" doit être le mercredi de début de semaine, au format 2026-10-21.`); continue; }
    const slugs = Array.isArray(data.films) ? data.films.map(String) : [];
    if (slugs.length === 0) { erreurs.push(`${nom} : "films" est vide. Liste de 3 à 5 noms de fichiers de films (sans .md).`); continue; }
    if (slugs.length < 3 || slugs.length > 5) alertes.push(`${nom} : ${slugs.length} film(s) listé(s). La promesse de CinéSwipe est de 3 à 5 films par semaine.`);
    if (data.en_plus != null && !Array.isArray(data.en_plus)) { erreurs.push(`${nom} : "en_plus" doit être une liste de films (voir le modèle).`); continue; }
    const plus = Array.isArray(data.en_plus) ? data.en_plus.map(String) : [];
    if (plus.length > 6) alertes.push(`${nom} : ${plus.length} films dans "en_plus". Au-delà de 6, le swipe devient long : garde les plus utiles pour des étudiants.`);
    const inconnus = [...slugs, ...plus].filter((s) => !films.has(s));
    if (inconnus.length) { erreurs.push(`${nom} : film(s) introuvable(s) dans contenu/films/ : ${inconnus.join(", ")}.`); continue; }
    if (new Set([...slugs, ...plus]).size !== slugs.length + plus.length) { erreurs.push(`${nom} : un film est listé deux fois (dans "films" et "en_plus", ou deux fois dans la même liste).`); continue; }
    semainesBrutes.push({ id, date, slugs, plus, edito: corps && corps.trim() ? md.render(corps) : "" });
  }

  // Une semaine n'est publiée qu'à partir de sa date (permet de préparer à l'avance).
  const publiees = semainesBrutes.filter((s) => s.date <= aujourdhui).sort((a, b) => (a.date < b.date ? 1 : -1));
  const enAttente = semainesBrutes.filter((s) => s.date > aujourdhui);
  for (const s of enAttente) alertes.push(`contenu/semaines/${s.id}.md : semaine datée du ${s.date}, pas encore publiée (le site se reconstruit chaque jour, elle apparaîtra ce jour-là).`);

  const semaines = [];
  const deja = new Set();
  for (const s of publiees) {
    const url = s.id === publiees[0].id ? "/" : `/archives/${s.id}/`;
    const fin = ajouteJours(s.date, 6);
    const filmsSemaine = s.slugs.map((slug) => films.get(slug));
    const enPlus = s.plus.map((slug) => films.get(slug));
    const deck = [...filmsSemaine, ...enPlus];
    const semaine = {
      id: s.id, date: s.date, fin,
      dateFr: dateFr(s.date), finFr: dateFr(fin),
      label: `Semaine du ${dateFr(s.date, false)}`,
      labelLong: `Du ${dateFr(s.date, false)} au ${dateFr(fin)}`,
      edito: s.edito,
      films: filmsSemaine,
      enPlus, deck,
      deckHash: crypto.createHash("sha1").update(s.id + "|" + deck.map((f) => f.slug).join("|")).digest("hex").slice(0, 6),
      url,
      bonPlan: deck.some((f) => f.bonPlan),
      exemple: deck.some((f) => f.exemple),
    };
    semaines.push(semaine);
  }
  // Contexte de semaine pour chaque film publié (la semaine la plus récente l'emporte).
  const filmsPublies = [];
  for (const semaine of semaines) {
    for (const f of semaine.deck) {
      if (deja.has(f.slug)) { alertes.push(`contenu/films/${f.slug}.md : présent dans plusieurs semaines, la plus récente est utilisée.`); continue; }
      deja.add(f.slug);
      f.semaineId = semaine.id; f.semaineLabel = semaine.label; f.semaineUrl = semaine.url; f.semaineBonPlan = semaine.bonPlan;
      f.enPlus = semaine.enPlus.includes(f);
      filmsPublies.push(f);
    }
  }
  for (const [slug] of films) {
    if (!semainesBrutes.some((s) => s.slugs.includes(slug) || s.plus.includes(slug))) alertes.push(`contenu/films/${slug}.md : film qui n'est dans aucune semaine, il n'a pas de page.`);
  }

  for (const [id] of cinemas) {
    if (!cinemasUtilises.has(id)) alertes.push(`contenu/cinemas/${id}.md : cinéma qu'aucun film n'utilise dans "projections".`);
  }
  if (cinemasExemples.length) alertes.push(`${cinemasExemples.length} cinéma(s) d'EXEMPLE (ligne "exemple: true") : adresses et coordonnées fictives. Remplace-les par de vrais cinémas puis supprime la ligne "exemple".`);
  if (exemples.length) alertes.push(`${exemples.length} fiche(s) d'EXEMPLE (ligne "exemple: true") : ${exemples.join(", ")}. Les pages qui les montrent ne sont pas indexées par Google. Remplace-les par de vrais films puis supprime la ligne "exemple".`);
  const cartesData = chargerCartes(racine, erreurs);
  if (erreurs.length) {
    throw new Error("\n\n  CONTENU À CORRIGER AVANT PUBLICATION\n\n  - " + erreurs.join("\n  - ") + "\n");
  }
  for (const a of alertes) console.warn("[cinéswipe] ⚠ " + a);

  // Relevés de prix de l'équipe, cinéma par cinéma (le plus récent par cinéma et par type) : alimente la page /tarifs/.
  const mapReleves = new Map();
  const ajouteReleve = (cinemaNom, type, montant, dateIso, sourceNom, sourceUrl, exemple) => {
    if (!cinemaNom || !type || !(montant > 0) || !dateIso) return;
    const k = `${cinemaNom}|${type}`.toLowerCase();
    const ex = mapReleves.get(k);
    if (ex && ex.date >= dateIso) return;
    mapReleves.set(k, { cinema: cinemaNom, type, montant, montantFr: prixFr(montant), date: dateIso, dateFr: dateFr(dateIso), fraicheur: fraicheur(dateIso, aujourdhui, seuilFraicheur), sourceNom, sourceUrl, exemple });
  };
  for (const f of filmsPublies) {
    ajouteReleve(f.tarif.cinema, f.tarif.type, f.tarif.montant, f.tarif.date, f.tarif.sourceNom, f.tarif.sourceUrl, f.exemple);
    for (const p of f.projections) if (p.tarif) ajouteReleve(p.cinema.nom, p.tarif.type, p.tarif.montant, p.tarif.date, p.tarif.sourceNom, p.tarif.sourceUrl, f.exemple);
  }
  const releves = [...mapReleves.values()].sort((a, b) => a.cinema.localeCompare(b.cinema, "fr") || a.montant - b.montant);

  const courante = semaines[0] || null;
  const archives = semaines.slice(1);

  // Données allégées pour les pages Swipe, Groupes et "Où le voir" (une seule source : les mêmes fichiers).
  const cinemaJson = (c) => ({ id: c.id, nom: c.nom, ville: c.ville, adresse: c.adresse, type: c.type, circuit: c.circuit, lat: c.lat, lng: c.lng, site: c.site, osm: c.osm, exemple: c.exemple });
  const filmJson = (f) => ({
    slug: f.slug, titre: f.titre, url: f.url, urlAbs: f.urlAbs,
    genres: f.genres, bonPlan: f.bonPlan, exemple: f.exemple,
    categorie: f.categorie, categorieLabel: f.categorieLabel, annee: f.annee, enPlus: f.enPlus,
    pourQui: f.verdict.pourQui, prix: f.verdict.prix, pourquoi: f.verdict.pourquoiEnSalle,
    montant: f.tarif.montant, montantFr: f.tarif.montantFr, tarifType: f.tarif.type, cinema: f.reservation.cinema,
    reservationUrl: f.reservation.url,
    seances: f.projections.map((p) => ({
      c: p.cinemaId, u: p.url, uf: p.urlFilm,
      m: p.tarif ? p.tarif.montantFr : null, t: p.tarif ? p.tarif.type : null,
    })),
    poster: f.poster ? { webp: f.poster.webpSrcset, src: f.poster.jpegSrc } : null,
    afficheAlt: f.afficheAlt,
  });
  const swipe = courante ? courante.deck.map(filmJson) : [];
  const cinemasSwipe = courante
    ? [...new Set(courante.deck.flatMap((f) => f.projections.map((p) => p.cinemaId)))].map((id) => cinemaJson(cinemas.get(id)))
    : [];
  const filmJsonParSlug = Object.fromEntries(filmsPublies.map((f) => [f.slug, filmJson(f)]));

  const articles = chargerArticles(racine, basePath, abs, erreurs, alertes);

  return {
    articles, rubriques: RUBRIQUES,
    films: filmsPublies,
    cartes: cartesData.cartes, referenceCartes: cartesData.reference, prixMoyens: cartesData.prixMoyens, releves, seuilFraicheur,
    semaines, courante, archives, swipe, cinemasSwipe, filmJsonParSlug, cinemaJson,
    cinemas: [...cinemas.values()].filter((c) => cinemasUtilises.has(c.id)),
    aDuContenu: !!courante,
    aDesExemples: filmsPublies.some((f) => f.exemple) || cinemasExemples.length > 0,
  };
}


// ---------- Cartes de réduction et prix de référence (contenu/cartes.yml) ----------
function chargerCartes(racine, erreurs) {
  const fichier = path.join(racine, "contenu", "cartes.yml");
  if (!fs.existsSync(fichier)) return { cartes: [], reference: null, prixMoyens: [] };
  const err = (m) => erreurs.push(`contenu/cartes.yml : ${m}`);
  let brut;
  try { brut = chargerYaml(fs.readFileSync(fichier, "utf8")) || {}; }
  catch (e) { err(`fichier mal écrit. Détail : ${e.reason || e.message}`); return { cartes: [], reference: null, prixMoyens: [] }; }

  let reference = null;
  const r = brut.reference;
  if (r != null) {
    const d = isoDate(r.date);
    if (typeof r.montant !== "number" || !(r.montant > 0) || !r.source_nom || !estHttps(r.source_url) || !d)
      err(`reference demande montant (nombre avec un point), source_nom, source_url (https://...) et date de consultation.`);
    else {
      reference = { montant: r.montant, montantFr: prixFr(r.montant), libelle: String(r.libelle || "Prix de la place"), sourceNom: String(r.source_nom), sourceUrl: r.source_url, dateFr: dateFr(d), note: r.note ? String(r.note) : "" };
      const e = r.entrees_par_an;
      if (e != null) {
        const de = isoDate(e.date);
        if (typeof e.valeur !== "number" || !(e.valeur > 0) || !e.source_nom || !estHttps(e.source_url) || !de) err(`reference > entrees_par_an demande valeur, source_nom, source_url et date.`);
        else reference.entreesParAn = { valeur: e.valeur, sourceNom: String(e.source_nom), sourceUrl: e.source_url, dateFr: dateFr(de), note: e.note ? String(e.note) : "" };
      }
    }
  }

  const cartes = [];
  const ids = new Set();
  if (brut.cartes != null && !Array.isArray(brut.cartes)) err(`"cartes" doit être une liste.`);
  for (const [i, c] of (Array.isArray(brut.cartes) ? brut.cartes : []).entries()) {
    const n = `cartes, élément ${i + 1}`;
    if (!c || !SLUG.test(String(c.id || ""))) { err(`${n} : "id" en minuscules, sans accent, avec des tirets.`); continue; }
    if (ids.has(c.id)) { err(`${n} : l'id "${c.id}" est utilisé deux fois.`); continue; }
    ids.add(c.id);
    if (!c.nom) { err(`${n} : "nom" est vide.`); continue; }
    const type = String(c.type || "");
    if (type === "abonnement") {
      const d = isoDate(c.date);
      if (!c.circuit || typeof c.prix_mensuel !== "number" || !(c.prix_mensuel > 0) || !c.source_nom || !estHttps(c.source_url) || !d) {
        err(`${n} : un abonnement demande circuit (le même mot que "circuit" dans les fiches cinéma), prix_mensuel (nombre avec un point), source_nom, source_url et date.`); continue;
      }
      cartes.push({ id: c.id, nom: String(c.nom), type, circuit: String(c.circuit), prixMensuel: c.prix_mensuel, prixMensuelFr: prixFr(c.prix_mensuel), sourceNom: String(c.source_nom), sourceUrl: c.source_url, dateFr: dateFr(d) });
    } else if (type === "reduction") {
      if (!c.tarif_type || String(c.tarif_type).length > 14) { err(`${n} : une réduction demande tarif_type (14 caractères maximum), identique au "type" du tarif dans les fiches film (ex. étudiant).`); continue; }
      cartes.push({ id: c.id, nom: String(c.nom), type, tarifType: String(c.tarif_type) });
    } else err(`${n} : "type" doit être abonnement ou reduction.`);
  }
  const prixMoyens = [];
  if (brut.prix_moyens != null && !Array.isArray(brut.prix_moyens)) err(`"prix_moyens" doit être une liste.`);
  for (const [i, x] of (Array.isArray(brut.prix_moyens) ? brut.prix_moyens : []).entries()) {
    const n = `prix_moyens, élément ${i + 1}`;
    const d = x && isoDate(x.date);
    if (!x || !x.libelle || typeof x.montant !== "number" || !(x.montant > 0) || !x.source_nom || !estHttps(x.source_url) || !d) {
      err(`${n} : "libelle", "montant" (nombre avec un point), "source_nom", "source_url" (https://...) et "date" sont obligatoires.`); continue;
    }
    prixMoyens.push({ libelle: String(x.libelle), montant: x.montant, montantFr: prixFr(x.montant), sourceNom: String(x.source_nom), sourceUrl: x.source_url, dateFr: dateFr(d), sources: Number.isInteger(x.sources) ? x.sources : 1, note: x.note ? String(x.note) : "" });
  }
  return { cartes, reference, prixMoyens };
}


// ---------- Articles (contenu/articles/*.md) ----------
// Gabarit : titre, rubrique, date, auteur, réponse directe, corps en markdown, sources numérotées. Un article sans relecteur est noindex.
function chargerArticles(racine, basePath, abs, erreurs, alertes) {
  const dossier = path.join(racine, "contenu", "articles");
  const articles = [];
  for (const fichier of lireDossier(dossier)) {
    const nom = `contenu/articles/${fichier}`;
    const err = (m) => erreurs.push(`${nom} : ${m}`);
    let data, content;
    try { ({ data, content } = matter(fs.readFileSync(path.join(dossier, fichier), "utf8"))); }
    catch (e) { err(`le bloc d'en-tête est mal écrit. Détail : ${e.reason || e.message}`); continue; }
    const slug = String(data.slug || "");
    if (!SLUG.test(slug)) { err(`"slug" en minuscules, sans accent, avec des tirets.`); continue; }
    if (!data.titre) err(`"titre" est vide.`);
    if (!RUBRIQUES[data.rubrique]) err(`"rubrique" doit être l'une de : ${Object.keys(RUBRIQUES).join(", ")}.`);
    if (!data.auteur) err(`"auteur" est vide.`);
    const meta = String(data.meta_description || "");
    if (!meta) err(`"meta_description" est vide.`);
    else if (meta.length > 175) alertes.push(`${nom} : meta_description de ${meta.length} caractères (au-delà de 160 environ, Google coupe).`);
    const d = isoDate(data.prix_releves_le);
    if (!d) err(`"prix_releves_le" doit être une date AAAA-MM-JJ.`);
    // corps : on retire le H1 (le gabarit l'affiche) et la section Sources (rendue à part, depuis la liste)
    let corps = content.replace(/^\s*# .*\n/, "");
    const iSrc = corps.search(/^## Sources\s*$/m);
    const lignesSrc = iSrc >= 0 ? corps.slice(iSrc).split("\n").slice(1) : [];
    if (iSrc >= 0) corps = corps.slice(0, iSrc);
    const sources = [];
    for (const l of lignesSrc) {
      const m = l.match(/^(\d+)\. (.*?) : (https:\/\/\S+)(?: \((.*)\))?\s*$/);
      if (m) sources.push({ n: Number(m[1]), nom: m[2], url: m[3], note: m[4] || "" });
      else if (l.trim()) err(`ligne de source illisible : « ${l.slice(0, 60)} ». Format : 1. Nom : https://... (consulté le ...).`);
    }
    if (!sources.length) err(`au moins une source est obligatoire (section « ## Sources »).`);
    for (const m of corps.matchAll(/\[(\d+)\]/g)) if (!sources.some((x) => x.n === Number(m[1]))) { err(`renvoi [${m[1]}] sans source correspondante.`); break; }
    if (/^##\s/m.test(corps) === false) alertes.push(`${nom} : aucun intertitre (## ...).`);
    const premierBrut = corps.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith("#") && !p.startsWith("|"));
    if (premierBrut) corps = corps.replace(premierBrut, "");
    const liens = corps.replace(/\]\(\//g, `](${basePath}/`);
    const reponse = (premierBrut || "").replace(/\s*\[\d+\]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
    const intertitres = [...corps.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    const relu = String(data.relu_par || "").trim();
    if (!relu) alertes.push(`${nom} : pas de relecteur (relu_par) : la page est publiée en « noindex » avec la mention « en relecture ».`);
    const illustration = data.illustration ? String(data.illustration) : "";
    const illustrationAlt = data.illustration_alt ? String(data.illustration_alt) : "";
    if (illustration && !illustrationAlt) err(`"illustration" demande "illustration_alt" (texte alternatif).`);
    const mots = corps.split(/\s+/).filter(Boolean).length;
    articles.push({
      slug, url: `/articles/${slug}/`, urlAbs: abs(`/articles/${slug}/`),
      titre: String(data.titre || ""), titreCourt: String(data.titre || ""), rubrique: data.rubrique, rubriqueNom: RUBRIQUES[data.rubrique]?.nom || "",
      auteur: String(data.auteur || ""), numero: data.numero, motCle: String(data.mot_cle_principal || ""),
      description: meta, date: d, dateFr: d ? dateFr(d) : "", relecteur: relu, enRelecture: !relu,
      illustration, illustrationAlt, reponse, intertitres, html: md.render(liens).replace(/<table>/g, '<div class="table-wrap"><table class="table-prix">').replace(/<\/table>/g, "</table></div>"), sources, mots, minutes: Math.max(1, Math.round(mots / 200)),
    });
  }
  articles.sort((a, b) => (a.numero || 0) - (b.numero || 0));
  return articles;
}
