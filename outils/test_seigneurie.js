/*
 * Test de la maquette 3D de la seigneurie dans un DOM simulé.
 *     node outils/test_seigneurie.js
 *
 * Le DOM simulé n'a pas de WebGL : on vérifie donc le mode de secours, les boutons, les
 * panneaux, les obligations et leurs flèches, la visite guidée, les textes, puis la
 * construction de la maquette sans carte graphique (géométrie, terrain, modèles 3D, carte
 * des zones). Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "seigneurie.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La seigneurie au Moyen Âge</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = () => null;
window.matchMedia = (requete) => ({
  matches: /prefers-reduced-motion:\s*reduce/.test(requete), media: requete,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
});
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const racine = document.getElementById("seigneurie");
const api = racine && racine.seigneurie;
// Un second passage du script ne doit rien doubler.
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const panneauxVisibles = () => tous(".sei__panneau.est-visible").map((p) => p.getAttribute("data-panneau"));
const presses = () => tous('.sei__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-lieu") || b.getAttribute("data-obligation") || b.getAttribute("data-action"));
const PARTIES = ["", "chateau", "reserve", "tenures", "village", "eglise", "moulin", "four", "pressoir", "foret", "communaux", "riviere"];
const bits = (liste) => liste.reduce((m, c) => m | (1 << PARTIES.indexOf(c)), 0);

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.seigneurie === api);
verifier("sans WebGL : mode de secours", racine.classList.contains("sans-3d") && !un(".sei__secours").hidden);
verifier("le message de secours est rempli", un(".sei__secours-texte").textContent.length > 60);
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("aucun bouton enfoncé au départ", presses().length === 0, presses().join());
const boutonsLieux = tous(".sei__bouton[data-lieu]"), boutonsObl = tous(".sei__bouton[data-obligation]");
verifier("11 lieux à choisir, numérotés de 1 à 11", boutonsLieux.length === 11 && boutonsLieux.map((b) => un(".sei__num", b).textContent).join() === "1,2,3,4,5,6,7,8,9,10,11");
verifier("6 obligations à choisir", boutonsObl.length === 6, boutonsObl.length);
verifier("un bouton pour la visite d'une année au village", tous(".sei__bouton--visite").length === 1);
verifier("28 panneaux : accueil, 11 lieux, 6 obligations, 10 étapes", tous(".sei__panneau").length === 28, tous(".sei__panneau").length);
verifier("chaque lieu et chaque obligation a son panneau",
  boutonsLieux.every((b) => un(`.sei__panneau[data-panneau="lieu-${b.getAttribute("data-lieu")}"]`)) &&
  boutonsObl.every((b) => un(`.sei__panneau[data-panneau="obligation-${b.getAttribute("data-obligation")}"]`)));
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune balise figure", tous("figure").length === 0);
verifier("la toile a un nom accessible", (un(".sei__toile").getAttribute("aria-label") || "").length > 120);
verifier("les étiquettes et les flèches de la maquette sont cachées aux lecteurs d'écran",
  un(".sei__reperes").getAttribute("aria-hidden") === "true" && un(".sei__fleches").getAttribute("aria-hidden") === "true");
verifier("tous les boutons ont type=button", tous("button").every((b) => b.getAttribute("type") === "button"));
verifier("l'en-tête porte une classe en __entete (bouton Plein écran de page.js)", !!un(".sei__entete"));

console.log("CHOIX D'UN LIEU");
clic(un('.sei__bouton[data-lieu="moulin"]'));
verifier("le panneau du moulin s'affiche seul", panneauxVisibles().join() === "lieu-moulin", panneauxVisibles().join());
verifier("son bouton est enfoncé, lui seul", presses().join() === "moulin", presses().join());
verifier("le choix est noté sur le composant", racine.getAttribute("data-choix") === "moulin");
verifier("le moulin est mis en évidence dans la maquette", api.masque() === bits(["moulin"]), api.masque());
verifier("aucune flèche pour un lieu seul", api.fleches().length === 0);
clic(un('.sei__bouton[data-lieu="eglise"]'));
verifier("un autre lieu remplace le premier", panneauxVisibles().join() === "lieu-eglise" && presses().join() === "eglise");

console.log("OBLIGATIONS ET FLÈCHES");
const ATTENDU = { corvee: [["village", "reserve"], ["village", "chateau"], ["village", "pressoir"], ["village", "riviere"]], cens: [["tenures", "chateau"]],
  champart: [["tenures", "chateau"]], taille: [["village", "chateau"]], banalites: [["village", "moulin"], ["village", "four"], ["village", "pressoir"]], dime: [["tenures", "eglise"]] };
Object.keys(ATTENDU).forEach((cle) => {
  clic(un(`.sei__bouton[data-obligation="${cle}"]`));
  const f = api.fleches();
  const okF = f.length === ATTENDU[cle].length && ATTENDU[cle].every((p, i) => f[i][0] === p[0] && f[i][1] === p[1] && f[i][2].length > 3);
  verifier(`${cle} : panneau, bouton et flèches`, panneauxVisibles().join() === "obligation-" + cle && presses().join() === cle && okF, JSON.stringify(f));
});
verifier("la dîme va à l'Église (flèche violette), les autres au seigneur",
  (() => { clic(un('.sei__bouton[data-obligation="dime"]')); const d = api.fleches()[0][3]; clic(un('.sei__bouton[data-obligation="cens"]')); return d === "eglise" && api.fleches()[0][3] === "seigneur"; })());
clic(un('.sei__bouton[data-obligation="banalites"]'));
verifier("les banalités mettent en évidence le moulin, le four et le pressoir", api.masque() === bits(["moulin", "four", "pressoir"]), api.masque());
verifier("le bandeau de la maquette nomme l'obligation", !un(".sei__bandeau").hidden && un(".sei__bandeau").textContent === "Les banalités");
const puce = un('.sei__panneau.est-visible .sei__puce[data-lieu="four"]');
verifier("une puce du panneau mène au lieu", !!puce && (clic(puce), panneauxVisibles().join() === "lieu-four"));
const puceO = un('.sei__panneau.est-visible .sei__puce[data-obligation]');
verifier("une puce du panneau de lieu mène à l'obligation", !!puceO && (clic(puceO), /^obligation-/.test(panneauxVisibles().join())));
clic(un('.sei__panneau.est-visible .sei__retour'));
verifier("Revenir à l'accueil efface la mise en évidence et les flèches", panneauxVisibles().join() === "accueil" && api.masque() === 0 && api.fleches().length === 0 && un(".sei__bandeau").hidden);

console.log("UNE ANNÉE AU VILLAGE");
clic(un(".sei__bouton--visite"));
verifier("la visite commence à l'étape 1 (Pâques)", panneauxVisibles().join() === "etape-paques" && presses().join() === "visite", panneauxVisibles().join());
verifier("étape 1 : la flèche de la corvée va à la réserve", JSON.stringify(api.fleches().map((f) => f[1])) === '["reserve"]', JSON.stringify(api.fleches()));
verifier("le bouton Précédent est inactif à la première étape", un('.sei__panneau.est-visible .sei__precedent').disabled);
clic(un('.sei__panneau.est-visible .sei__suivant'));
verifier("Suivant passe à l'étape 2 (la Saint-Jean)", panneauxVisibles().join() === "etape-saintjean");
clic(un('.sei__panneau.est-visible .sei__precedent'));
verifier("Précédent revient à l'étape 1", panneauxVisibles().join() === "etape-paques");
for (let i = 0; i < 9; i++) clic(un('.sei__panneau.est-visible .sei__suivant'));
verifier("la dernière étape fait le bilan et pose la question", panneauxVisibles().join() === "etape-bilan" && !!un('.sei__panneau.est-visible .sei__question'));
clic(un('.sei__panneau.est-visible .sei__terminer'));
verifier("Terminer revient à l'accueil", panneauxVisibles().join() === "accueil" && presses().length === 0);
clic(un('.sei__appel[data-action="visite"]'));
verifier("le bouton de l'accueil lance aussi la visite", panneauxVisibles().join() === "etape-paques");
api.accueil();

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".sei__entete > .plein-ecran");
verifier("le bouton Plein écran (posé par page.js) est dans l'en-tête", !!pleinBouton);
const texteBouton = un('.sei__outil[data-action="texte"]');
verifier("le bouton qui replie les textes existe", !!texteBouton && texteBouton.getAttribute("aria-expanded") === "true");
verifier("les textes sont regroupés dans le panneau latéral", [".sei__choix", ".sei__contenu"].every((sel) => un(".sei__cote > " + sel)));
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
verifier("l'avis de chargement disparaît (ici, mode de secours)", racine.classList.contains("est-construite"));

console.log("TEXTES");
function controleTexte(t) {
  const fautes = [];
  if (/[—–]/.test(t)) fautes.push("tiret long ou moyen");
  if (/, et /.test(t)) fautes.push("virgule devant « et »");
  if (/[   ][;!?]/.test(t)) fautes.push("espace avant ; ! ?");
  if (/[^ \s]:(?!\d)|\w :/.test(t)) fautes.push("deux-points sans espace insécable");
  if (/«(?! )|(?<! )»/.test(t)) fautes.push("guillemets sans espace insécable");
  if (/\d \d{3}\b/.test(t)) fautes.push("nombre sans espace insécable");
  return fautes;
}
const copie = racine.cloneNode(true);
tous("style, script", copie).forEach((el) => el.remove());
const visible = copie.textContent;
const textes = tous(".sei__panneau, .sei__source, .sei__credit, .sei__consigne").map((e) => e.textContent).join("\n");
verifier("typographie des panneaux conforme", controleTexte(textes).length === 0, controleTexte(textes).join(", "));
verifier("aucun texte provisoire", !/à venir|TODO|XXX|lorem/i.test(visible));
verifier("plus aucune mention de l'ancien plan dans les panneaux", !/(sur ce plan|sur le plan|ce plan montre)/i.test(textes), (textes.match(/.{30}(sur ce plan|sur le plan).{20}/i) || [""])[0]);
verifier("l'accueil précise que c'est une seigneurie type, pas un lieu réel", /seigneurie type/.test(un('[data-panneau="accueil"]').textContent) && /pas un lieu réel/.test(un('[data-panneau="accueil"]').textContent));
verifier("crédits visibles des modèles 3D (Kenney, Quaternius, CC0)", /Kenney/.test(un(".sei__credit").textContent) && /Quaternius/.test(un(".sei__credit").textContent) && /CC0/.test(un(".sei__credit").textContent));
verifier("la source cite les modèles 3D et leur licence", /kenney\.nl/.test(un(".sei__source").textContent) && /quaternius\.com/.test(un(".sei__source").textContent) && /CC0/.test(un(".sei__source").textContent));
verifier("chaque panneau a un titre et au moins un paragraphe", tous(".sei__panneau").every((p) => un(".sei__role", p) && un(".sei__detail", p)));
verifier("le contrôle typographique détecte une faute volontaire",
  ["une phrase — fautive", "le cens, et la taille", "Quoi ?", "ceci: cela", "« mot»", "9 100 habitants"].every((t) => controleTexte(t).length > 0));

console.log("CONSTRUCTION DE LA MAQUETTE");
let t0 = Date.now();
const M = api.batir();
const duree = Date.now() - t0;
verifier("la seigneurie se construit", M && M.boites && M.instances && M.vol && M.eau);
verifier("aucune valeur invalide dans les volumes, l'eau et les boîtes",
  [M.vol.f, M.eau.f, M.boites.f].every((f) => f.length && f.every((v) => Number.isFinite(v))));
verifier("chaque boîte a des dimensions positives", (() => { const f = M.boites.f; for (let i = 0; i < f.length; i += 7) { if (!(f[i + 4] > 0 && f[i + 5] > 0 && f[i + 6] > 0)) return false; } return true; })());
const inst = M.instances;
const nInst = (cle, part) => { const I = inst[cle]; let n = 0; for (let i = 0; i < I.n; i++) { if (part === undefined || I.o[i * 8 + 4] === PARTIES.indexOf(part)) n++; } return n; };
verifier("aucune valeur invalide dans les instances des modèles", Object.keys(inst).every((k) => inst[k].f.every((v) => Number.isFinite(v))));
const chaumieres = nInst("chaumiere_a", "village") + nInst("chaumiere_b", "village") + nInst("chaumiere_c", "village");
verifier("une quinzaine de chaumières au village (au moins 12)", chaumieres >= 12, chaumieres);
verifier("une seule maison aisée : celle du meunier", nInst("maison_riche") === 1 && nInst("maison_riche", "moulin") === 1);
verifier("le château : murs, quatre tours, donjon, porte, pont-levis, bannière",
  nInst("mur", "chateau") >= 20 && nInst("tour", "chateau") === 4 && nInst("donjon_fenetres", "chateau") === 3 && nInst("porte_mur", "chateau") === 2 && nInst("pont_levis") === 1 && nInst("banniere") === 1);
verifier("deux granges : celle du seigneur et la grange dîmière", nInst("grange", "chateau") === 1 && nInst("grange", "eglise") === 1);
verifier("la roue à aubes du moulin et le pont de pierre", nInst("roue", "moulin") === 1 && nInst("pont", "riviere") === 1);
const arbres = ["chene", "arbre", "arbre_rond", "arbre_touffu", "arbre_plateau"].reduce((s, k) => s + nInst(k, "foret"), 0);
verifier("une forêt dense (plus de 300 arbres)", arbres > 300, arbres);
const parties = new Set();
for (let i = 4; i < M.vol.o.length; i += 8) parties.add(M.vol.o[i]);
for (let i = 4; i < M.boites.o.length; i += 8) parties.add(M.boites.o[i]);
for (let i = 4; i < M.eau.o.length; i += 8) parties.add(M.eau.o[i]);
Object.keys(inst).forEach((k) => { for (let i = 0; i < inst[k].n; i++) parties.add(inst[k].o[i * 8 + 4]); });
const Z = api.zones(M.maisons), zonesVues = new Set(Z.t);
const manquants = PARTIES.slice(1).filter((c, i) => !parties.has(i + 1) && !zonesVues.has(i + 1));
verifier("les onze lieux existent dans la maquette (volume, modèle ou zone du sol)", manquants.length === 0, manquants.join());
verifier("la carte des zones couvre les grandes zones du sol",
  ["reserve", "tenures", "foret", "communaux", "pressoir", "riviere", "chateau", "village", "eglise"].every((c) => zonesVues.has(PARTIES.indexOf(c))));
verifier("la construction reste rapide (moins de 1,5 s)", duree < 1500, duree + " ms");

console.log("TERRAIN ET MODÈLES 3D");
t0 = Date.now();
const T = api.terrain();
verifier("le terrain se maille sans valeur invalide", T.pos.every((v) => Number.isFinite(v)) && T.nor.every((v) => Number.isFinite(v)) && T.idx.length % 3 === 0);
verifier("les normales du terrain sont unitaires", (() => { for (let i = 0; i < T.nor.length; i += 3 * 97) { const l = Math.hypot(T.nor[i], T.nor[i + 1], T.nor[i + 2]); if (Math.abs(l - 1) > 1e-3) return false; } return true; })());
verifier("tous les indices du terrain sont valides", (() => { for (let i = 0; i < T.idx.length; i++) if (T.idx[i] >= T.n) return false; return true; })());
const L = api.lieux;
verifier("le château domine sa motte : plateau plus haut que la campagne", api.H(L.chateau.ancre[0], L.chateau.ancre[1]) > api.H(L.reserve.ancre[0], L.reserve.ancre[1]) + 5);
verifier("le coteau des vignes monte vers l'est", api.H(560, -60) > api.H(380, -60) + 4);
verifier("le terrain du maillage reste rapide", Date.now() - t0 < 1500, (Date.now() - t0) + " ms");
const G = api.modeles();
const cles = Object.keys(G);
verifier("24 modèles 3D décodés", cles.length === 24, cles.length);
verifier("aucune valeur invalide dans les modèles décodés", cles.every((k) => G[k].f.every((v) => Number.isFinite(v)) && G[k].n > 0 && G[k].o.length === G[k].n * 4));
verifier("les couleurs variables (toit, feuillage, torchis) sont marquées", (() => { const s = new Set(); cles.forEach((k) => { for (let i = 3; i < G[k].o.length; i += 4) s.add(G[k].o[i]); }); return s.has(1) && s.has(2) && s.has(3); })());
verifier("environ 13 000 triangles uniques (moins de 25 000)", (() => { const n = cles.reduce((s, k) => s + G[k].n / 3, 0); return n > 8000 && n < 25000; })());
verifier("le composant reste léger (moins de 450 Ko)", Buffer.byteLength(composant, "utf8") < 450 * 1024, (Buffer.byteLength(composant, "utf8") / 1024).toFixed(1) + " Ko");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
