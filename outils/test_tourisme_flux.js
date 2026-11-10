/*
 * Test de la carte des flux touristiques mondiaux (fiche de géographie 05) dans un DOM simulé.
 *     node outils/test_tourisme_flux.js [composant.html]
 * On vérifie les cinq régions d'ONU Tourisme et leurs chiffres, le changement d'année et de mesure,
 * le choix d'une région ou d'un pays, la désélection (second clic, Échap), le zoom à deux doigts,
 * Réinitialiser (page.js) et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "tourisme-flux.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("tourisme-flux");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".tfm__intertitre").textContent;
const vue = () => un(".tfm__vue").textContent;
const annee = (a) => un(`.tfm__annee[data-annee="${a}"]`);
const etatDepart = () => JSON.stringify(racine.tfm.etat()) + "|" + tous(".tfm__puce").map((b) => b.getAttribute("aria-pressed")).join() + "|" + titre();
const D = racine.tfm.donnees;

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("cinq régions colorées et un cercle par région", tous(".tfm__region:not([data-r='aucune'])").length === 5 && tous(".tfm__cercle").length === 5);
verifier("dix pays numérotés", tous(".tfm__marque").length === 10 && un('.tfm__marque[data-pays="fra"] text').textContent === "1");
verifier("au départ : 2024, les arrivées, le monde entier", choix() === "" && annee(2024).getAttribute("aria-pressed") === "true" && /1\u00a0465 millions/.test(titre()));
verifier("la somme des cinq régions égale le total mondial (à 1 million près) pour chaque année", D.annees.every((a, i) => Math.abs(D.regions.reduce((s, r) => s + r.a[i], 0) - D.monde[i]) <= 4), D.annees.map((a, i) => Math.round(D.regions.reduce((s, r) => s + r.a[i], 0))).join());
verifier("la fiche du monde liste les cinq régions", tous(".tfm__vue .tfm__choisir").length === 5);
const rEur = () => Number(un('.tfm__cercle[data-r="eur"]').getAttribute("r"));
const r2024 = rEur();
verifier("l'aire du cercle suit le nombre de touristes (Europe 2024 : 764,7 M)", Math.abs(r2024 - 2.15 * Math.sqrt(764.7)) < .2, r2024);
verifier("data-reinitialiser et boutons de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".tfm__entete .reinitialiser") && !!un(".tfm__entete .plein-ecran"));
const depart = etatDepart();

console.log("ANNÉES ET MESURES");
clic(annee(2020));
verifier("2020 : 409 millions, -72 %", /409 millions/.test(titre()) && /-72/.test(vue()));
verifier("le cercle de l'Europe rapetisse en 2020", rEur() < r2024 * .6);
clic(un('.tfm__mesure[data-mesure="departs"]'));
verifier("en 2020, on peut montrer les départs (cercles en tirets)", racine.tfm.etat().mesure === "departs" && tous(".tfm__cercle.est-depart").length === 5);
verifier("Asie et Pacifique : 58 M de départs en 2020", /58 M/.test(un('.tfm__cercle[data-r="asp"]').nextSibling ? tous(".tfm__valeur").map((t) => t.textContent).join(" ") : ""), tous(".tfm__valeur").map((t) => t.textContent).join(" "));
verifier("en mode départs, la fiche du monde parle des départs (1 436 M en 2019 devient 395 M en 2020)", /Les départs en 2020/.test(un(".tfm__vue").textContent) && /D'où partent/.test(vue()) && /58 M/.test(vue()));
verifier("en mode départs, 2023 à 2025 sont désactivées et un avis l'explique", annee(2023).disabled && annee(2025).disabled && !annee(2022).disabled && !un(".tfm__avis").hidden);
clic(un('.tfm__mesure[data-mesure="arrivees"]'));
verifier("en mode arrivées, toutes les années sont permises et l'avis disparaît", !annee(2025).disabled && un(".tfm__avis").hidden);
clic(annee(2024));
clic(un('.tfm__mesure[data-mesure="departs"]'));
verifier("depuis 2024, « Les départs » ramène l'année à 2022 (dernière publiée)", racine.tfm.etat().mesure === "departs" && racine.tfm.etat().annee === 2022 && /952 millions/.test(vue()) && !un('.tfm__mesure[data-mesure="departs"]').disabled);
clic(tous(".tfm__vue .tfm__choisir")[0]);
verifier("la fiche d'une région, en mode départs, montre le graphe des départs", choix() === "region:eur" && /Départs, en millions/.test(vue()) && /Départs en 2022/.test(vue()));
clic(tous(".tfm__vue .tfm__retour").find((b) => /monde/.test(b.textContent)));
clic(un('.tfm__mesure[data-mesure="arrivees"]'));
clic(annee(2025));
verifier("2025 : 1 520 millions (chiffres provisoires)", /1\u00a0520 millions/.test(titre()) && /provisoires/.test(vue()));
clic(annee(2024));

console.log("CHOIX ET DÉSÉLECTION");
clic(un('.tfm__cercle[data-r="afr"]'));
verifier("un clic sur le cercle de l'Afrique ouvre sa fiche", choix() === "region:afr" && titre() === "Afrique" && /75,4 millions/.test(vue()));
verifier("les autres régions sont estompées", tous(".tfm__cercle.est-estompe").length === 4);
clic(un('.tfm__cercle[data-r="afr"]'));
verifier("un second clic désélectionne", choix() === "" && tous(".tfm__cercle.est-estompe").length === 0);
clic(un('.tfm__region[data-r="eur"]'));
verifier("un clic sur l'Europe (la terre) ouvre aussi sa fiche", choix() === "region:eur" && /reçu .* de plus/.test(vue()));
clic(tous(".tfm__vue .tfm__choisir").find((b) => /France/.test(b.textContent)));
verifier("depuis l'Europe, on ouvre la France", choix() === "pays:fra" && /102 millions/.test(vue()) && un(".tfm__pays-choisi").getAttribute("d") !== "");
clic(un('.tfm__marque[data-pays="fra"]'));
verifier("un second clic sur la France désélectionne", choix() === "" && un(".tfm__pays-choisi").getAttribute("d") === "");
clic(un('.tfm__marque[data-pays="jpn"]'));
touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(un('.tfm__couche[data-couche="top"]'));
verifier("on peut masquer les dix pays", un(".tfm__marques").style.display === "none");
clic(un('.tfm__couche[data-couche="top"]'));

console.log("ZOOM ET RÉINITIALISATION");
const carte = un(".tfm__carte");
const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
const raf = window.requestAnimationFrame; window.requestAnimationFrame = undefined;
const d1 = toucher("touchstart", [doigt(300, 200, 1), doigt(340, 200, 2)]);
toucher("touchmove", [doigt(260, 200, 1), doigt(380, 200, 2)]);
toucher("touchend", []);
window.requestAnimationFrame = raf;
verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && carte.classList.contains("est-zoomee"));
clic(annee(2021)); clic(un('.tfm__cercle[data-r="mo"]'));
clic(un(".tfm__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart && !carte.classList.contains("est-zoomee"), etatDepart());

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [];
D.annees.forEach((a) => { clic(annee(a)); textes.push(un(".tfm__lecture").textContent); D.regions.forEach((r) => { racine.tfm.choisir({ type: "region", id: r.id }); textes.push(un(".tfm__lecture").textContent); racine.tfm.choisir(null); }); });
D.pays.forEach((p) => { racine.tfm.choisir({ type: "pays", id: p.id }); textes.push(un(".tfm__lecture").textContent); racine.tfm.choisir(null); });
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
const t = copie.textContent + textes.join(" ");
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
verifier("aucun « undefined » ni « NaN »", !/undefined|NaN/.test(t));
const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées tfm__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)tfm/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
verifier("sources citées (ONU Tourisme, Natural Earth)", /ONU Tourisme/.test(un(".tfm__source").textContent) && /Natural Earth/.test(un(".tfm__source").textContent));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
