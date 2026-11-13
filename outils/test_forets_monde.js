/*
 * Test de la carte des grands types de forêts du monde (fiche de géographie 06) dans un DOM simulé.
 *     node outils/test_forets_monde.js [composant.html]
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "forets-monde.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("forets-monde");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const bouton = (t) => un(`.fdm__choix[data-type="${t}"]`);
const visibles = () => tous(".fdm__foret:not(.est-masque)").map((p) => p.getAttribute("data-type")).sort((a, b) => a - b).join();
const fiches = () => tous(".fdm__type:not([hidden])").map((li) => li.getAttribute("data-type")).sort((a, b) => a - b).join();
const TOUS = "1,2,3,4,5,6,12,14";

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("huit interrupteurs, un par type de forêt", tous(".fdm__choix").length === 8);
verifier("huit tracés sur la carte, plus la terre ferme", tous(".fdm__foret").length === 8 && !!un(".fdm__terre"));
verifier("chaque tracé a sa géométrie et son nom", tous(".fdm__foret").every((p) => p.getAttribute("d").length > 1000 && p.querySelector("title").textContent.length > 5));
verifier("huit descriptions", tous(".fdm__type").length === 8);
verifier("au départ, tous les types sont affichés", visibles() === TOUS && fiches() === TOUS && tous('.fdm__choix[aria-pressed="true"]').length === 8);
verifier("le message « aucun type » est caché", un(".fdm__vide").hidden === true);
verifier("bouton Plein écran ajouté par page.js", !!un(".fdm__entete .plein-ecran"));

console.log("UN TYPE, PLUSIEURS TYPES, TOUS LES TYPES");
clic(un('[data-action="rien"]'));
verifier("Tout masquer : aucun type", visibles() === "" && fiches() === "" && un(".fdm__vide").hidden === false);
clic(bouton("6"));
verifier("activer la forêt boréale seule", visibles() === "6" && fiches() === "6" && bouton("6").getAttribute("aria-pressed") === "true");
clic(bouton("1"));
verifier("ajouter la forêt tropicale humide", visibles() === "1,6" && fiches() === "1,6");
clic(bouton("6"));
verifier("retirer la forêt boréale", visibles() === "1" && bouton("6").getAttribute("aria-pressed") === "false");
verifier("un type masqué prend la couleur de la terre", un('.fdm__foret[data-type="6"]').classList.contains("est-masque"));
clic(un('[data-action="tout"]'));
verifier("Tout afficher : les huit types", visibles() === TOUS && fiches() === TOUS && un(".fdm__vide").hidden === true);

console.log("INFOBULLE");
const p1 = un('.fdm__foret[data-type="1"]');
p1.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 40 }));
verifier("survoler un tracé affiche son nom", un(".fdm__infobulle").hidden === false && un(".fdm__infobulle").textContent === "Forêt tropicale humide");
clic(bouton("1"));
p1.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 40 }));
verifier("un type masqué n'a pas d'infobulle", un(".fdm__infobulle").hidden === true);
clic(bouton("1"));

console.log("TYPOGRAPHIE ET STRUCTURE");
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
const t = copie.textContent;
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[  ][;!?]/.test(t), (t.match(/.{20}[  ][;!?]/) || [])[0]);
verifier("espace insécable devant les deux-points", !/ :/.test(t), (t.match(/.{20} :/) || [])[0]);
const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées fdm__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)fdm/.test(c) || /plein-ecran|reinitialiser|entete-actions/.test(c); }));
verifier("source des données citée avec sa licence", /RESOLVE/.test(un(".fdm__source").textContent) && /CC BY 4\.0/.test(un(".fdm__source").textContent));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
