/*
 * Test de la carte du traité de Tordesillas dans un DOM simulé.
 *     node outils/test_tordesillas.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi qu'il ne gêne pas les raccourcis de la page.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "tordesillas.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les conséquences</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const racine = document.getElementById("tordesillas");
const $ = (cle) => racine.querySelector(`[data-tds="${cle}"]`);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function boutonTexte(texte) {
  return Array.from(racine.querySelectorAll("button"))
    .find((b) => (b.getAttribute("aria-label") || b.textContent.trim()) === texte);
}
function onglet(nom) { return racine.querySelector(`.tds__onglet[data-onglet="${nom}"]`); }
function ongletActif() { const o = racine.querySelector('.tds__onglet[aria-selected="true"]'); return o ? o.getAttribute("data-onglet") : null; }
function annee(a) {
  const c = $("curseur");
  c.value = String(a);
  c.dispatchEvent(new window.Event("input", { bubbles: true }));
}
function lieu(id) { return racine.querySelector(`.tds__lieu[data-id="${id}"]`); }
function visible(id) { return lieu(id).style.display !== "none"; }
function couleur(id) { return lieu(id).getAttribute("data-couleur"); }
function choisir(id) { clic(racine.querySelector(`.tds__puce[data-id="${id}"]`)); }
function verdict() { const v = $("fiche").querySelector(".tds__verdict"); return v ? v.getAttribute("data-verdict") : null; }
function ligneX(classe) {
  const l = $("traits").querySelector(classe);
  return l ? parseFloat(l.getAttribute("x1")) : null;
}

console.log("MISE EN PLACE");
verifier("composant initialisé une seule fois", racine.dataset.pret === "1");
const lieux = racine.querySelectorAll(".tds__lieu[data-id]");
verifier("37 lieux sur la carte", lieux.length === 37, lieux.length);
verifier("un bouton par lieu dans la liste", racine.querySelectorAll(".tds__puce").length === lieux.length);
verifier("le résumé de la liste donne le compte", racine.querySelector(".tds__liste > summary").textContent.includes("(37)"));
verifier("sept graduations sous le curseur", racine.querySelectorAll(".tds__grad").length === 7);
verifier("graduations du siècle mises en valeur", racine.querySelectorAll(".tds__grad--majeure").length === 3);
verifier("légende remplie", $("legende").querySelectorAll(".tds__cle").length >= 6);
const ids = Array.from(document.querySelectorAll("[id]")).map((n) => n.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);

console.log("ÉTAPE 1 : AVANT LE TRAITÉ");
verifier("année de départ 1488", $("annee").textContent === "1488" && $("curseur").value === "1488");
verifier("titre de l'étape", $("recit").textContent.includes("Avant le traité"));
verifier("quatre lieux portugais visibles", ["ceuta", "arguin", "ribeira-grande", "mina"].every(visible));
verifier("Colomb pas encore là", !visible("colomb"));
verifier("aucune zone avant 1493", $("zones").childNodes.length === 0);
verifier("note « avant 1493 »", $("traits").textContent.includes("Avant 1493"));
verifier("étiquettes des lieux de l'étape", lieu("mina").classList.contains("est-vedette"));
verifier("événement du curseur : Dias", $("evenement").textContent.includes("Dias"));

console.log("ÉTAPE 2 : LA BULLE");
clic(boutonTexte("Étape suivante"));
verifier("année 1493", $("annee").textContent === "1493");
verifier("ligne de 1493 à 38° ouest", ligneX(".tds__ligne--1493") === 432, ligneX(".tds__ligne--1493"));
verifier("pas encore de ligne de 1494", !$("traits").querySelector(".tds__ligne:not(.tds__ligne--1493)"));
verifier("zones séparées sur la bulle", $("zones").querySelector(".tds__zone--espagne").getAttribute("width") === "432");

console.log("ÉTAPE 3 : LE TRAITÉ");
clic(boutonTexte("Étape suivante"));
const x1494 = (-(46 + 37 / 60) + 110) * 6;
verifier("ligne de 1494 à 46° 37' ouest", Math.abs(ligneX(".tds__ligne:not(.tds__ligne--1493)") - x1494) < .06);
verifier("ancienne ligne encore montrée", !!$("traits").querySelector(".tds__ligne--1493"));
verifier("bande des positions proposées", !!$("traits").querySelector(".tds__bande"));
verifier("mesure des 370 lieues", $("traits").textContent.includes("370 lieues"));
verifier("Tordesillas en vedette", lieu("tordesillas").classList.contains("est-vedette"));

console.log("NAVIGATION");
clic(boutonTexte("Étape précédente"));
verifier("retour à l'étape 2", $("recit").textContent.includes("Étape 2 sur 10"));
annee(1560);
verifier("le curseur passe en exploration libre", $("recit").textContent.includes("Exploration libre"));
verifier("année affichée 1560", $("annee").textContent === "1560");
clic(boutonTexte("Étape suivante"));
verifier("suivante mène à la première étape après 1560", $("recit").textContent.includes("L'Afrique, côté portugais"));
annee(1560);
clic(boutonTexte("Étape précédente"));
verifier("précédente mène à la dernière étape avant 1560", $("recit").textContent.includes("L'Amérique espagnole"));

console.log("CHANGEMENTS DE MAINS");
annee(1600);
verifier("São Jorge da Mina portugais en 1600", couleur("mina") === "portugal");
annee(1640);
verifier("São Jorge da Mina néerlandais en 1640", couleur("mina") === "autre");
annee(1645);
verifier("Luanda néerlandaise en 1645", couleur("luanda") === "autre");
annee(1650);
verifier("Luanda portugaise en 1650", couleur("luanda") === "portugal");
annee(1560);
verifier("Rio français en 1560", couleur("rio") === "autre");
annee(1570);
verifier("Rio portugais en 1570", couleur("rio") === "portugal");
annee(1520);
verifier("Kilwa abandonnée en 1520", lieu("kilwa").classList.contains("est-vide"));
annee(1550);
verifier("Buenos Aires abandonnée en 1550", lieu("buenos-aires").classList.contains("est-vide"));
annee(1590);
verifier("Buenos Aires refondée en 1590", couleur("buenos-aires") === "espagne");
annee(1710);
verifier("Colonia espagnole en 1710", couleur("colonia") === "espagne");
annee(1720);
verifier("Colonia portugaise en 1720", couleur("colonia") === "portugal");

console.log("FICHES ET VERDICTS");
annee(1620);
choisir("belem");
verifier("Belém hors de sa zone", verdict() === "hors", verdict());
verifier("Belém en 1620 : union ibérique rappelée", $("fiche").textContent.includes("union ibérique"));
annee(1650);
verifier("Belém en 1650 : plus d'union ibérique", !$("fiche").textContent.includes("union ibérique"));
choisir("santo-domingo");
verifier("Santo Domingo respecte le partage", verdict() === "ok", verdict());
choisir("quebec");
verifier("Québec : royaume exclu", verdict() === "exclu", verdict());
annee(1520);
choisir("kilwa");
verifier("Kilwa abandonnée : verdict neutre", verdict() === "neutre", verdict());
choisir("ceuta");
verifier("Ceuta : cas particulier", $("fiche").textContent.includes("Cas particulier"));
annee(1488);
choisir("ceuta");
verifier("avant 1493 : pas de verdict de zone", $("fiche").textContent.includes("Avant 1493"));
choisir("cabral");
verifier("un lieu pas encore là fait avancer le temps", $("annee").textContent === "1500", $("annee").textContent);
verifier("le lieu choisi est mis en évidence", lieu("cabral").classList.contains("est-choisi"));
verifier("la puce du lieu est enfoncée", racine.querySelector('.tds__puce[data-id="cabral"]').getAttribute("aria-pressed") === "true");
clic(lieu("ribeira-grande"));
verifier("un clic sur la carte choisit le lieu", racine.querySelector('.tds__puce[data-id="ribeira-grande"]').getAttribute("aria-pressed") === "true");

console.log("MODES DE COULEUR");
annee(1620);
clic(racine.querySelector('.tds__mode[data-mode="traite"]'));
verifier("mode « respect du traité »", racine.getAttribute("data-mode") === "traite");
verifier("Belém en orange", couleur("belem") === "hors", couleur("belem"));
verifier("Santo Domingo conforme", couleur("santo-domingo") === "ok");
verifier("Québec exclu", couleur("quebec") === "exclu");
verifier("légende du mode", $("legende").textContent.includes("Hors de sa zone"));
clic(racine.querySelector('.tds__mode[data-mode="langues"]'));
verifier("mode « langues »", racine.getAttribute("data-mode") === "langues");
verifier("ligne de 1494 montrée avec les langues", !!$("traits").querySelector(".tds__ligne"));
verifier("légende des langues", $("legende").textContent.includes("Portugais"));
clic(racine.querySelector('.tds__mode[data-mode="royaumes"]'));
verifier("retour aux royaumes", racine.getAttribute("data-mode") === "royaumes" && couleur("belem") === "portugal");

console.log("FIN DU RÉCIT");
for (let i = 0; i < 12; i++) { const b = boutonTexte("Étape suivante"); if (b) clic(b); }
verifier("dernière étape : Aujourd'hui", $("annee").textContent === "Aujourd'hui");
verifier("les langues s'affichent", racine.getAttribute("data-mode") === "langues");
verifier("bouton pour recommencer", !!boutonTexte("Recommencer le récit"));
clic(boutonTexte("Étape précédente"));
verifier("l'étape 9 rend les couleurs des royaumes", racine.getAttribute("data-mode") === "royaumes");
verifier("1750 : ligne abandonnée", !!$("traits").querySelector(".tds__ligne--abolie"));
clic(boutonTexte("Étape suivante"));
clic(boutonTexte("Recommencer le récit"));
verifier("retour à l'étape 1", $("annee").textContent === "1488");

console.log("ONGLETS DE LECTURE");
clic(boutonTexte("Étape suivante"));
verifier("le récit est l'onglet ouvert", ongletActif() === "recit" && !$("recit").hidden && $("fiche").hidden);
verifier("la navigation du récit est sous les onglets", $("pilote").textContent.includes("Étape 2 / 10"));
choisir("arguin");
verifier("choisir un lieu ouvre l'onglet du lieu", ongletActif() === "lieu" && $("recit").hidden && !$("fiche").hidden);
verifier("l'onglet porte le nom du lieu", onglet("lieu").textContent === "Arguin", onglet("lieu").textContent);
verifier("on peut changer d'étape depuis la fiche", !!boutonTexte("Étape suivante"));
clic(boutonTexte("Étape suivante"));
verifier("changer d'étape revient au récit", ongletActif() === "recit");
clic(onglet("lieu"));
verifier("un clic sur l'onglet du lieu le rouvre", ongletActif() === "lieu" && $("fiche").textContent.includes("Arguin"));
let flecheVue = false;
const espion = () => { flecheVue = true; };
document.addEventListener("keydown", espion);
onglet("lieu").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
verifier("la flèche change d'onglet", ongletActif() === "recit");
verifier("la flèche ne fait pas défiler le diaporama", flecheVue === false);
document.removeEventListener("keydown", espion);
annee(1560);
verifier("hors récit, la navigation le dit", $("pilote").textContent.includes("Hors récit"));
verifier("un seul onglet ouvert à la fois", racine.querySelectorAll('.tds__onglet[aria-selected="true"]').length === 1);

console.log("CLAVIER ET PAGE");
let vu = false;
document.addEventListener("keydown", () => { vu = true; });
boutonTexte("Étape suivante").dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
verifier("Espace sur un bouton ne remonte pas au diaporama", vu === false);
document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
verifier("Espace ailleurs remonte normalement", vu === true);

console.log("DONNÉES");
const source = composant;
verifier("aucun tiret cadratin ni demi-cadratin", !/[–—]/.test(source));
verifier("aucun titre de niveau 2 ou 3", !/<h[23][ >]/.test(source));
verifier("aucune liste à puces", !/<[uo]l[ >]/.test(source));

console.log("LECTURE");
annee(1700);
clic($("jouer"));
verifier("la lecture démarre", $("jouer").getAttribute("aria-label") === "Mettre en pause");
setTimeout(() => {
  const a = parseInt($("annee").textContent, 10);
  verifier("le temps avance pendant la lecture", a > 1700, a);
  clic($("jouer"));
  verifier("la pause arrête la lecture", $("jouer").getAttribute("aria-label") === "Faire défiler les années");
  const fige = $("annee").textContent;
  setTimeout(() => {
    verifier("plus rien ne bouge après la pause", $("annee").textContent === fige);
    annee(1704);
    clic($("jouer"));
    setTimeout(() => {
      verifier("la lecture s'arrête sur l'année d'un événement", $("annee").textContent === "1705", $("annee").textContent);
      clic($("jouer"));
      console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est vert.");
      process.exit(echecs ? 1 : 0);
    }, 900);
  }, 300);
}, 600);
