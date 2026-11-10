/*
 * Test de la carte des failles de San Francisco (fiche de géographie 04) dans un DOM simulé.
 *     node outils/test_sf_failles.js [composant.html]
 */
/* Partie commune des tests du lot : DOM simulé, page.js, outils. ID et PFX sont remplacés. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "sf-failles.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("sf-failles");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".sff__intertitre").textContent;
const api = racine.sff;
const etatDepart = () => JSON.stringify(api.etat()) + "|" + tous(".sff__couche, .sff__segment").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();
function pincer() {
  const carte = un(".sff__carte");
  const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
  const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
  const avant = un(".sff__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = undefined;
  const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
  toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
  toucher("touchend", []);
  window.requestAnimationFrame = raf;
  verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un(".sff__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un(".sff__svg").getAttribute("viewBox"));
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
  verifier("classes préfixées sff__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)sff/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
  verifier("sources citées", un(".sff__source").textContent.length > 80);
}
function fin() { console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme."); process.exit(echecs ? 1 : 0); }

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("data-reinitialiser et bouton Réinitialiser de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".sff__entete .reinitialiser"));
verifier("cinq failles principales cliquables", tous(".sff__faille-groupe").length === 5);
verifier("autres failles et sols liquéfiables dessinés", un(".sff__mineures").getAttribute("d").length > 500 && un(".sff__liq").getAttribute("d").length > 1000);
verifier("au départ : aucun séisme, fiche d'accueil avec 72 %", choix() === "" && racine.getAttribute("data-seisme") === "aucun" && /72 %/.test(un(".sff__vue").textContent) && tous(".sff__vue .sff__choisir").length === 5);
verifier("villes et noms des failles affichés", tous(".sff__lieu").length === 7 && tous(".sff__etiquette--faille").length >= 3 && tous(".sff__etiquette--lieu").some((t) => t.textContent === "San Francisco"));
const depart = etatDepart();

console.log("FAILLES");
clic(un('.sff__faille-groupe[data-faille="hayward"] .sff__faille-prise'));
verifier("un clic sur la faille de Hayward ouvre sa fiche (33 %, 1868)", choix() === "faille:hayward" && /33 %/.test(un(".sff__vue").textContent) && /1868/.test(un(".sff__vue").textContent));
verifier("la faille choisie est mise en valeur", un('.sff__faille-groupe[data-faille="hayward"]').classList.contains("est-choisi") && racine.classList.contains("avec-choix"));
clic(un('.sff__faille-groupe[data-faille="hayward"] .sff__faille-prise'));
verifier("un second clic désélectionne", choix() === "" && !racine.classList.contains("avec-choix"));
clic(tous(".sff__vue .sff__choisir")[0]);
verifier("la liste de l'accueil ouvre la faille la plus probable (Hayward)", choix() === "faille:hayward");
touche("Escape");
verifier("Échap désélectionne", choix() === "");

console.log("SÉISMES");
clic(un('.sff__segment[data-seisme="1906"]'));
verifier("1906 : zones d'intensité VI à IX, rupture et épicentre", racine.getAttribute("data-seisme") === "1906" && tous(".sff__bande").length === 4 && !!un(".sff__rupture") && !!un(".sff__epi"));
verifier("1906 : fiche du séisme avec magnitude et témoins", /7,8 à 7,9/.test(un(".sff__vue").textContent) && tous(".sff__temoin").length === 2);
clic(un('.sff__bande[data-n="8"]'));
verifier("un clic sur une zone ouvre l'intensité VIII", choix() === "niveau:8" && /destructrice/.test(titre()));
clic(un('.sff__segment[data-seisme="1989"]'));
verifier("passer à 1989 ferme la fiche d'intensité", choix() === "" && racine.getAttribute("data-seisme") === "1989" && tous(".sff__bande").length === 3);
clic(un('.sff__temoin[data-temoin="marina"]'));
verifier("le quartier Marina : liquéfaction, intensité IX", choix() === "temoin:marina" && /liquéfi/.test(un(".sff__vue").textContent) && /IX/.test(un(".sff__vue").textContent));
clic(un('.sff__temoin[data-temoin="marina"]'));
verifier("second clic sur Marina : retour à la fiche du séisme", choix() === "" && /Loma Prieta/.test(titre()));
clic(un(".sff__liq"));
verifier("un clic sur un sol liquéfiable ouvre sa fiche", choix() === "liq:liq" && /liquéfier/.test(titre()));
clic(un('.sff__lieu[data-lieu="oakland"]'));
verifier("Oakland : sa fiche renvoie au viaduc Cypress", choix() === "lieu:oakland" && tous(".sff__vue .sff__choisir").some((b) => /Cypress/.test(b.textContent)));

console.log("COUCHES ET ZOOM");
clic(un('.sff__couche[data-couche="villes"]'));
verifier("masquer les villes ferme la fiche de la ville", choix() === "" && tous(".sff__lieu").length === 0);
clic(un('.sff__couche[data-couche="failles"]'));
verifier("masquer les failles", un(".sff__failles").style.display === "none");
pincer();

console.log("RÉINITIALISATION");
clic(un(".sff__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());

const textes = [];
const lire = () => textes.push(un(".sff__lecture").textContent);
lire();
api.donnees.failles.forEach((f) => { api.choisir({ type: "faille", id: f.id }); lire(); api.choisir(null); });
["1906", "1989"].forEach((s) => { api.seisme(s); lire(); [6, 7, 8, 9].forEach((n) => { api.choisir({ type: "niveau", id: String(n) }); lire(); api.choisir(null); }); api.donnees.temoins.filter((t) => t.s === s).forEach((t) => { api.choisir({ type: "temoin", id: t.id }); lire(); api.choisir(null); }); });
api.seisme("aucun");
api.donnees.lieux.forEach((l) => { api.choisir({ type: "lieu", id: l.id }); lire(); api.choisir(null); });
api.choisir({ type: "liq", id: "liq" }); lire(); api.choisir(null);
typographie(textes);
fin();
