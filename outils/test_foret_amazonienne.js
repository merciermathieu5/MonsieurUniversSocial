/*
 * Test de la carte de la forêt amazonienne (fiche de géographie 06) dans un DOM simulé.
 *     node outils/test_foret_amazonienne.js [composant.html]
 */
/* Partie commune des tests du lot : DOM simulé, page.js, outils. ID et PFX sont remplacés. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "foret-amazonienne.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("foret-amazonienne");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".fam__intertitre").textContent;
const api = racine.fam;
const etatDepart = () => JSON.stringify(api.etat()) + "|" + tous(".fam__couche, .fam__segment, .fam__volet").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();
function pincer() {
  const carte = un(".fam__carte");
  const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
  const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
  const avant = un(".fam__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = undefined;
  const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
  toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
  toucher("touchend", []);
  window.requestAnimationFrame = raf;
  verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un(".fam__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un(".fam__svg").getAttribute("viewBox"));
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
  verifier("classes préfixées fam__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)fam/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
  verifier("sources citées", un(".fam__source").textContent.length > 80);
}
function fin() { console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme."); process.exit(echecs ? 1 : 0); }


const nbsp = (s) => s.replace(/[  ]/g, " ");
const vue = () => nbsp(un(".fam__vue").textContent);
const volet = () => racine.getAttribute("data-volet");
console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("data-reinitialiser et bouton Réinitialiser de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".fam__entete .reinitialiser"));
verifier("quatre volets, le territoire au départ", tous(".fam__volet").length === 4 && volet() === "territoire" && un('.fam__volet[data-volet="territoire"]').getAttribute("aria-pressed") === "true");
verifier("neuf pays, forêt et détourage tracés", tous(".fam__pays").length === 9 && tous(".fam__part").length === 9 && un(".fam__foret").getAttribute("d").length > 5000 && un(".fam__clip").getAttribute("d") === un(".fam__foret").getAttribute("d"));
verifier("cours d'eau tracés, douze cibles cliquables", tous(".fam__fleuve").length > 60 && tous(".fam__cible").length === 12);
verifier("accueil : 6,6 millions de km², environ 37 %, quatre limites", /6,6 millions de km²/.test(vue()) && /environ 37 %/.test(vue()) && tous(".fam__vue .fam__choisir").length === 4);
verifier("les quatre repères numérotés sont sur la carte", tous(".fam__repere").length === 4);
verifier("la somme des parts de la forêt fait 100 %", Math.abs(Object.values(api.D.chiffres.pays).reduce((s, p) => s + p.part_foret, 0) - 100) < 0.6);
const depart = etatDepart();

console.log("TERRITOIRE");
clic(un('.fam__repere[data-limite="atlantique"] circle'));
verifier("le repère 4 ouvre l'Atlantique (320 km, 1 900 km)", choix() === "limite:atlantique" && /320 km/.test(vue()) && /1 900 km/.test(vue()));
tous(".fam__vue .fam__retour").find((b) => /suivante/.test(b.textContent)).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("limite suivante : les Andes", choix() === "limite:andes" && /limite des arbres/.test(vue()));
touche("Escape");
verifier("Échap revient à l'accueil", choix() === "");
clic(un('.fam__couche[data-couche="quebec"]'));
verifier("la couche du Québec s'affiche avec son étiquette", racine.classList.contains("avec-quebec") && un(".fam__quebec").getAttribute("d").length > 500 && tous(".fam__etiquette--qc").length === 1);
clic(un('.fam__couche[data-couche="villes"]'));
verifier("masquer les villes retire leurs noms", !racine.classList.contains("avec-villes") && !tous(".fam__etiquette--ville").length);

console.log("PAYS");
clic(un('.fam__volet[data-volet="pays"]'));
verifier("volet des pays : neuf pays classés, Brésil en tête (60,5 %)", volet() === "pays" && tous(".fam__vue .fam__choisir").length === 9 && /^Brésil60,5 %$/.test(nbsp(tous(".fam__vue .fam__choisir")[0].textContent)));
verifier("le Brésil est dans la classe la plus foncée", api.D.pays.find((p) => p.id === "BRA").part.getAttribute("data-c") === "5" && tous(".fam__cles--pays li").length === 5);
clic(un('.fam__pays[data-pays="PER"]'));
verifier("un clic sur le Pérou ouvre sa fiche (13,3 %, 68,0 %, Lima, Iquitos)", choix() === "pays:PER" && /13,3 %/.test(vue()) && /68,0 %/.test(vue()) && /Lima/.test(vue()) && /Iquitos/.test(vue()));
clic(un('.fam__segment[data-mesure="pays"]'));
verifier("autre mesure : la Guyane passe dans la classe la plus foncée, le choix reste", api.etat().mesure === "pays" && api.D.pays.find((p) => p.id === "GUF").part.getAttribute("data-c") === "5" && choix() === "pays:PER");
clic(un('.fam__pays[data-pays="PER"]'));
verifier("un second clic désélectionne ; la liste commence par la Guyane (99,8 %)", choix() === "" && /^Guyane99,8 %$/.test(nbsp(tous(".fam__vue .fam__choisir")[0].textContent)));
api.choisir({ type: "pays", id: "GUF" });
verifier("la Guyane est présentée comme une collectivité de la France", /collectivité de la France/.test(vue()) && /27 février 2007/.test(vue()));

console.log("COURS D'EAU");
clic(un('.fam__volet[data-volet="eaux"]'));
verifier("volet des cours d'eau : 209 000 m³/s, trois types, douze cours d'eau", volet() === "eaux" && choix() === "" && /209 000 m³\/s/.test(vue()) && tous(".fam__points li").length === 3 && tous(".fam__vue .fam__choisir").length === 12);
clic(un('.fam__cible[data-groupe="negro"]'));
verifier("un clic sur le Rio Negro ouvre sa fiche (eaux noires, 2 230 km)", choix() === "fleuve:negro" && /eaux noires/.test(vue()) && /2 230 km/.test(vue()) && racine.classList.contains("avec-fleuve"));
verifier("ses tronçons sont mis en évidence", tous(".fam__fleuve.est-choisi").length >= 1 && tous('.fam__fleuve.est-choisi[data-t="n"]').length >= 1);
api.choisir({ type: "fleuve", id: "jurua" });
verifier("le Juruá : 3 283 km, le plus sinueux", /3 283 km/.test(vue()) && /sinueux/.test(vue()));
clic(un('.fam__couche[data-couche="types"]'));
verifier("la couleur des eaux se désactive, la légende disparaît", !racine.classList.contains("avec-types"));
pincer();

console.log("BIODIVERSITÉ");
clic(un('.fam__volet[data-volet="vivant"]'));
verifier("volet de la biodiversité : coupe dessinée, cinq étages, neuf espèces", volet() === "vivant" && tous(".fam__coupe .fam__bande").length === 4 && tous(".fam__coupe .fam__eau-coupe").length === 1 && tous(".fam__coupe .fam__espece").length === 9 && tous(".fam__vue .fam__choisir").length === 14);
clic(un('.fam__espece[data-espece="pirarucu"] circle'));
verifier("un clic sur le pirarucu ouvre sa fiche (Arapaima gigas, Mamirauá)", choix() === "espece:pirarucu" && /Arapaima gigas/.test(vue()) && /Mamirauá/.test(vue()) && un('.fam__espece[data-espece="pirarucu"]').classList.contains("est-choisi"));
clic(un('.fam__bande[data-etage="emergents"]'));
verifier("un clic sur la bande des émergents ouvre l'étage (88,5 m)", choix() === "etage:emergents" && /88,5 m/.test(vue()) && tous(".fam__vue .fam__choisir").length === 2);
clic(un('.fam__etage-etiq[data-etage="riviere"] text'));
verifier("l'étiquette de la rivière ouvre son étage, avec quatre espèces", choix() === "etage:riviere" && tous(".fam__vue .fam__choisir").length === 4);

console.log("RÉINITIALISATION");
clic(un(".fam__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());

const textes = [];
const lire = () => textes.push(un(".fam__lecture").textContent, un(".fam__barre").textContent);
["territoire", "pays", "eaux", "vivant"].forEach((v) => { api.volet(v); lire(); });
api.volet("territoire"); api.textes.limites.forEach((l) => { api.choisir({ type: "limite", id: l.id }); lire(); });
api.volet("pays"); api.D.pays.forEach((p) => { api.choisir({ type: "pays", id: p.id }); lire(); }); api.mesure("pays"); lire(); api.mesure("foret");
api.volet("eaux"); api.textes.fleuves.forEach((f) => { api.choisir({ type: "fleuve", id: f.id }); lire(); });
api.volet("vivant"); api.textes.etages.forEach((e) => { api.choisir({ type: "etage", id: e.id }); lire(); }); api.textes.especes.forEach((e) => { api.choisir({ type: "espece", id: e.id }); lire(); });
textes.push(tous("svg text, svg title").map((t) => t.textContent).join(" | "));
api.volet("territoire");
typographie(textes);
fin();
