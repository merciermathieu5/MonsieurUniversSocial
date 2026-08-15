/*
 * Test des fonctions de l'interface admin de l'actualité, dans un DOM simulé.
 *     node outils/test_admin_actualite.js
 *
 * Les deux preuves centrales : la réécriture du registre doit être identique
 * octet pour octet à ce qu'écrit outils/articles.py (dès que le fichier est
 * au format en sections), et la liste HTML régénérée depuis le registre doit
 * être identique octet pour octet à celle que publier() a posée dans le
 * composant et dans docs/actualite.html.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const pageAdmin = fs.readFileSync(path.join(RACINE, "theme", "admin-actualite.html"), "utf8");
const registre = fs.readFileSync(path.join(RACINE, "contenu", "articles.yml"), "utf8");
const lexique = fs.readFileSync(path.join(RACINE, "outils", "lexique_actualite.yml"), "utf8");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "actualite.html"), "utf8");
const pageConstruite = fs.readFileSync(path.join(RACINE, "docs", "actualite.html"), "utf8");

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { runScripts: "outside-only" });
const { window } = dom;
window.eval(pageAdmin.match(/<script>([\s\S]*)<\/script>/)[1]);
const A = window.AdminActualite;

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}

console.log("LECTURE DU REGISTRE");
const lu = A.analyserRegistre(registre);
verifier("aucune ligne incomprise", lu.restes.length === 0,
  lu.restes.slice(0, 2).join(" ; "));
const attendu = (registre.match(/^  - adresse: /gm) || []).length;
verifier("toutes les entrées sont lues", lu.articles.length === attendu,
  lu.articles.length + " sur " + attendu);
verifier("les champs d'une entrée sont là", (function () {
  const a = lu.articles[0];
  return "adresse" in a && "fiche" in a && "media" in a && "date" in a
    && "titre" in a && "garder" in a && "note" in a;
})());

console.log("ALLER-RETOUR DU REGISTRE");
const reecrit = A.serialiserRegistre(lu.entete, lu.articles);
if (/# ----------------/.test(registre)) {
  verifier("la réécriture redonne le fichier octet pour octet",
    reecrit === registre);
} else {
  console.log("    (le registre n'est pas encore au format en sections : "
    + "l'identité à l'octet sera exigée dès le premier passage d'articles.py)");
}
const relu = A.analyserRegistre(reecrit);
const trier = liste => liste.slice().sort((x, y) => x.adresse < y.adresse ? -1 : 1);
verifier("aucune donnée ne se perd à la réécriture",
  JSON.stringify(trier(relu.articles)) === JSON.stringify(trier(lu.articles)));
verifier("les sections sont posées dans l'ordre attendu", (function () {
  const bandeaux = [...reecrit.matchAll(/# ---------------- (.*?) ----/g)].map(m => m[1]);
  return bandeaux.join("|").match(/^(À JUGER\|?)?(PUBLIÉS \(O\)\|?)?(REFUSÉS \(N\))?$/) !== null;
})());

console.log("STATUTS");
verifier("O, oui, Oui donnent publié",
  ["O", "oui", "Oui "].every(v => A.statutDe(v) === "o"));
verifier("N et non donnent refusé",
  ["N", "non"].every(v => A.statutDe(v) === "n"));
verifier("vide donne à juger", A.statutDe("") === "attente" && A.statutDe(null) === "attente");
verifier("le chiffre 0 est signalé illisible", A.statutDe("0") === "douteux");

console.log("COUPER LE TITRE");
verifier("« Section | Titre » se sépare",
  JSON.stringify(A.couperTitre("Feux | La forêt brûle")) === JSON.stringify(["Feux", "La forêt brûle"]));
verifier("un chapeau trop long reste dans le titre", (function () {
  const long = "x".repeat(61) + " | Reste";
  return JSON.stringify(A.couperTitre(long)) === JSON.stringify(["", long.trim()]);
})());
verifier("sans barre, tout est titre",
  JSON.stringify(A.couperTitre("Simple titre")) === JSON.stringify(["", "Simple titre"]));

console.log("LISTE HTML DE LA PAGE ACTUALITÉ");
const noms = A.analyserNoms(lexique);
verifier("les onze territoires ont leur nom", Object.keys(noms).length === 11,
  Object.keys(noms).length);
verifier("le nom entre guillemets est déquoté",
  noms["13"] === "Le territoire protégé : le parc naturel", noms["13"]);
const lignes = A.serialiserListe(lu.articles, noms);
const blocAttendu = composant.match(/<ul data-matiere="geographie">([\s\S]*?)<\/ul>/)[1];
const lignesAttendues = blocAttendu.split("\n").filter(l => l.trim().startsWith("<li"));
verifier("autant de lignes que la liste publiée",
  lignes.length === lignesAttendues.length,
  lignes.length + " contre " + lignesAttendues.length);
verifier("la liste régénérée est identique octet pour octet au composant",
  lignes.join("\n") === lignesAttendues.join("\n"), (function () {
    for (let i = 0; i < Math.min(lignes.length, lignesAttendues.length); i++) {
      if (lignes[i] !== lignesAttendues[i]) return "première différence ligne " + (i + 1);
    }
    return "longueurs différentes";
  })());
const blocDocs = pageConstruite.match(/<ul data-matiere="geographie">([\s\S]*?)<\/ul>/)[1];
verifier("docs/actualite.html porte la même liste", blocDocs === blocAttendu);
const remplace = A.remplacerListe(composant, lignes);
verifier("le remplacement laisse le fichier identique", remplace === composant);

console.log("ÉCHAPPEMENT À LA PYTHON");
verifier("html.escape est reproduit, guillemets et apostrophes compris",
  A.echapper("a&b <c> \"d\" l'e") === "a&amp;b &lt;c&gt; &quot;d&quot; l&#x27;e");
verifier("citer et déciter font l'aller-retour",
  A.deciter(A.citer('Une "citation" et un \\ arrière')) === 'Une "citation" et un \\ arrière');

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
