/*
 * Test du composant actualité de la page publique, dans un DOM simulé.
 *     node outils/test_actualite.js
 *
 * La page construite est chargée telle quelle, puis le script du composant
 * est rejoué : les cartes, les trois filtres (territoire, média, recherche)
 * et les pastilles de média colorées doivent se comporter comme en classe.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RACINE, "docs", "actualite.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// Rejouer le script embarqué de la section actualité.
const section = html.slice(html.indexOf('id="actualite"'));
const script = section.match(/<script>([\s\S]*?)<\/script>/)[1];
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
function changer(sel, valeur) {
  const el = document.querySelector(sel);
  el.value = valeur;
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}

const NB_SOURCE = (html.match(/<li data-fiche=/g) || []).length;
const grille = document.getElementById("act-grille");
const cartes = () => grille.querySelectorAll(".act__carte").length;

console.log("DÉPART");
verifier("toutes les cartes sont dessinées", cartes() === NB_SOURCE,
  cartes() + " sur " + NB_SOURCE);
verifier("la liste source est masquée",
  document.getElementById("act-source").hidden === true);

console.log("MENU DES MÉDIAS");
const menuMedia = document.getElementById("act-media");
const medias = [...new Set([...document.querySelectorAll("#act-source li")]
  .map(li => li.dataset.source).filter(Boolean))];
verifier("une option par média, plus Tous",
  menuMedia.options.length === medias.length + 1,
  menuMedia.options.length + " options pour " + medias.length + " médias");
verifier("les options sont en ordre alphabétique", (function () {
  const noms = [...menuMedia.options].slice(1).map(o => o.value);
  const triees = noms.slice().sort((a, b) => a.localeCompare(b, "fr"));
  return JSON.stringify(noms) === JSON.stringify(triees);
})());

console.log("FILTRE PAR MÉDIA");
const cible = medias[0];
const attendu = [...document.querySelectorAll("#act-source li")]
  .filter(li => li.dataset.source === cible).length;
changer("#act-media", cible);
verifier("seules les cartes du média choisi restent",
  cartes() === attendu, cartes() + " sur " + attendu);
verifier("le compte suit le filtre",
  document.getElementById("act-compte").textContent.indexOf(String(attendu)) === 0);
changer("#act-media", "tout");
verifier("Tous ramène toutes les cartes", cartes() === NB_SOURCE);

console.log("CUMUL DES FILTRES");
const territoire = document.querySelector("#act-territoire option:nth-child(2)").value;
changer("#act-territoire", territoire);
changer("#act-media", cible);
const cumul = [...document.querySelectorAll("#act-source li")]
  .filter(li => li.dataset.fiche === territoire && li.dataset.source === cible).length;
verifier("territoire et média se cumulent", cartes() === cumul,
  cartes() + " sur " + cumul);
changer("#act-territoire", "tout");
changer("#act-media", "tout");

console.log("PASTILLES COLORÉES");
verifier("chaque carte porte la classe de couleur de son média", (function () {
  const pastilles = [...grille.querySelectorAll(".act__source")];
  return pastilles.length === NB_SOURCE && pastilles.every(p =>
    [...p.classList].some(c => c.indexOf("act__source--") === 0));
})());
verifier("les trois médias actuels ont chacun leur classe stylée", (function () {
  const styles = html.match(/<style>[\s\S]*?<\/style>/g).join("");
  const classes = [...new Set([...grille.querySelectorAll(".act__source")]
    .flatMap(p => [...p.classList].filter(c => c.indexOf("act__source--") === 0)))];
  return classes.length >= 3 && classes.every(c => styles.indexOf("." + c) >= 0);
})());
verifier("un média inconnu retombe sur la pastille de base", (function () {
  // La classe de base porte le fond neutre : un média sans classe dédiée
  // reste lisible au lieu de perdre sa pastille.
  const styles = html.match(/<style>[\s\S]*?<\/style>/g).join("");
  return /\.act__source \{[^}]*background/.test(styles);
})());

console.log("RECHERCHE TOUJOURS VIVANTE");
const recherche = document.getElementById("act-recherche");
recherche.value = "zzz-introuvable";
recherche.dispatchEvent(new window.Event("input", { bubbles: true }));
verifier("une recherche sans réponse vide la grille et le dit",
  cartes() === 0 && document.getElementById("act-vide").hidden === false);
recherche.value = "";
recherche.dispatchEvent(new window.Event("input", { bubbles: true }));
verifier("tout revient quand la recherche s'efface", cartes() === NB_SOURCE);

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
