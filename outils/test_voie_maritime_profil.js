/*
 * Test de le profil de la voie maritime du Saint-Laurent (fiche de géographie 09) dans un DOM simulé.
 *     node outils/test_voie_maritime_profil.js [composant.html]
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "voie-maritime-profil.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("voie-maritime-profil");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const api = racine.vmp;
const textes = [];
const lire = () => textes.push(un(".vmp__lecture").textContent);
console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".vmp__entete .reinitialiser") && un(".vmp__entete .reinitialiser").nextElementSibling === un(".vmp__entete .plein-ecran"));
verifier("au départ : aucun choix", choix() === "");
lire();
const depart = JSON.stringify(api.etat());

console.log("DONNÉES");
const E = api.ecluses(), N = api.niveaux();
verifier("15 écluses, dont 2 américaines", E.length === 15 && E.filter((e) => e.pays === "us").length === 2 && tous(".vmp__ecluse").length === 15);
verifier("Montréal 6,1 m, lac Ontario 75,0 m après Iroquois", Math.abs(N[0] - 6.1) < 1e-6 && Math.abs(N[7] - 75) < .01, N[7]);
verifier("lac Érié vers 174 m", Math.abs(N[15] - 174.3) < .6, N[15]);
verifier("le canal Welland monte d'environ 99 m", Math.abs(N[15] - N[7] - 99.3) < .6);
console.log("CHOIX ET DÉSÉLECTION");
clic(un('.vmp__ecluse[data-ecluse="snell"] .vmp__prise'));
verifier("un clic sur Snell ouvre sa fiche", choix() === "ecl:snell" && /13,7/.test(un(".vmp__vue").textContent) && /États-Unis/.test(un(".vmp__vue").textContent)); lire();
clic(un('.vmp__ecluse[data-ecluse="snell"] .vmp__prise'));
verifier("un second clic désélectionne", choix() === "");
clic(tous(".vmp__vue .vmp__retour").find((b) => /navire/.test(b.textContent)));
verifier("faire monter un navire : écluse de Saint-Lambert", choix() === "ecl:saint-lambert" && api.etat().navire === 1);
for (let i = 0; i < 14; i++) { clic(un(".vmp__vue .vmp__principal")); lire(); }
verifier("de proche en proche jusqu'à l'écluse 8 du canal Welland", choix() === "ecl:w8" && api.etat().navire === 15 && un(".vmp__vue .vmp__principal").disabled);
touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(un('[data-section="ontario"] .vmp__prise'));
verifier("le lac Ontario a sa fiche (75,0 m)", choix() === "sec:ontario" && /75,0/.test(un(".vmp__vue").textContent)); lire();
api.choisir({ type: "ind", id: "moses-saunders" }); lire();
verifier("fiche du barrage Moses-Saunders (énergie)", /Énergie/.test(un(".vmp__vue").textContent));
console.log("VUES");
clic(un('.vmp__couche[data-vue="plan"]'));
verifier("la carte remplace le profil", un(".vmp__plan").getAttribute("hidden") === null && un(".vmp__profil").getAttribute("hidden") === "" && tous(".vmp__pt").length === 15);
clic(un('.vmp__couche[data-couche="industries"]'));
verifier("masquer les industries ferme leur fiche", !racine.classList.contains("avec-industries") && choix() === "");

console.log("RÉINITIALISATION");
clic(un(".vmp__replier"));
clic(un(".vmp__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", JSON.stringify(api.etat()) === depart, JSON.stringify(api.etat()));
verifier("Réinitialiser garde le texte masqué", racine.classList.contains("texte-masque"));

console.log("TYPOGRAPHIE ET STRUCTURE");
lire();
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
const t = copie.textContent + textes.join(" ") + Array.from(racine.querySelectorAll("svg text")).map((n) => n.textContent).join(" ");
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées vmp__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)vmp/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
verifier("sources citées", /Voie maritime/.test(un(".vmp__source").textContent));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
