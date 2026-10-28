/*
 * Test de la maquette de Babylone dans un DOM simulé.
 *     node outils/test_babylone.js
 *
 * Le DOM simulé n'a pas de WebGL : on vérifie donc le mode de secours, les
 * boutons, les panneaux, la visite guidée, les textes et la construction de la
 * ville (géométrie générée sans carte graphique).
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "babylone-maquette.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Babylone : Hammourabi et son code de lois</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = () => null;
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
// Un second passage du script ne doit rien doubler.
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const racine = document.getElementById("babylone-maquette");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const panneauxVisibles = () => tous(".bab__panneau.est-visible").map((p) => p.getAttribute("data-partie"));
const boutonsPresses = () => tous('.bab__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-partie"));

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("sans WebGL : mode de secours", racine.classList.contains("sans-3d") && !racine.querySelector(".bab__secours").hidden);
verifier("le message de secours est rempli", racine.querySelector(".bab__secours-texte").textContent.length > 40);
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("aucun lieu choisi au départ", boutonsPresses().length === 0);
const boutons = tous(".bab__bouton");
verifier("15 lieux à choisir", boutons.length === 15, boutons.length);
verifier("un panneau par bouton, relié par aria-controls",
  boutons.every((b) => { const p = document.getElementById(b.getAttribute("aria-controls")); return p && p.getAttribute("data-partie") === b.getAttribute("data-partie"); }));
verifier("16 panneaux (accueil compris)", tous(".bab__panneau").length === 16, tous(".bab__panneau").length);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune balise figure", tous("figure").length === 0);
verifier("la toile a un nom accessible", (racine.querySelector(".bab__toile").getAttribute("aria-label") || "").length > 60);
verifier("les étiquettes de la maquette sont cachées aux lecteurs d'écran", racine.querySelector(".bab__reperes").getAttribute("aria-hidden") === "true");
verifier("tous les boutons ont type=button", tous("button").every((b) => b.getAttribute("type") === "button"));

console.log("CHOIX D'UN LIEU");
clic(racine.querySelector('.bab__bouton[data-partie="ishtar"]'));
verifier("le panneau de la porte d'Ishtar s'affiche seul", panneauxVisibles().join() === "ishtar", panneauxVisibles().join());
verifier("son bouton est enfoncé, lui seul", boutonsPresses().join() === "ishtar", boutonsPresses().join());
verifier("le choix est noté sur le composant", racine.getAttribute("data-choix") === "ishtar");
clic(racine.querySelector('.bab__bouton[data-partie="maisons"]'));
verifier("un autre lieu remplace le premier", panneauxVisibles().join() === "maisons" && boutonsPresses().join() === "maisons");

console.log("CE QU'ON SAIT VRAIMENT");
const certitude = racine.querySelector('[data-action="certitude"]');
clic(certitude);
verifier("le bouton s'enfonce et la légende paraît", certitude.getAttribute("aria-pressed") === "true" && !racine.querySelector(".bab__legende").hidden);
clic(certitude);
verifier("un second clic remet tout comme avant", certitude.getAttribute("aria-pressed") === "false" && racine.querySelector(".bab__legende").hidden);

console.log("VISITE GUIDÉE");
const etapes = tous(".bab__etape-donnees");
verifier("dix étapes", etapes.length === 10, etapes.length);
verifier("chaque étape vise une partie qui existe", etapes.every((e) => e.getAttribute("data-partie") === "accueil" || racine.querySelector('.bab__bouton[data-partie="' + e.getAttribute("data-partie") + '"]')));
verifier("chaque étape a une vue de six nombres", etapes.every((e) => (e.getAttribute("data-vue") || "").split(",").filter((v) => v !== "" && !isNaN(+v)).length === 6));
clic(racine.querySelector(".bab__lancer"));
verifier("la visite commence à l'étape 1", racine.classList.contains("en-visite") && /Étape 1 sur 10/.test(racine.querySelector(".bab__num").textContent));
verifier("le bouton Précédent est inactif à la première étape", racine.querySelector(".bab__prec").disabled);
clic(racine.querySelector(".bab__suiv"));
verifier("Suivant passe à l'étape 2 et montre le bon panneau",
  /Étape 2 sur 10/.test(racine.querySelector(".bab__num").textContent) && panneauxVisibles().join() === etapes[1].getAttribute("data-partie"));
clic(racine.querySelector(".bab__prec"));
verifier("Précédent revient à l'étape 1", /Étape 1 sur 10/.test(racine.querySelector(".bab__num").textContent));
for (let i = 0; i < 9; i++) clic(racine.querySelector(".bab__suiv"));
verifier("la dernière étape propose de terminer", racine.querySelector(".bab__suiv").textContent === "Terminer");
clic(racine.querySelector(".bab__suiv"));
verifier("Terminer quitte la visite et revient à l'accueil", !racine.classList.contains("en-visite") && panneauxVisibles().join() === "accueil");
clic(racine.querySelector(".bab__lancer"));
clic(racine.querySelector(".bab__quitter"));
verifier("Quitter la visite la referme", !racine.classList.contains("en-visite"));

console.log("PLEIN ÉCRAN");
const pleinBouton = racine.querySelector(".bab__entete > .plein-ecran");
verifier("le bouton Plein écran (posé par page.js) est dans l'en-tête", !!pleinBouton);
const texteBouton = racine.querySelector('.bab__outil[data-action="texte"]');
verifier("le bouton qui replie les textes existe", !!texteBouton && texteBouton.getAttribute("aria-expanded") === "true");
verifier("les textes sont regroupés dans le panneau latéral",
  [".bab__visite", ".bab__choix", ".bab__contenu", ".bab__source"].every((sel) => racine.querySelector(".bab__cote > " + sel)));
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la maquette passe en plein écran", racine.classList.contains("est-plein-ecran"));
  clic(texteBouton);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && texteBouton.getAttribute("aria-expanded") === "false" && /Afficher/.test(texteBouton.textContent));
  clic(texteBouton);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(texteBouton.textContent));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}
verifier("l'avis de chargement disparaît une fois la maquette prête (ici, le plan de secours)", racine.classList.contains("est-construite"));
verifier("l'infobulle de survol existe et reste cachée aux lecteurs d'écran", (racine.querySelector(".bab__bulle") || {}).getAttribute && racine.querySelector(".bab__bulle").getAttribute("aria-hidden") === "true");

console.log("TEXTES");
const textes = tous(".bab__panneau, .bab__etape-donnees, .bab__source, .bab__invite, .bab__legende").map((e) => e.textContent).join("\n");
verifier("aucun tiret long ou moyen", !/[—–]/.test(textes), (textes.match(/.{20}[—–].{20}/) || [""])[0]);
verifier("aucune virgule devant « et »", !/, et /.test(textes), (textes.match(/.{25}, et .{10}/) || [""])[0]);
verifier("aucun texte provisoire", !/à venir|TODO|XXX/i.test(textes));
verifier("chaque panneau a un titre et au moins un paragraphe", tous(".bab__panneau").every((p) => p.querySelector(".bab__role") && p.querySelector(".bab__detail")));
verifier("chaque lieu dit ce qui est connu et ce qui est imaginé", tous(".bab__panneau:not(.bab__panneau--accueil)").every((p) => /Sur la maquette/.test(p.textContent)));

console.log("CONSTRUCTION DE LA VILLE");
const t0 = Date.now();
const ville = racine.babylone.batir();
const duree = Date.now() - t0;
verifier("la ville se construit", ville && ville.boites && ville.boites.n > 20000, ville && ville.boites && ville.boites.n);
verifier("aucune valeur invalide dans les boîtes", ville.boites.f.every((v) => Number.isFinite(v)));
verifier("aucune valeur invalide dans les volumes et le sol", ville.vol.f.every((v) => Number.isFinite(v)) && ville.sol.f.every((v) => Number.isFinite(v)));
verifier("chaque boîte a des dimensions positives",
  (() => { const f = ville.boites.f; for (let i = 0; i < f.length; i += 7) { if (!(f[i + 4] > 0 && f[i + 5] > 0 && f[i + 6] > 0)) return false; } return true; })());
const parties = new Set();
for (let i = 4; i < ville.boites.o.length; i += 8) parties.add(ville.boites.o[i]);
for (let i = 4; i < ville.vol.o.length; i += 8) parties.add(ville.vol.o[i]);
for (let i = 4; i < ville.sol.o.length; i += 8) parties.add(ville.sol.o[i]);
verifier("toutes les parties sauf les jardins ont un volume ou un sol", parties.size === 14 && !parties.has(0), [...parties].sort((a, b) => a - b).join(","));
verifier("la construction reste rapide", duree < 4000, duree + " ms");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
