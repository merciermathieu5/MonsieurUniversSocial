/*
 * Test des fonctions de la console du texte des fiches, dans un DOM simulé.
 *     node outils/test_admin_fiches.js
 *
 * La preuve centrale : pour CHACUNE des fiches du dépôt, le découpage en
 * morceaux verrouillés et éditables doit se réassembler octet pour octet.
 * C'est le même contrôle que la console applique avant d'ouvrir une fiche.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const pageAdmin = fs.readFileSync(path.join(RACINE, "theme", "admin-fiches.html"), "utf8");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { runScripts: "outside-only" });
dom.window.eval(pageAdmin.match(/<script>([\s\S]*)<\/script>/)[1]);
const A = dom.window.AdminFiches;

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}

console.log("ALLER-RETOUR SUR TOUTES LES FICHES");
const fiches = ["histoire", "geographie"].flatMap(section =>
  fs.readdirSync(path.join(RACINE, "contenu", section))
    .filter(n => n.endsWith(".md"))
    .map(n => path.join("contenu", section, n)));
let intactes = 0;
let premierEchec = "";
for (const fiche of fiches) {
  const texte = fs.readFileSync(path.join(RACINE, fiche), "utf8");
  if (A.assembler(A.decouper(texte)) === texte) intactes++;
  else if (!premierEchec) premierEchec = fiche;
}
verifier(`les ${fiches.length} fiches se réassemblent à l'octet`,
  intactes === fiches.length, premierEchec);

console.log("CLASSEMENT DES LIGNES");
verifier("les marqueurs de bloc sont verrouillés",
  [":::", "::: questions", "::: video Y0ZqYwf1aj4"].every(A.estStructurelle));
verifier("images, titres, séparateurs, tableaux, HTML sont verrouillés",
  ["![Une carte](../medias/x.png)", "## Mise en contexte", "---", "| a | b |",
   "<figure>"].every(A.estStructurelle));
verifier("la prose, les listes et les questions restent libres",
  ["Une ville soumise à des risques naturels.", "- **Aménagement** : tout.",
   "1. Un volcan endormi représente-t-il un risque?", "   naturel? Justifie.",
   "**Gras** en début de ligne."].every(l => !A.estStructurelle(l)));

console.log("DÉCOUPAGE D'UNE FICHE RÉELLE");
const texte04 = fs.readFileSync(
  path.join(RACINE, "contenu", "geographie", "04-ville-risques-naturels.md"), "utf8");
const morceaux = A.decouper(texte04);
verifier("le front matter est enfermé dans le premier verrou",
  morceaux[0].type === "verrou" && morceaux[0].contenu.startsWith("---\n")
  && morceaux[0].contenu.indexOf("\n---") > 0
  && morceaux[0].contenu.indexOf("statut:") > 0);
verifier("verrous et textes alternent sans se toucher", (function () {
  for (let i = 1; i < morceaux.length; i++) {
    if (morceaux[i].type === morceaux[i - 1].type) return false;
  }
  return true;
})());
const textes = morceaux.filter(m => m.type === "texte");
verifier("des passages éditables existent en nombre", textes.length > 20, textes.length);
verifier("aucun passage éditable ne contient de structure",
  textes.every(m => m.contenu.split("\n").every(l => !A.estStructurelle(l))));

console.log("VALIDATION DES RETOUCHES");
verifier("une retouche de prose passe",
  A.validerTexte("Une phrase corrigée, avec du **gras** et l'apostrophe.") === "");
verifier("glisser un marqueur de bloc est refusé",
  A.validerTexte("Du texte\n::: questions") !== "");
verifier("glisser une image est refusé", A.validerTexte("![oups](x.png)") !== "");
verifier("glisser un titre est refusé", A.validerTexte("## Nouveau titre") !== "");
verifier("un retour Windows est refusé", A.validerTexte("ligne\r\nsuivante") !== "");

console.log("FRONT MATTER");
verifier("le titre se lit, guillemets déquotés",
  A.champFrontMatter(texte04, "titre") === "La ville soumise à des risques naturels");
verifier("le statut se lit", A.champFrontMatter(texte04, "statut") === "brouillon");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
