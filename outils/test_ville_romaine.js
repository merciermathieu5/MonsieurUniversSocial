/*
 * Test de la maquette de Lutèce (ville-romaine) dans un DOM simulé.
 *     node outils/test_ville_romaine.js
 *
 * Le DOM simulé n'a pas de WebGL : on vérifie donc le mode de secours, les
 * boutons, les panneaux, la visite guidée, les textes, la typographie et la
 * construction de la ville (géométrie générée sans carte graphique).
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "ville-romaine.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La romanisation des régions conquises</h2>
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
const racine = document.getElementById("ville-romaine");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel) => racine.querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const panneauxVisibles = () => tous(".vro__panneau.est-visible").map((p) => p.getAttribute("data-partie"));
const boutonsPresses = () => tous('.vro__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-partie"));
const LIEUX = ["forum", "cardo", "maisons", "thermes-cluny", "thermes", "arenes", "theatre",
  "aqueduc", "seine", "port", "pilier", "ponts", "necropole", "campagne"];

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("sans WebGL : mode de secours", racine.classList.contains("sans-3d") && !un(".vro__secours").hidden);
verifier("le message de secours est rempli", un(".vro__secours-texte").textContent.length > 40);
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("aucun lieu choisi au départ", boutonsPresses().length === 0);
const boutons = tous(".vro__bouton");
verifier("14 lieux à choisir, dans l'ordre prévu", boutons.map((b) => b.getAttribute("data-partie")).join() === LIEUX.join(), boutons.length);
verifier("un panneau par bouton, relié par aria-controls",
  boutons.every((b) => { const p = document.getElementById(b.getAttribute("aria-controls")); return p && p.getAttribute("data-partie") === b.getAttribute("data-partie"); }));
verifier("15 panneaux (accueil compris)", tous(".vro__panneau").length === 15, tous(".vro__panneau").length);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune balise figure", tous("figure").length === 0);
verifier("la toile a un nom accessible", (un(".vro__toile").getAttribute("aria-label") || "").length > 60);
verifier("les étiquettes de la maquette sont cachées aux lecteurs d'écran", un(".vro__reperes").getAttribute("aria-hidden") === "true");
verifier("tous les boutons ont type=button", tous("button").every((b) => b.getAttribute("type") === "button"));

console.log("CHOIX D'UN LIEU");
clic(un('.vro__bouton[data-partie="forum"]'));
verifier("le panneau du forum s'affiche seul", panneauxVisibles().join() === "forum", panneauxVisibles().join());
verifier("son bouton est enfoncé, lui seul", boutonsPresses().join() === "forum", boutonsPresses().join());
verifier("le choix est noté sur le composant", racine.getAttribute("data-choix") === "forum");
clic(un('.vro__bouton[data-partie="arenes"]'));
verifier("un autre lieu remplace le premier", panneauxVisibles().join() === "arenes" && boutonsPresses().join() === "arenes");
LIEUX.forEach((cle) => {
  clic(un(`.vro__bouton[data-partie="${cle}"]`));
  verifier(`« ${cle} » ouvre son seul panneau`, panneauxVisibles().join() === cle && boutonsPresses().join() === cle);
});

console.log("CE QU'ON SAIT VRAIMENT");
const certitude = un('[data-action="certitude"]');
clic(certitude);
verifier("le bouton s'enfonce et la légende paraît", certitude.getAttribute("aria-pressed") === "true" && !un(".vro__legende").hidden);
verifier("la légende distingue trois degrés de certitude", tous(".vro__legende > span").length === 3);
clic(certitude);
verifier("un second clic remet tout comme avant", certitude.getAttribute("aria-pressed") === "false" && un(".vro__legende").hidden);

console.log("VISITE GUIDÉE");
const etapes = tous(".vro__etape-donnees");
verifier("dix étapes", etapes.length === 10, etapes.length);
verifier("chaque étape vise une partie qui existe", etapes.every((e) => e.getAttribute("data-partie") === "accueil" || un('.vro__bouton[data-partie="' + e.getAttribute("data-partie") + '"]')));
verifier("chaque étape a une vue de six nombres", etapes.every((e) => (e.getAttribute("data-vue") || "").split(",").filter((v) => v !== "" && !isNaN(+v)).length === 6));
verifier("la visite part du port et passe par les arènes",
  etapes[1].getAttribute("data-partie") === "port" && etapes.some((e) => e.getAttribute("data-partie") === "arenes"));
clic(un(".vro__lancer"));
verifier("la visite commence à l'étape 1", racine.classList.contains("en-visite") && /Étape 1 sur 10/.test(un(".vro__num").textContent));
verifier("le bouton Précédent est inactif à la première étape", un(".vro__prec").disabled);
clic(un(".vro__suiv"));
verifier("Suivant passe à l'étape 2 et montre le bon panneau",
  /Étape 2 sur 10/.test(un(".vro__num").textContent) && panneauxVisibles().join() === etapes[1].getAttribute("data-partie"));
clic(un(".vro__prec"));
verifier("Précédent revient à l'étape 1", /Étape 1 sur 10/.test(un(".vro__num").textContent));
for (let i = 0; i < 9; i++) clic(un(".vro__suiv"));
verifier("la dernière étape propose de terminer", un(".vro__suiv").textContent === "Terminer");
clic(un(".vro__suiv"));
verifier("Terminer quitte la visite et revient à l'accueil", !racine.classList.contains("en-visite") && panneauxVisibles().join() === "accueil");
clic(un(".vro__lancer"));
clic(un(".vro__quitter"));
verifier("Quitter la visite la referme", !racine.classList.contains("en-visite"));

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".vro__entete > .plein-ecran");
verifier("le bouton Plein écran (posé par page.js) est dans l'en-tête", !!pleinBouton);
const texteBouton = un('.vro__outil[data-action="texte"]');
verifier("le bouton qui replie les textes existe", !!texteBouton && texteBouton.getAttribute("aria-expanded") === "true");
verifier("les textes sont regroupés dans le panneau latéral",
  [".vro__visite", ".vro__choix", ".vro__contenu", ".vro__source"].every((sel) => un(".vro__cote > " + sel)));
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
verifier("l'infobulle de survol existe et reste cachée aux lecteurs d'écran", !!un(".vro__bulle") && un(".vro__bulle").getAttribute("aria-hidden") === "true");

console.log("TEXTES");
const textes = tous(".vro__panneau, .vro__etape-donnees, .vro__source, .vro__invite, .vro__legende, .vro__titre, .vro__consigne")
  .map((e) => e.textContent.replace(/[ \t\n\r]+/g, " ")).join("\n")
  + "\n" + tous(".vro__etape-donnees").map((e) => e.getAttribute("data-titre")).join("\n");
verifier("aucun tiret long ou moyen", !/[—–]/.test(textes), (textes.match(/.{20}[—–].{20}/) || [""])[0]);
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(textes), (textes.match(/.{25},\s+et\s.{10}/) || [""])[0]);
verifier("aucun texte provisoire", !/à venir|TODO|XXX/i.test(textes));
verifier("une espace insécable devant chaque deux-points", !/(?<! ):/.test(textes), (textes.match(/.{20}(?<! ):.{10}/) || [""])[0]);
verifier("aucune espace devant ? ! ;", !/[   ][?!;]/.test(textes), (textes.match(/.{20}[   ][?!;]/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?! )/.test(textes) && !/(?<! )»/.test(textes));
verifier("aucun nombre coupé par une espace ordinaire", !/\d \d{3}\b/.test(textes), (textes.match(/.{15}\d \d{3}\b.{5}/) || [""])[0]);
verifier("les siècles s'écrivent en chiffres, comme dans la fiche", !/\b(I|II|III|IV|V|XX)(er|e) siècle/.test(textes), (textes.match(/.{15}\b[IVX]+e?r? siècle/) || [""])[0]);
verifier("chaque panneau a un titre et au moins un paragraphe", tous(".vro__panneau").every((p) => p.querySelector(".vro__role") && p.querySelector(".vro__detail")));
verifier("chaque lieu dit ce qui est connu et ce qui est imaginé", tous(".vro__panneau:not(.vro__panneau--accueil)").every((p) => /Sur la maquette/.test(p.textContent)));
const panneau = (cle) => document.getElementById("vro-" + cle).textContent.replace(/[ \t\n\r ]+/g, " ");
verifier("les sources de l'aqueduc sont autour de Wissous, pas à Rungis", /Wissous/.test(panneau("aqueduc")) && !/Rungis/.test(panneau("aqueduc")));
verifier("le forum mesure 90 m sur 180 m", /90 m sur 180 m/.test(panneau("forum")));
verifier("les arènes : de 15 000 à 17 000 spectateurs, scène de 41 m", /15 000 à 17 000/.test(panneau("arenes")) && /41 m/.test(panneau("arenes")));
verifier("le pilier des Nautes date de Tibère et a été retrouvé en 1710", /Tibère/.test(panneau("pilier")) && /1710/.test(panneau("pilier")));

console.log("CONSTRUCTION DE LA VILLE");
const t0 = Date.now();
const ville = racine.ville.batir();
const duree = Date.now() - t0;
verifier("la ville se construit", ville && ville.boites && ville.boites.n > 12000, ville && ville.boites && ville.boites.n);
verifier("aucune valeur invalide dans les boîtes", ville.boites.f.every((v) => Number.isFinite(v)));
verifier("aucune valeur invalide dans les volumes et le sol", ville.vol.f.every((v) => Number.isFinite(v)) && ville.sol.f.every((v) => Number.isFinite(v)));
verifier("chaque boîte a des dimensions positives",
  (() => { const f = ville.boites.f; for (let i = 0; i < f.length; i += 7) { if (!(f[i + 4] > 0 && f[i + 5] > 0 && f[i + 6] > 0)) return false; } return true; })());
const parties = new Set();
for (let i = 4; i < ville.boites.o.length; i += 8) parties.add(ville.boites.o[i]);
for (let i = 4; i < ville.vol.o.length; i += 8) parties.add(ville.vol.o[i]);
for (let i = 4; i < ville.sol.o.length; i += 8) parties.add(ville.sol.o[i]);
verifier("les 14 parties ont un volume ou un sol", [...parties].filter((p) => p > 0).length === 14, [...parties].sort((a, b) => a - b).join(","));
verifier("la construction reste rapide", duree < 4000, duree + " ms");

console.log("SOL, RIVES ET QUARTIERS");
// Géométrie du site, relue dans le script du composant.
const D = JSON.parse(script.match(/var D = (\{.*?\});/)[1]);
const ILES = [D.cite].concat(D.ilots);
function dedans(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const dansEau = (x, y) => dedans(x, y, D.seine) && !ILES.some((q) => dedans(x, y, q));
const S = ville.sol, sf = S.f, so = S.o;
let terreDansEau = 0, trianglesEau = 0, eauHorsCote = 0, solSansMasque = 0;
for (let t = 0; t < S.n; t += 3) {
  const mat = so[t * 8 + 5];
  const P = [0, 1, 2].map((k) => [sf[(t + k) * 6], sf[(t + k) * 6 + 1], -sf[(t + k) * 6 + 2]]);
  if (mat === 12 && P.every((q) => q[1] === 0)) { trianglesEau++; continue; }
  if (mat !== 10) continue;
  if (Math.abs(P[0][0]) > 1500 || Math.abs(P[0][2] - 400) > 1200) continue;
  if (Math.max(P[0][1], P[1][1], P[2][1]) <= 0.1) continue;
  for (let u = 1; u < 6; u++) for (let v = 1; v < 6 - u; v++) {
    const w = 6 - u - v, x = (P[0][0] * u + P[1][0] * v + P[2][0] * w) / 6, z = (P[0][1] * u + P[1][1] * v + P[2][1] * w) / 6, y = (P[0][2] * u + P[1][2] * v + P[2][2] * w) / 6;
    if (z > 0.15 && dansEau(x, y)) terreDansEau++;
  }
}
verifier("l'eau de la Seine est posée en petits triangles à la cote 0", trianglesEau > 2000, trianglesEau);
verifier("près de la ville, aucune pointe de terre ne dépasse dans la Seine", terreDansEau === 0, terreDansEau);
// Les maisons de l'île de la Cité (boîtes de la partie Maisons posées dans l'île).
const PART = ["", "forum", "cardo", "maisons", "thermes-cluny", "thermes", "arenes", "theatre", "aqueduc", "seine", "port", "pilier", "ponts", "necropole", "campagne"];
let maisonsIle = 0;
for (let i = 0; i < ville.boites.n; i++) {
  const f = ville.boites.f, o = ville.boites.o;
  if (PART[o[i * 8 + 4]] === "maisons" && f[i * 7 + 4] > 5 && dedans(f[i * 7], f[i * 7 + 1], D.cite)) maisonsIle++;
}
verifier("l'île de la Cité est bâtie (plus de 150 maisons)", maisonsIle > 150, maisonsIle);
// Cours-jardins des domus : dalles vertes de la partie Maisons.
let cours = 0;
for (let t = 0; t < S.n; t += 3) { if (so[t * 8 + 5] === 11 && PART[so[t * 8 + 4]] === "maisons" && so[t * 8 + 1] > so[t * 8] + 8) cours++; }
verifier("des domus ont une cour-jardin", cours >= 30, cours / 2 + " cours");


console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
