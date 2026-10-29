/*
 * Test de la carte de l'évolution du territoire romain dans un DOM simulé.
 *     node outils/test_rome_territoire.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "rome-territoire.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>L'Empire romain</h2>
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
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const racine = document.getElementById("rome-territoire");
const q = (s) => racine.querySelector(s);
const tous = (s, base) => Array.from((base || racine).querySelectorAll(s));
const clic = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (el, key) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const visible = (el) => !el.hidden && !el.closest("[hidden]");
const texteVisible = (el) => el.textContent.replace(/[ \t\n\r]+/g, " ").trim();
const d = (s) => q(s).getAttribute("d") || "";
const etape = () => Number(racine.getAttribute("data-etape"));
const curseur = q(".rom__curseur");
function glisser(v) { curseur.value = String(v); curseur.dispatchEvent(new window.Event("input", { bubbles: true })); }

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("une seule graduation par étape après deux passages", tous(".rom__grad").length === 8, tous(".rom__grad").length);
verifier("étiquettes non doublées", tous(".rom__etiquettes text").filter((t) => t.textContent === "Rome").length === 1);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre h2 ou h3 dans le composant", tous("h2, h3").length === 0);
verifier("titre en role=heading niveau 3", q(".rom__titre").getAttribute("role") === "heading" && q(".rom__titre").getAttribute("aria-level") === "3");
verifier("en-tête en __entete avec bouton Plein écran ajouté par page.js", !!q(".rom__entete .plein-ecran"));
verifier("carte avec role img et titre", q(".rom__svg").getAttribute("role") === "img" && !!document.getElementById(q(".rom__svg").getAttribute("aria-labelledby")));
verifier("résumé annoncé (aria-live)", q(".rom__resume").getAttribute("aria-live") === "polite");
verifier("curseur nommé", curseur.getAttribute("aria-label") === "Date");
verifier("note de simplification visible", /Carte simplifiée/.test(q(".rom__source").textContent) && /ODbL/.test(q(".rom__source").textContent));

console.log("DÉPART");
verifier("étape 1 au départ", etape() === 0);
verifier("territoire de -509 tracé", d(".rom__couches .rom__zone--rome").length > 10);
verifier("Précédente désactivée", q(".rom__precedente").disabled);
verifier("aria-valuetext", /-509 : Une petite cité/.test(curseur.getAttribute("aria-valuetext")), curseur.getAttribute("aria-valuetext"));

console.log("ÉTAPES");
const attendu = [-509, -264, -133, -44, 14, 117, 395, 476];
let prec = "";
for (let i = 0; i < 8; i++) {
  verifier(`étape ${i + 1} : année ${attendu[i]}`, q(".rom__annee").textContent === String(attendu[i]) && curseur.value === String(attendu[i]));
  verifier(`étape ${i + 1} : textes remplis`, q(".rom__intertitre").textContent.length > 5 && q(".rom__change").textContent.length > 40 && q(".rom__pourquoi").textContent.length > 40);
  verifier(`étape ${i + 1} : une seule graduation courante`, tous(".rom__grad.est-courante").length === 1 && tous(".rom__grad")[i].classList.contains("est-courante"));
  const trace = d(".rom__couches .rom__zone--rome") + d(".rom__couches .rom__zone--orient");
  verifier(`étape ${i + 1} : tracé différent de l'étape précédente`, trace.length > 10 && trace !== prec);
  prec = trace;
  if (i < 7) clic(q(".rom__suivante"));
}
verifier("476 : Occident en royaumes, Orient seul", d(".rom__couches .rom__zone--rome") === "" && d(".rom__couches .rom__royaumes").length > 10 && d(".rom__couches .rom__zone--orient").length > 10);
verifier("476 : légende royaumes visible, territoire romain cachée", visible(q('[data-cle="royaumes"]')) && !visible(q('[data-cle="rome"]')));
verifier("476 : noms des royaumes", tous(".rom__etiquette--royaume").map((t) => t.textContent).includes("Wisigoths"));
verifier("476 : rubrique Ce qui continue", q(".rom__rubrique--pourquoi").textContent === "Ce qui continue");
verifier("dernière étape : Recommencer", q(".rom__suivante").textContent === "Recommencer");
clic(q(".rom__suivante"));
verifier("Recommencer revient à -509", etape() === 0);

console.log("CURSEUR");
glisser(100);
verifier("glisser vers 100 aimante 117", etape() === 5 && curseur.value === "117");
glisser(-60);
verifier("glisser vers -60 aimante -44", etape() === 3);
touche(curseur, "ArrowRight");
verifier("flèche droite : étape suivante", etape() === 4);
touche(curseur, "End");
verifier("Fin : dernière étape", etape() === 7);
touche(curseur, "Home");
verifier("Début : première étape", etape() === 0);
clic(tous(".rom__grad")[6]);
verifier("clic sur une graduation", etape() === 6);
verifier("395 : légende Occident", /Occident/.test(q('[data-cle="rome"]').textContent) && visible(q('[data-cle="orient"]')));
verifier("395 : Occident et Orient tracés, pertes affichées", d(".rom__couches .rom__zone--rome").length > 10 && d(".rom__couches .rom__zone--orient").length > 10 && visible(q('[data-cle="perte"]')));

console.log("LECTURE");
glisser(-509);
clic(q(".rom__jouer"));
verifier("lecture : bouton pause", /pause/.test(q(".rom__jouer").getAttribute("aria-label")));
clic(q(".rom__jouer"));
verifier("pause : bouton lecture", /Lancer/.test(q(".rom__jouer").getAttribute("aria-label")));

console.log("PLEIN ÉCRAN ET TEXTE");
const bouton = q(".plein-ecran");
clic(bouton);
verifier("le bouton Plein écran passe l'interface en plein écran", racine.classList.contains("est-plein-ecran") && bouton.getAttribute("aria-pressed") === "true");
const rep = q(".rom__replier");
clic(rep);
verifier("texte replié", racine.classList.contains("texte-masque") && rep.getAttribute("aria-expanded") === "false" && rep.textContent === "Afficher le texte");
clic(rep);
verifier("texte réaffiché", !racine.classList.contains("texte-masque") && rep.textContent === "Masquer le texte");
clic(bouton);
verifier("second clic : sortie du plein écran", !racine.classList.contains("est-plein-ecran"));

console.log("TYPOGRAPHIE");
const textes = [];
for (let i = 0; i < 8; i++) { touche(curseur, i === 0 ? "Home" : "ArrowRight"); textes.push(texteVisible(q(".rom__vue")), texteVisible(q(".rom__resume"))); }
textes.push(texteVisible(q(".rom__source")), texteVisible(q(".rom__entete")), texteVisible(q(".rom__legende")));
const tout = textes.join(" ");
verifier("pas de tiret long ou moyen", !/[–—]/.test(tout));
verifier("pas de « , et »", !/, et /.test(tout));
verifier("espace insécable avant les deux-points", !/[^ ]:/.test(tout.replace(/https?:/g, "")), (tout.match(/.{12}[^ ]:/) || [""])[0]);
verifier("guillemets avec insécables", !/«[^ ]/.test(tout) && !/[^ ]»/.test(tout));
verifier("pas d'espace avant ; ! ?", !/[   ][;!?]/.test(tout));

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est correct.");
process.exit(echecs ? 1 : 0);
