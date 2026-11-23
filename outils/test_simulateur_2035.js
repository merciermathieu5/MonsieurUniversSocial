/*
 * Test du simulateur des besoins en puissance de 2035 (fiche de géographie 07) dans un DOM simulé.
 *     node outils/test_simulateur_2035.js [composant.html]
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "simulateur-2035.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("simulateur-2035");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
function regler(cle, v) { const c = un(`#s35-${cle}`); c.value = String(v); c.dispatchEvent(new window.Event("input", { bubbles: true })); }
const total = () => Number(racine.getAttribute("data-total"));
const verdict = () => un(".s35__verdict").textContent;

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && tous(".s35__moyen").length === 5);
verifier("cinq curseurs, chacun avec son étiquette", tous('input[type="range"]').length === 5 && tous('input[type="range"]').every((i) => !!un(`label[for="${i.id}"]`)));
verifier("chaque moyen dit ce qu'il demande au territoire", tous(".s35__territoire").every((p) => p.textContent.length > 60));
verifier("au départ, le plan est vide", total() === 0 && /vide/.test(verdict()));
verifier("la zone cible va de 8 000 à 9 000 MW sur 12 000", un(".s35__zone").style.left.startsWith("66.66") && un(".s35__zone").style.width.startsWith("8.33"));
verifier("le plan d'Hydro-Québec est caché au départ", un(".s35__plan").hidden && un(".s35__bilan").hidden);
verifier("boutons Réinitialiser et Plein écran ajoutés par page.js", !!un(".s35__entete .reinitialiser") && !!un(".s35__entete .plein-ecran"));

console.log("CALCUL");
regler("eau", 4000);
verifier("hydroélectricité seule : 4 000 MW, il en manque 4 000", total() === 4000 && /manque 4 000 MW/.test(verdict()));
verifier("la carte d'un moyen utilisé est mise en évidence", un('[data-moyen="eau"]').classList.contains("est-actif") && !un('[data-moyen="vent"]').classList.contains("est-actif"));
regler("vent", 10000);
verifier("10 000 MW d'éoliennes ne comptent que pour 1 600 MW", total() === 5600 && /10 000 MW installés, dont 1 600 MW/.test(un('[data-moyen="vent"] .s35__compte').textContent));
regler("econ", 1700); regler("soleil", 750); regler("gaz", 500);
verifier("le plan médian d'Hydro-Québec donne 8 550 MW et atteint la cible", total() === 8550 && /atteint la cible/.test(verdict()) && un(".s35__verdict").classList.contains("est-atteint"));
regler("eau", 6000); regler("econ", 3000);
verifier("au-delà de 9 000 MW, le verdict signale le dépassement", total() === 11850 && /dépasse la cible de 2 850 MW/.test(verdict()));
verifier("la centrale au gaz plafonne à 600 MW", un("#s35-gaz").max === "600");
regler("vent", 15000);
const largeur = tous(".s35__pile--eleve .s35__morceau").reduce((t, m) => t + parseFloat(m.style.width), 0);
verifier("la jauge ne déborde jamais de façon absurde", largeur <= 125, largeur);

console.log("COMPARAISON ET RÉINITIALISATION");
clic(un(".s35__comparer"));
verifier("Comparer affiche le plan et un bilan", !un(".s35__plan").hidden && !un(".s35__bilan").hidden && /hydroélectricité/.test(un(".s35__bilan").textContent) && un(".s35__comparer").getAttribute("aria-expanded") === "true");
const plan = tous(".s35__pile--plan .s35__morceau").reduce((t, m) => t + parseFloat(m.style.width), 0);
verifier("la barre du plan d'Hydro-Québec vaut 8 550 MW", Math.abs(plan - 8550 / 120) < 0.01, plan);
verifier("le bilan nomme le moyen dominant de l'élève", /repose surtout sur : hydroélectricité, avec 6 000 MW/.test(un(".s35__bilan").textContent));
regler("eau", 0);
verifier("le bilan suit les changements", /repose surtout sur : économies d'énergie/.test(un(".s35__bilan").textContent));
racine.dispatchEvent(new window.CustomEvent("reinitialiser"));
verifier("Réinitialiser remet tout à zéro et cache le plan", total() === 0 && un(".s35__plan").hidden && tous('input[type="range"]').every((i) => i.value === "0"));

console.log("TEXTE");
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(composant));
verifier("pas de ligature œ", !/[œŒ]/.test(composant));
verifier("source citée", /Plan d'action 2035, novembre 2023/.test(racine.textContent));

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
