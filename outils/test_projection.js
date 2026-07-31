/*
 * Test du mode projection dans un DOM simulé.
 *
 *     node outils/test_projection.js
 *
 * Vérifie ce qu'un contrôle statique ne peut pas voir : est-ce que la
 * découpe en panneaux fonctionne, est-ce qu'un seul panneau est visible à la
 * fois, et surtout est-ce que la sortie remet vraiment la page dans son état
 * normal. C'est ce dernier point qui a laissé passer la barre de commande
 * flottant par-dessus la page après avoir quitté.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const PAGE = path.join(RACINE, "docs", "histoire", "01-sedentarisation.html");
const SCRIPT = path.join(RACINE, "theme", "projection.js");

let echecs = 0;
function verifier(intitule, condition, detail) {
  if (condition) {
    console.log(`    ok      ${intitule}`);
  } else {
    console.log(`    ECHEC   ${intitule}${detail ? "  (" + detail + ")" : ""}`);
    echecs++;
  }
}

const html = fs.readFileSync(PAGE, "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// jsdom ne gère pas le plein écran, on neutralise sans rien masquer d'autre.
document.documentElement.requestFullscreen = () => Promise.resolve();
document.exitFullscreen = () => Promise.resolve();

window.eval(fs.readFileSync(SCRIPT, "utf8"));

const corps = document.body;
const racine = document.documentElement;

console.log("AVANT PROJECTION");
const declencheur = document.querySelector(".declencheur:not(.declencheur--secondaire)");
verifier("le bouton Projeter est injecté", !!declencheur);
verifier("le bouton Mode classe est injecté", !!document.querySelector(".declencheur--secondaire"));
verifier("aucune scène tant qu'on n'a pas démarré", !document.querySelector(".scene"));
verifier("aucune barre de commande au repos", !document.querySelector(".pilote"));

console.log("\nPENDANT LA PROJECTION");
declencheur.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

const panneaux = document.querySelectorAll(".panneau");
verifier("la scène existe", !!document.querySelector(".scene"));
verifier("les panneaux sont créés", panneaux.length > 1, `${panneaux.length} panneaux`);
verifier("data-projection posé sur body", corps.dataset.projection === "on");
verifier("data-projection posé sur html", racine.dataset.projection === "on");

const visibles = document.querySelectorAll(".panneau.est-visible");
verifier("un seul panneau visible", visibles.length === 1, `${visibles.length} visibles`);

const barre = document.querySelector(".pilote");
verifier("la barre de commande existe", !!barre);
verifier("le compteur est renseigné",
  /^\d+ \/ \d+$/.test(document.querySelector(".pilote__position").textContent.trim()),
  document.querySelector(".pilote__position").textContent);

// Chaque panneau doit contenir du texte, sinon on projette du vide.
let vides = 0;
panneaux.forEach(p => {
  if (p.querySelector(".panneau__corps").textContent.trim().length < 20) vides++;
});
verifier("aucun panneau vide", vides === 0, `${vides} panneaux vides`);

// Navigation.
const suivant = barre.querySelector('[data-action="suivant"]');
suivant.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("la flèche suivante avance",
  document.querySelector(".pilote__position").textContent.trim().startsWith("2"));
verifier("toujours un seul panneau visible",
  document.querySelectorAll(".panneau.est-visible").length === 1);

console.log("\nBASCULE DU THÈME");
const boutonSombre = barre.querySelector('[data-action="sombre"]');
verifier("le bouton de thème existe", !!boutonSombre);
verifier("le thème clair est le défaut", racine.dataset.sombre === undefined,
  `data-sombre=${racine.dataset.sombre}`);
if (boutonSombre) {
  boutonSombre.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  verifier("le sombre s'active sur html", racine.dataset.sombre === "on");
  verifier("le libellé devient Clair", boutonSombre.textContent.trim() === "Clair");
  boutonSombre.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  verifier("on revient au clair", racine.dataset.sombre === undefined);
}

console.log("\nAPRÈS LA SORTIE");
barre.querySelector('[data-action="quitter"]')
     .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("data-projection retiré de body", corps.dataset.projection === undefined,
  `body=${corps.dataset.projection}`);
verifier("data-projection retiré de html", racine.dataset.projection === undefined,
  `html=${racine.dataset.projection}`);
verifier("data-sombre retiré", racine.dataset.sombre === undefined);
verifier("plus aucun panneau visible",
  document.querySelectorAll(".panneau.est-visible").length === 0,
  `${document.querySelectorAll(".panneau.est-visible").length} restants`);

// Le point qui a échoué en vrai : la barre doit disparaître, pas seulement
// perdre son attribut parent. On contrôle la règle CSS qui la gouverne.
const css = fs.readFileSync(path.join(RACINE, "docs", "style.css"), "utf8");
const regleAffichage = /body\[data-projection="on"\] \.pilote \{[^}]*display:\s*flex/.test(css);
const regleRepos = /\.scene, \.pilote \{\s*display:\s*none/.test(css);
verifier("la barre est masquée au repos par le CSS", regleRepos);
verifier("la barre n'apparaît qu'en projection", regleAffichage);

console.log(`\n${echecs} échec(s).`);
process.exit(echecs ? 1 : 0);
