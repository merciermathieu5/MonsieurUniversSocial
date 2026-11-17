/*
 * Test de la carte des peuples autochtones de l'Amazonie (fiche de géographie 06) dans un DOM simulé.
 *     node outils/test_nations_amazonie.js [composant.html]
 */
/* Partie commune des tests du lot : DOM simulé, page.js, outils. ID et PFX sont remplacés. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "nations-amazonie.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("nations-amazonie");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".nam__intertitre").textContent;
const api = racine.nam;
const etatDepart = () => JSON.stringify(api.etat()) + "|" + tous(".nam__couche, .nam__segment, .nam__volet").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();
function pincer() {
  const carte = un(".nam__carte");
  const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
  const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
  const avant = un(".nam__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = undefined;
  const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
  toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
  toucher("touchend", []);
  window.requestAnimationFrame = raf;
  verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un(".nam__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un(".nam__svg").getAttribute("viewBox"));
}
function typographie(textes) {
  console.log("TYPOGRAPHIE ET STRUCTURE");
  const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
  const t = copie.textContent + textes.join(" ");
  verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
  verifier("aucune virgule devant « et »", !/, et /.test(t));
  verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t), (t.match(/.{20}[   ][;!?]/) || [])[0]);
  verifier("espace insécable devant les deux-points", !/ :/.test(t), (t.match(/.{20} :/) || [])[0]);
  const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
  verifier("aucun id en double", new Set(ids).size === ids.length);
  verifier("classes préfixées nam__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)nam/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
  verifier("sources citées", un(".nam__source").textContent.length > 80);
}
function fin() { console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme."); process.exit(echecs ? 1 : 0); }


const nbsp = (s) => s.replace(/[  ]/g, " ");
const vue = () => nbsp(un(".nam__vue").textContent);
const volet = () => racine.getAttribute("data-volet");
console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("data-reinitialiser et bouton Réinitialiser de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".nam__entete .reinitialiser"));
verifier("dix peuples sur la carte et dans la liste", tous(".nam__peuple").length === 10 && tous(".nam__vue .nam__choisir").length === 10 && volet() === "peuples");
verifier("terres indigènes du Brésil tracées (reconnues et en cours)", un(".nam__tis--rec").getAttribute("d").length > 10000 && un(".nam__tis--cours").getAttribute("d").length > 1000);
verifier("accueil : 501 terres reconnues, environ 23 % de la forêt brésilienne", /501 \(FUNAI, 2025\)/.test(vue()) && /environ 23 %/.test(vue()) && /114 indices/.test(vue()));
verifier("six familles de langues en légende, noms des peuples sur la carte", tous(".nam__cles--familles li").length === 6 && tous(".nam__etiquette--peuple").length >= 8);
const depart = etatDepart();

console.log("PEUPLES");
clic(un('.nam__peuple[data-peuple="yanomami"]'));
verifier("un clic sur les Yanomami ouvre leur fiche (9,66 millions d'hectares, 2023)", choix() === "peuple:yanomami" && /9,66 millions d'hectares/.test(vue()) && /janvier 2023/.test(vue()) && /27 152/.test(vue()));
verifier("leur terre est mise en évidence, les autres points s'estompent", un(".nam__ti-choisie").getAttribute("d").length > 200 && tous(".nam__peuple.est-estompe").length === 9);
clic(un('.nam__peuple[data-peuple="yanomami"]'));
verifier("un second clic désélectionne", choix() === "" && un(".nam__ti-choisie").getAttribute("d") === "");
clic(tous(".nam__vue .nam__choisir").find((b) => /Waorani/.test(b.textContent)));
verifier("depuis la liste : les Waorani, carte rapprochée, territoire non dessiné", choix() === "peuple:waorani" && /180 000 hectares/.test(vue()) && /n'est pas dessiné/.test(vue()) && un(".nam__carte").classList.contains("est-zoomee"));
tous(".nam__vue .nam__retour").find((b) => /suivant/.test(b.textContent)).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("peuple suivant : les Murui-Muina", choix() === "peuple:murui" && /Arana/.test(vue()));
touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(un('.nam__couche[data-couche="familles"]'));
verifier("la couche des familles se désactive", !racine.classList.contains("avec-familles") && un('.nam__couche[data-couche="familles"]').getAttribute("aria-pressed") === "false");
clic(un('.nam__couche[data-couche="tis"]'));
verifier("la couche des terres indigènes se désactive", !racine.classList.contains("avec-tis"));

console.log("DOSSIER DES URU-EU-WAU-WAU");
clic(un('.nam__peuple[data-peuple="uru"]'));
verifier("un clic sur le point des Uru-Eu-Wau-Wau ouvre le dossier et rapproche la carte", volet() === "uru" && /gardiens d'un territoire/.test(vue()) && Number(un(".nam__svg").getAttribute("viewBox").split(" ")[2]) < 150);
verifier("territoire, parc, routes et villes sont tracés", un(".nam__uru").getAttribute("d").length > 2000 && un(".nam__parc").getAttribute("d").length > 1000 && un(".nam__routes").getAttribute("d").length > 1000 && tous(".nam__ville-uru").length === 20);
verifier("onglet du territoire : 29 octobre 1991, 17 cours d'eau, parc à 99,9 %", /29 octobre 1991/.test(vue()) && /17 cours d'eau/.test(vue()) && /99,9 %/.test(vue()) && tous(".nam__onglet").length === 4);
clic(tous(".nam__onglet").find((b) => /chronologie/.test(b.textContent)));
verifier("onglet de la chronologie : dix dates, de 1979 à 2025 (27 janvier 2024, 8 septembre 2025)", racine.getAttribute("data-onglet") === "chrono" && tous(".nam__chrono li").length === 10 && /1979/.test(vue()) && /Le 27 janvier/.test(vue()) && /Le 8 septembre/.test(vue()));
clic(tous(".nam__onglet").find((b) => /peuples/.test(b.textContent)));
verifier("onglet des peuples : Jupaú, jenipapo, 127, quatre peuples et environ 500 personnes", /Jupaú/.test(vue()) && /jenipapo/.test(vue()) && /127/.test(vue()) && /Cabixi/.test(vue()) && /Oro Win/.test(vue()) && /environ 500/.test(vue()));
clic(tous(".nam__onglet").find((b) => /gardiens/.test(b.textContent)));
verifier("onglet des gardiens : drones depuis 2019, 8 camions en 14 mois", /depuis 2019/.test(vue()) && /8 camions en 14 mois/.test(vue()) && /Bitaté/.test(vue()));
clic(un('.nam__couche[data-couche="parc"]'));
verifier("la couche du parc se désactive", !racine.classList.contains("avec-parc"));
clic(tous(".nam__vue .nam__retour").find((b) => /dix peuples/.test(b.textContent)));
verifier("retour aux dix peuples : carte entière", volet() === "peuples" && un(".nam__svg").getAttribute("viewBox") === "0 0 1000 796.9");
pincer();

console.log("RÉINITIALISATION");
clic(un(".nam__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());

const textes = [];
const lire = () => textes.push(un(".nam__lecture").textContent, un(".nam__barre").textContent);
lire();
api.textes.peuples.forEach((p) => { if (!p.dossier) { api.choisir({ type: "peuple", id: p.id }); lire(); api.choisir(null); } });
api.volet("uru"); ["territoire", "peuples", "chrono", "gardiens"].forEach((o) => { api.onglet(o); lire(); });
textes.push(tous("svg text, svg title").map((t) => t.textContent).join(" | "));
api.volet("peuples");
typographie(textes);
fin();
