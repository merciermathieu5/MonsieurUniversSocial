/*
 * Test des fonctions de lecture et d'écriture de l'interface admin des
 * ressources, dans un DOM simulé.
 *     node outils/test_admin.js
 *
 * Le test le plus important est l'aller-retour : lire le bloc res-source
 * du composant réel puis le réécrire doit redonner l'original octet pour
 * octet. C'est le même garde-fou que la page vivante applique au chargement
 * avant de permettre la moindre modification.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const pageAdmin = fs.readFileSync(
  path.join(RACINE, "theme", "admin-ressources.html"), "utf8");
const composant = fs.readFileSync(
  path.join(RACINE, "theme", "composants", "ressources.html"), "utf8");
const pageConstruite = fs.readFileSync(
  path.join(RACINE, "docs", "ressources.html"), "utf8");

// On charge la page admin sans son interface : un document vide suffit, le
// script n'active la partie vivante que si l'écran du jeton existe.
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>",
  { runScripts: "outside-only" });
const { window } = dom;
const script = pageAdmin.match(/<script>([\s\S]*)<\/script>/)[1];
window.eval(script);
const A = window.AdminRessources;

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}

console.log("LECTURE");
const bornes = A.bornesBloc(composant);
verifier("le bloc res-source est repéré dans le composant", !!bornes);
const bloc = composant.slice(bornes.debut, bornes.fin);
const groupes = A.analyserBloc(bloc);
verifier("deux groupes, histoire puis géographie",
  groupes.length === 2 && groupes[0].matiere === "histoire"
  && groupes[1].matiere === "geographie");
verifier("les entêtes affichées sont conservées",
  groupes[0].entete === "Histoire" && groupes[1].entete === "Géographie");
const total = groupes[0].entrees.length + groupes[1].entrees.length;
verifier("toutes les entrées sont lues",
  total === (bloc.match(/<li /g) || []).length, total);
const premiere = groupes[0].entrees[0];
verifier("une entrée porte ses six champs",
  premiere.fiche && premiere.type && premiere.note !== undefined
  && premiere.titre && premiere.adresse && premiere.matiere === "histoire");

console.log("ALLER-RETOUR");
verifier("réécrire le bloc du composant redonne l'original",
  A.serialiserBloc(groupes) === bloc);
const bornesPage = A.bornesBloc(pageConstruite);
const blocPage = pageConstruite.slice(bornesPage.debut, bornesPage.fin);
verifier("le bloc de docs/ressources.html est identique à celui du composant",
  blocPage === bloc);
verifier("réécrire le bloc de la page construite redonne l'original",
  A.serialiserBloc(A.analyserBloc(blocPage)) === blocPage);

console.log("CATALOGUE");
const fiches = A.analyserFiches(composant);
verifier("les fiches d'histoire sont cataloguées",
  Object.keys(fiches.histoire).length === 12, Object.keys(fiches.histoire).length);
verifier("les fiches de géographie sont cataloguées",
  Object.keys(fiches.geographie).length === 11, Object.keys(fiches.geographie).length);
verifier("une fiche donne son adresse",
  fiches.histoire["04"] && fiches.histoire["04"].adresse === "histoire/04-romanisation.html");

console.log("INSERTION");
const entrees = groupes[0].entrees;
const nouvelle = { matiere: "histoire", fiche: "03", type: "Kahoot",
  note: "Essai", titre: "Essai", adresse: "https://exemple.org/" };
const position = A.positionInsertion(entrees, nouvelle);
verifier("une nouvelle entrée se range après celles de sa fiche",
  entrees[position - 1].fiche === "03"
  && (position === entrees.length || parseInt(entrees[position].fiche, 10) > 3));
const enTete = { matiere: "histoire", fiche: "00", type: "Kahoot",
  note: "", titre: "Essai", adresse: "https://exemple.org/" };
verifier("une fiche plus petite que toutes se range en tête",
  A.positionInsertion(entrees, enTete) === 0);
const enQueue = { matiere: "histoire", fiche: "99", type: "Kahoot",
  note: "", titre: "Essai", adresse: "https://exemple.org/" };
verifier("une fiche plus grande que toutes se range en queue",
  A.positionInsertion(entrees, enQueue) === entrees.length);

console.log("ÉCHAPPEMENT");
const piegee = [{ matiere: "histoire", entete: "Histoire", entrees: [{
  matiere: "histoire", fiche: "01", type: 'Cahier "spécial" & rare',
  note: "a < b & c > d", titre: "Titre & retour",
  adresse: "https://exemple.org/?a=1&b=2" }] }];
const serialise = A.serialiserBloc(piegee);
verifier("les guillemets et esperluettes sont échappés dans les attributs",
  serialise.indexOf('data-type="Cahier &quot;spécial&quot; &amp; rare"') >= 0);
verifier("l'esperluette de l'adresse est échappée",
  serialise.indexOf('href="https://exemple.org/?a=1&amp;b=2"') >= 0);
const relue = A.analyserBloc(serialise)[0].entrees[0];
verifier("l'aller-retour restitue les caractères d'origine",
  relue.type === 'Cahier "spécial" & rare' && relue.note === "a < b & c > d"
  && relue.adresse === "https://exemple.org/?a=1&b=2");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
