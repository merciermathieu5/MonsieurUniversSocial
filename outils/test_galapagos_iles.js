/*
 * Test des Galápagos, île par île (fiche de géographie 13) dans un DOM simulé.
 *     node outils/test_galapagos_iles.js [composant.html]
 */
/* Partie commune des tests du lot : DOM simulé, page.js, outils. ID et PFX sont remplacés. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "galapagos-iles.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("galapagos-iles");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".gal__intertitre").textContent;
const api = racine.gal;
const etatDepart = () => JSON.stringify(api.etat()) + "|" + tous(".gal__couche, .gal__segment").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();
function pincer() {
  const carte = un(".gal__carte");
  const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
  const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
  const avant = un(".gal__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = undefined;
  const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
  toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
  toucher("touchend", []);
  window.requestAnimationFrame = raf;
  verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un(".gal__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un(".gal__svg").getAttribute("viewBox"));
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
  verifier("classes préfixées gal__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)gal/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
  verifier("sources citées", un(".gal__source").textContent.length > 80);
}
function fin() { console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme."); process.exit(echecs ? 1 : 0); }

const nbsp = (s) => s.replace(/[  ]/g, " ");
const vue = () => nbsp(un(".gal__vue").textContent);
console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("data-reinitialiser et bouton Réinitialiser de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".gal__entete .reinitialiser"));
verifier("dix îles, quatre habitées, réserve marine", tous(".gal__ile").length === 10 && tous(".gal__ile.est-habitee").length === 4 && un(".gal__reserve").getAttribute("d").length > 100);
verifier("accueil : liste des îles, Isabela en tête", /^Isabela/.test(nbsp(un(".gal__vue .gal__choisir").textContent)) && tous(".gal__vue .gal__choisir").length === 10);
verifier("noms des îles sur la carte", tous(".gal__etiquette--ile").length >= 6);
const depart = etatDepart();
console.log("ÎLES");
clic(un('.gal__ile[data-ile="espanola"]'));
verifier("Española : albatros", choix() === "ile:espanola" && /albatros/.test(vue()) && racine.classList.contains("avec-ile"));
clic(tous(".gal__vue .gal__retour").find((b) => /visite/.test(b.textContent)));
verifier("ses sites de visite : Punta Suárez", racine.getAttribute("data-theme") === "visites" && /Punta Suárez/.test(vue()));
clic(un('.gal__ile[data-ile="espanola"]'));
verifier("un second clic désélectionne", choix() === "");
clic(un('.gal__ile[data-ile="santa-cruz"]'));
verifier("Santa Cruz : Puerto Ayora, station Charles-Darwin", /Puerto Ayora/.test(vue()) && /Charles-Darwin/.test(vue()));
touche("Escape");
verifier("Échap désélectionne", choix() === "");
console.log("RÈGLES ET RÉSERVE");
clic(un('.gal__segment[data-theme="regles"]'));
verifier("les règles : 1959, 1978, 1998, 2001, 2022, 200 dollars", ["1959", "1978", "1998", "2001", "2022"].every((a) => vue().includes(a)) && /200 dollars/.test(vue()));
clic(un(".gal__reserve"));
verifier("la réserve marine : 40 milles, Hermandad", choix() === "reserve:reserve" && /40 milles/.test(vue()) && /Hermandad/.test(vue()));
clic(un(".gal__reserve"));
verifier("second clic sur la réserve : fermeture", choix() === "");
pincer();
console.log("RÉINITIALISATION");
clic(un(".gal__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());
const textes = [];
const lire = () => textes.push(un(".gal__lecture").textContent);
["especes", "visites", "regles"].forEach((t) => { api.theme(t); lire(); api.donnees.iles.forEach((i) => { api.choisir({ type: "ile", id: i.id }); lire(); api.choisir(null); }); });
api.choisir({ type: "reserve", id: "reserve" }); lire();
typographie(textes);
fin();
