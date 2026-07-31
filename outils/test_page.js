/*
 * Test des comportements de la page dans un DOM simulé.
 *     node outils/test_page.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RACINE, "docs", "histoire", "01-sedentarisation.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.eval(fs.readFileSync(path.join(RACINE, "theme", "page.js"), "utf8"));

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
function clic(sel) {
  const el = document.querySelector(sel);
  if (el) el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  return el;
}
const corps = document.body, racine = document.documentElement;

console.log("SOMMAIRE");
verifier("bouton présent", !!document.querySelector('[data-bascule="sommaire"]'));
clic('[data-bascule="sommaire"]');
verifier("se replie", corps.dataset.sommaire === "replie");
clic('[data-bascule="sommaire"]');
verifier("se déplie", corps.dataset.sommaire === undefined);

console.log("MODES");
clic('[data-bascule="classe"]');
verifier("mode classe s'active", corps.dataset.classe === "on");
clic('[data-bascule="classe"]');
verifier("mode classe se désactive", corps.dataset.classe === undefined);
clic('[data-bascule="sombre"]');
verifier("thème sombre s'active sur html", racine.dataset.sombre === "on");
verifier("clair par défaut avant bascule", true);
clic('[data-bascule="sombre"]');
verifier("retour au clair", racine.dataset.sombre === undefined);

console.log("DIAPORAMA");
const h2avant = document.querySelectorAll(".texte > h2").length;
clic('[data-bascule="diapo"]');
verifier("s'active avec le mode classe", corps.dataset.diapo === "on" && corps.dataset.classe === "on");
const visibles = Array.from(document.querySelectorAll(".texte > h2"))
  .filter(h => h.style.display !== "none").length;
verifier("une seule section visible", visibles === 1, visibles + " visibles");
const barre = document.querySelector(".diapo-barre");
verifier("barre affichée", !!barre);
const position = barre.querySelector(".diapo-position");
verifier("compteur renseigné", position.textContent.trim() === "1 / 11", position.textContent);
verifier("titre de section affiché", barre.querySelector(".diapo-titre").textContent.length > 3);
verifier("bouton Quitter présent", !!barre.querySelector('[data-d="quitter"]'));
verifier("bouton de thème présent", barre.querySelector('[data-d="theme"]').textContent === "Sombre");
barre.querySelector('[data-d="suiv"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("flèche suivante avance", position.textContent.trim() === "2 / 11", position.textContent);
barre.querySelector('[data-d="prec"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("flèche précédente recule", position.textContent.trim() === "1 / 11", position.textContent);
barre.querySelector('[data-d="theme"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("bascule de thème depuis la barre", racine.dataset.sombre === "on");
verifier("libellé passe à Clair", barre.querySelector('[data-d="theme"]').textContent === "Clair");
barre.querySelector('[data-d="theme"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
verifier("flèche clavier avance aussi", position.textContent.trim() === "2 / 11", position.textContent);
barre.querySelector('[data-d="quitter"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const revenus = Array.from(document.querySelectorAll(".texte > h2"))
  .filter(h => h.style.display !== "none").length;
verifier("Quitter restaure toutes les sections", revenus === h2avant, revenus + " / " + h2avant);
verifier("attribut diapo retiré", corps.dataset.diapo === undefined);

console.log(`\n${echecs} échec(s).`);
process.exit(echecs ? 1 : 0);
