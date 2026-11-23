/*
 * Test du portrait énergétique du Québec (fiche de géographie 07) dans un DOM simulé.
 *     node outils/test_energie_portrait.js [composant.html]
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "energie-portrait.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("energie-portrait");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const somme = (sel) => tous(sel).reduce((t, b) => t + parseFloat(b.getAttribute("data-pct")), 0);
const presses = () => tous('[aria-pressed="true"]').map((b) => b.getAttribute("data-cle")).join();
const detail = un(".epq__detail");

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1");
verifier("quatre tuiles de chiffres clés", tous(".epq__tuiles > li").length === 4);
verifier("trois blocs : production, consommation, secteurs", tous(".epq__bloc").length === 3);
verifier("production : quatre sources qui totalisent 100 %", tous('[data-bloc="production"] .epq__seg').length === 4 && Math.abs(somme('[data-bloc="production"] .epq__seg') - 100) < 0.01);
verifier("consommation : cinq formes qui totalisent 100 %", tous('[data-bloc="consommation"] .epq__seg').length === 5 && Math.abs(somme('[data-bloc="consommation"] .epq__seg') - 100) < 0.01);
verifier("renouvelable 48 % + fossile 52 %", somme('[data-bloc="consommation"] .epq__seg:nth-child(-n+2)') === 48 && somme('[data-bloc="consommation"] .epq__seg:nth-child(n+3)') === 52);
verifier("chaque segment a une largeur proportionnelle à sa part", tous(".epq__seg").every((b) => Number(b.style.flexGrow) === Number(b.getAttribute("data-pct"))));
verifier("quatre secteurs", tous(".epq__secteur").length === 4);
verifier("chaque barre a un nom lisible au survol", tous(".epq__seg, .epq__secteur").every((b) => b.title.length > 3));
verifier("au départ, rien n'est choisi", presses() === "" && detail.classList.contains("est-vide"));
verifier("boutons Réinitialiser et Plein écran ajoutés par page.js", !!un(".epq__entete .reinitialiser") && !!un(".epq__entete .plein-ecran"));

console.log("EXPLICATIONS");
const toutes = tous(".epq__seg, .epq__secteur");
verifier("chaque barre a son explication", toutes.every((b) => { clic(b); const ok = !detail.classList.contains("est-vide") && detail.textContent.length > 40; clic(b); return ok; }));
clic(un('[data-cle="petrole"]'));
verifier("toucher le pétrole l'explique", presses() === "petrole" && /importer|vient entièrement/.test(detail.textContent) && /dépendance énergétique/.test(detail.textContent));
clic(un('[data-cle="transports"]'));
verifier("un seul choix à la fois", presses() === "transports" && /Les transports, 31 %/.test(detail.textContent));
clic(un('[data-cle="transports"]'));
verifier("retoucher la même barre efface le choix", presses() === "" && detail.classList.contains("est-vide"));
clic(un('[data-cle="eau"]'));
racine.dispatchEvent(new window.CustomEvent("reinitialiser"));
verifier("Réinitialiser revient à l'état de départ", presses() === "" && detail.classList.contains("est-vide"));

console.log("TEXTE");
const texte = racine.textContent;
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(composant));
verifier("pas de ligature œ", !/[œŒ]/.test(composant));
verifier("chaque chiffre clé porte son année", tous(".epq__tuiles > li").every((li) => /20\d\d/.test(li.querySelector(".epq__annee").textContent)));
verifier("sources citées", /Régie de l'énergie du Canada/.test(texte) && /Portrait énergétique/.test(texte));

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
