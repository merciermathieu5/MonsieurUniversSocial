/*
 * Test du carrousel des fonctions de l'écriture dans un DOM simulé.
 *     node outils/test_carrousel.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RACINE, "docs", "histoire",
  "02-emergence-civilisation.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// Le script du composant est inséré dans la page : on le rejoue tel quel.
const racine = document.getElementById("fonctions-ecriture");
window.eval(racine.querySelector("script").textContent);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
function clic(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

console.log("CARROUSEL");
const fiches = racine.querySelectorAll(".fnc__fiche");
verifier("six documents construits", fiches.length === 6, fiches.length);
verifier("le premier est visible", fiches[0].classList.contains("est-visible"));
verifier("le compteur affiche 1 / 6",
  racine.querySelector(".fnc__compteur").textContent === "1 / 6");

clic(racine.querySelector('[data-fnc="suiv"]'));
verifier("Suivant avance au deuxième", fiches[1].classList.contains("est-visible"));
verifier("le premier se cache", !fiches[0].classList.contains("est-visible"));

clic(racine.querySelector('[data-fnc="prec"]'));
clic(racine.querySelector('[data-fnc="prec"]'));
verifier("Précédent boucle vers le sixième", fiches[5].classList.contains("est-visible"));

const points = racine.querySelectorAll(".fnc__point");
verifier("six pastilles", points.length === 6);
clic(points[2]);
verifier("une pastille mène au bon document", fiches[2].classList.contains("est-visible"));
verifier("la pastille active est marquée", points[2].classList.contains("est-actif"));

racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
verifier("flèche droite avance", fiches[3].classList.contains("est-visible"));

const reveler = fiches[3].querySelector(".fnc__reveler");
const reponse = fiches[3].querySelector(".fnc__reponse");
verifier("la fonction est cachée au départ", !reponse.classList.contains("est-visible"));
clic(reveler);
verifier("le bouton révèle la fonction", reponse.classList.contains("est-visible"));
verifier("aria-expanded passe à true", reveler.getAttribute("aria-expanded") === "true");
verifier("l\'étiquette nomme la fonction",
  reponse.querySelector(".fnc__etiquette").textContent.indexOf("politique") !== -1);

console.log(`\n${echecs} échec(s).`);
process.exit(echecs ? 1 : 0);
