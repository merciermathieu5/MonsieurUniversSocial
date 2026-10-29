/*
 * Test de la maquette 3D du Vieux-Québec (fiche de géographie 03) dans un DOM simulé.
 *     node outils/test_vieux_quebec.js [composant.html]
 *
 * Le DOM simulé n'a pas de WebGL : on vérifie donc le mode de secours, la liste des 13 lieux, les
 * panneaux, le filtre par période de création, les couleurs des régimes, l'activité et sa rétroaction, les
 * textes, puis la construction de la maquette sans carte graphique (relief et falaise, bâtiments,
 * arbres, aucune coordonnée invalide, 13 lieux bien situés) et les règles des étiquettes calmes, de
 * la molette et du recadrage. Le composant est inséré dans une fiche minimale, avec page.js quand il
 * est présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "vieux-quebec.html");
const composant = fs.readFileSync(fichier, "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="geographie"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les traces de trois régimes</h2>
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
const racine = document.getElementById("vieux-quebec");
const api = racine && racine.vqc;
// Un second passage du script ne doit rien doubler.
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { if (el) el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const texteContenu = () => un(".vqc__contenu").textContent;
const SEPT = ["place-royale", "ursulines", "place-armes", "maison-jacquet", "fortifications", "citadelle", "terrasse"];

console.log("MISE EN PLACE");
verifier("composant présent", !!racine && !!api);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.vqc === api && tous(".vqc__ancre").length === 0);
verifier("l'entête se termine par __entete (bouton Plein écran de page.js)", !!un(".vqc__entete"));
if (fs.existsSync(pageJs)) verifier("page.js ajoute le bouton Plein écran dans l'entête", !!un(".vqc__entete .plein-ecran"));
verifier("sans WebGL : mode de secours", racine.classList.contains("sans-3d") && !un(".vqc__secours").hidden);
verifier("le message de secours est rempli", un(".vqc__secours-texte").textContent.length > 60);
const boutons = tous(".vqc__lieu");
const lieux = api.lieux;
verifier("13 lieux dans la liste", boutons.length === 13, boutons.length);
verifier("13 lieux dans les données, numérotés dans l'ordre", lieux.length === 13 && lieux.every((l, i) => l.num === i + 1 && boutons[i].getAttribute("data-lieu") === l.id));
verifier("chaque lieu a un régime d'origine valide et des transformations valides", lieux.every((l) => ["fr", "br", "co"].includes(l.o) && l.t.every((t) => ["fr", "br", "co"].includes(t) && t !== l.o)));
verifier("les trois régimes sont représentés", ["fr", "br", "co"].every((c) => lieux.some((l) => l.o === c)));
verifier("les sept lieux de la fiche sont présents", SEPT.every((id) => lieux.some((l) => l.id === id)));
verifier("la pastille de chaque lieu porte la couleur de son régime d'origine", boutons.every((b, i) => b.querySelector(".vqc__num--" + lieux[i].o)));
verifier("l'accueil s'affiche au départ, avec la frise des trois régimes", /Trois régimes dans les mêmes rues/.test(texteContenu()) && /1608 à 1760/.test(texteContenu()) && /1760 à 1867/.test(texteContenu()) && /depuis 1867/.test(texteContenu()));
verifier("aucun bouton de lieu enfoncé au départ", boutons.every((b) => b.getAttribute("aria-pressed") === "false"));
verifier("les étiquettes et les traits de la maquette sont cachés aux lecteurs d'écran", un(".vqc__reperes").getAttribute("aria-hidden") === "true" && un(".vqc__traits").getAttribute("aria-hidden") === "true");
verifier("la toile est décrite et utilisable au clavier", un(".vqc__toile").getAttribute("role") === "img" && /Cap Diamant/.test(un(".vqc__toile").getAttribute("aria-label")) && un(".vqc__toile").getAttribute("tabindex") === "0");
const source = un(".vqc__source").textContent, credit = un(".vqc__credit").textContent;
verifier("crédits OpenStreetMap (ODbL) et altitude Copernicus par Open-Meteo, sur la maquette et dans la source",
  /© les contributeurs d'OpenStreetMap/.test(source) && /licence ODbL/.test(source) && /Copernicus/.test(source) && /Open-Meteo/.test(source) &&
  /OpenStreetMap/.test(credit) && /ODbL/.test(credit) && /Copernicus/.test(credit) && /Open-Meteo/.test(credit));

console.log("CONVENTIONS DU DÉPÔT");
verifier("aucun titre h2 ou h3 dans le composant", !/<h[23][\s>]/.test(composant));
verifier("listes sans puces (::before et ::marker neutralisés)", /\.vqc ul > li::before, \.vqc ol > li::before \{ content: none; display: none; \}/.test(composant) && /\.vqc ul > li::marker, \.vqc ol > li::marker \{ content: none; \}/.test(composant));
verifier("variantes sombres (html[data-sombre=\"on\"])", (composant.match(/html\[data-sombre="on"\] \.vqc/g) || []).length >= 6);
verifier("le mouvement réduit est respecté", /prefers-reduced-motion: reduce/.test(composant) && /prefers-reduced-motion: reduce/.test(script));
verifier("le texte se replie en plein écran (texte-masque) et l'écran entier est utilisé", /\.vqc\.est-plein-ecran\.texte-masque > \.vqc__cote \{ display: none; \}/.test(composant) && /\.vqc\.est-plein-ecran \{ display: grid;/.test(composant));
verifier("la police des boutons de l'entête n'est pas forcée (pas de font: inherit global)", !/\.vqc (button|\*) \{[^}]*font: inherit/.test(composant));
verifier("aucun identifiant id en double dans le composant", (() => { const ids = (composant.match(/\sid="[^"]+"/g) || []); return new Set(ids).size === ids.length; })());

console.log("CHOIX D'UN LIEU");
clic(boutons[5]);
verifier("choisir la Citadelle affiche son nom", /La Citadelle/.test(texteContenu()));
verifier("le bouton choisi est enfoncé", boutons[5].getAttribute("aria-pressed") === "true" && boutons.filter((b) => b.getAttribute("aria-pressed") === "true").length === 1);
verifier("le régime d'origine et les transformations sont nommés", /Régime britannique/.test(texteContenu()) && /Période contemporaine/.test(texteContenu()) && /création/.test(texteContenu()));
verifier("le lieu choisi est mis en évidence sur la maquette", api.etat().choisi === "citadelle" && api.etat().marques.join() === "6");
clic(boutons[0]);
verifier("choisir la place Royale remplace le texte", /La place Royale/.test(texteContenu()) && /Continuité et changement/.test(texteContenu()));
clic(boutons[7]);
verifier("un lieu sans transformation affiche « À retenir »", /Le Château Frontenac/.test(texteContenu()) && /À retenir/.test(texteContenu()));
clic(un(".vqc__retour"));
verifier("le bouton de retour ramène l'accueil", /Trois régimes dans les mêmes rues/.test(texteContenu()) && api.etat().choisi === null);

console.log("FILTRE PAR PÉRIODE DE CRÉATION");
verifier("la barre du filtre annonce la période de création", /Période de création/.test(un(".vqc__barre-nom").textContent) && /période de création/.test(un(".vqc__barre").getAttribute("aria-label")));
const parPeriode = { fr: [1, 2, 3, 4, 5, 9], br: [6, 10, 11], co: [7, 8, 12, 13] };
["fr", "br", "co"].forEach((code) => {
  clic(un(`.vqc__filtre[data-filtre="${code}"]`));
  const garde = lieux.filter((l) => l.o === code).map((l) => l.num);
  const attenues = boutons.filter((b) => b.classList.contains("est-atenue")).map((b, i) => b.getAttribute("data-lieu"));
  verifier(`${code} : seuls les lieux créés pendant cette période restent (${garde.join(", ")})`,
    api.etat().marques.join() === garde.join() && garde.join() === parPeriode[code].join() && api.etat().focus === 1, api.etat().marques.join());
  verifier(`${code} : les autres lieux sont atténués dans la liste`, attenues.length === 13 - garde.length && lieux.every((l) => attenues.includes(l.id) === (l.o !== code)));
});
verifier("un lieu seulement transformé par la période n'est pas retenu (Ursulines, créé sous le régime français)", (() => { clic(un('.vqc__filtre[data-filtre="br"]')); return api.etat().marques.indexOf(2) < 0; })());
verifier("le bouton du filtre est enfoncé", un('.vqc__filtre[data-filtre="br"]').getAttribute("aria-pressed") === "true" && un('.vqc__filtre[data-filtre="tous"]').getAttribute("aria-pressed") === "false");
verifier("le filtre est annoncé aux lecteurs d'écran", un(".vqc__annonce").textContent === "Lieux créés pendant le régime britannique", un(".vqc__annonce").textContent);
clic(boutons[5]);
verifier("choisir un lieu de la période filtrée garde le filtre", api.etat().filtre === "br" && api.etat().choisi === "citadelle" && api.etat().marques.join() === "6");
clic(un(".vqc__retour"));
verifier("revenir à l'accueil garde le filtre et ses lieux", api.etat().filtre === "br" && api.etat().choisi === null && api.etat().marques.join() === "6,10,11");
clic(boutons[0]);
verifier("choisir dans la liste un lieu d'une autre période ramène tous les régimes",
  api.etat().filtre === "tous" && api.etat().choisi === "place-royale" && un('.vqc__filtre[data-filtre="tous"]').getAttribute("aria-pressed") === "true" && !boutons.some((b) => b.classList.contains("est-atenue")));
clic(un(".vqc__retour"));
clic(un('.vqc__filtre[data-filtre="co"]'));
clic(boutons[7]);
clic(un('.vqc__filtre[data-filtre="fr"]'));
verifier("changer de période ferme un lieu qui n'en fait pas partie", api.etat().choisi === null && api.etat().filtre === "fr" && /Trois régimes dans les mêmes rues/.test(texteContenu()));
clic(un('.vqc__filtre[data-filtre="tous"]'));
verifier("Tous les régimes rétablit la maquette", !boutons.some((b) => b.classList.contains("est-atenue")) && api.etat().marques.length === 0 && api.etat().focus === 0);

console.log("COULEURS DES RÉGIMES");
verifier("les couleurs naturelles sont actives au départ", un(".vqc__couleurs").getAttribute("aria-pressed") === "false" && api.etat().regime === 0);
clic(un(".vqc__couleurs"));
verifier("le bouton active les couleurs des régimes", un(".vqc__couleurs").getAttribute("aria-pressed") === "true" && api.etat().regime === 1);
clic(un(".vqc__couleurs"));
verifier("puis revient aux couleurs naturelles", api.etat().regime === 0);

console.log("ACTIVITÉ");
clic(un(".vqc__activite-lancer"));
verifier("la question s'affiche et le bandeau invite à répondre", /Sous quel régime ce lieu a-t-il été créé\?/.test(texteContenu()) && !un(".vqc__bandeau").hidden);
verifier("pendant la question, la maquette est neutre (pas d'indice de couleur)", api.etat().regime === 2 && api.etat().activite === true);
let bons = 0;
for (let i = 0; i < 13; i++) {
  const nom = un(".vqc__contenu .vqc__nom").textContent;
  const lieu = lieux.find((l) => l.nom === nom);
  const b = un(`.vqc__reponse[data-reponse="${lieu.o}"]`);
  clic(b);
  if (b.classList.contains("est-juste")) bons++;
  const retro = un(".vqc__retro").textContent;
  if (i === 0) {
    verifier("la rétroaction explique la réponse", /Exact\./.test(retro) && retro.length > 40, retro);
    verifier("la réponse révèle la couleur du lieu", api.etat().regime === 1);
  }
  clic(un(".vqc__suivant"));
}
verifier("13 bonnes réponses quand on répond juste", bons === 13, bons);
verifier("le bilan s'affiche", /13 bonnes réponses sur 13/.test(texteContenu()));
clic(un(".vqc__quitter"));
verifier("quitter l'activité revient à l'accueil et rétablit les couleurs naturelles", /Trois régimes dans les mêmes rues/.test(texteContenu()) && api.etat().regime === 0 && !api.etat().activite && un(".vqc__bandeau").hidden);
clic(un(".vqc__activite-lancer"));
const nom1 = un(".vqc__contenu .vqc__nom").textContent, lieu1 = lieux.find((l) => l.nom === nom1);
const faux = ["fr", "br", "co"].find((c) => c !== lieu1.o);
clic(un(`.vqc__reponse[data-reponse="${faux}"]`));
verifier("une mauvaise réponse est signalée et la bonne est montrée", /Pas tout à fait\./.test(un(".vqc__retro").textContent) && un(`.vqc__reponse[data-reponse="${faux}"]`).classList.contains("est-faux") && un(`.vqc__reponse[data-reponse="${lieu1.o}"]`).classList.contains("est-juste"));
clic(boutons[2]);
verifier("choisir un lieu dans la liste quitte l'activité", !api.etat().activite && /La place d'Armes/.test(texteContenu()));
api.accueil();

console.log("MAQUETTE SANS CARTE GRAPHIQUE");
const t0 = Date.now();
const HT = api.relief();
let bad = 0, hmin = Infinity, hmax = -Infinity;
for (let i = 0; i < HT.length; i++) { const v = HT[i]; if (!isFinite(v)) bad++; else { hmin = Math.min(hmin, v); hmax = Math.max(hmax, v); } }
verifier("relief sans valeur invalide", bad === 0, bad);
verifier("le fleuve est sous l'eau et les hauteurs restent plausibles (Copernicus, 0 à 110 m)", hmin < 0 && hmax > 80 && hmax < 130, hmin.toFixed(1) + " à " + hmax.toFixed(1));
const haut = api.H(150, 34), bas = api.H(300, 34);
verifier("la falaise du Cap Diamant : plus de 45 m entre la terrasse et le Petit-Champlain, en moins de 150 m", haut - bas > 45 && haut > 50 && bas < 15, haut.toFixed(1) + " / " + bas.toFixed(1));
verifier("la Citadelle est sur le point le plus haut du cap", api.H(0, -470) > 85, api.H(0, -470).toFixed(1));
verifier("le fleuve Saint-Laurent est de l'eau", api.H(650, -170) < 0 && api.H(780, 400) < 0);
const M = api.batir();
let nan = 0;
for (let i = 0; i < M.vol.f.length; i++) if (!isFinite(M.vol.f[i])) nan++;
for (let i = 0; i < M.arbres.f.length; i++) if (!isFinite(M.arbres.f[i])) nan++;
verifier("géométrie sans coordonnée invalide (NaN)", nan === 0, nan);
verifier("bâtiments, remparts et toits construits (plus de 30 000 triangles)", M.vol.n / 3 > 30000 && M.emprises.length > 1200, Math.round(M.vol.n / 3) + " triangles, " + M.emprises.length + " bâtiments");
verifier("arbres des parcs et de la falaise", M.arbres.n > 1000 && M.arbres.n <= 4200, M.arbres.n);
let mauvaisesNormales = 0;
for (let i = 0; i < M.vol.f.length; i += 6 * 37) { const l = Math.hypot(M.vol.f[i + 3], M.vol.f[i + 4], M.vol.f[i + 5]); if (Math.abs(l - 1) > 1e-3) mauvaisesNormales++; }
verifier("les normales des volumes sont unitaires", mauvaisesNormales === 0, mauvaisesNormales);
const T = api.terrain(), C = api.couronne();
const okIdx = (m) => { const n = m.pos.length / 3; for (let i = 0; i < m.idx.length; i++) if (m.idx[i] >= n) return false; for (let i = 0; i < m.pos.length; i++) if (!isFinite(m.pos[i])) return false; return true; };
verifier("terrain et couronne : indices valides, aucune valeur invalide", okIdx(T) && okIdx(C));
verifier("le terrain reste léger (moins de 260 000 triangles en tout)", T.ntri + C.ntri < 260000, T.ntri + C.ntri);
verifier("la construction reste rapide", Date.now() - t0 < 4000, (Date.now() - t0) + " ms");
// Les 13 lieux : chaque numéro est sur son objet réel (bâtiment, rempart ou zone du sol).
const Z = api.zones();
function zoneEn(x, y) {
  const S = { x0: -800, y1: 920, x1: 800 }, k = Z.w / (S.x1 - S.x0);
  const i = Math.floor((x - S.x0) * k), j = Math.floor((S.y1 - y) * k);
  return Math.round(Z.t[j * Z.w + i] / 17);
}
const proches = lieux.map((l) => {
  let m = Infinity;
  for (let v = 0; v < M.vol.n; v += 3) {
    if (M.vol.o[v * 8 + 4] !== l.num) continue;
    const x = M.vol.f[v * 6], y = -M.vol.f[v * 6 + 2];
    const d = Math.hypot(x - l.ancre[0], y - l.ancre[1]);
    if (d < m) m = d;
  }
  return m;
});
const situes = lieux.map((l, i) => proches[i] < 45 || zoneEn(l.ancre[0], l.ancre[1]) === l.num);
verifier("les 13 lieux sont situés sur leur objet réel (bâtiment, rempart, funiculaire ou zone)", situes.every(Boolean), lieux.filter((l, i) => !situes[i]).map((l) => l.id).join());
verifier("la place d'Armes est juste devant le Château Frontenac", (() => { const a = lieux[2].ancre, f = lieux[7].ancre; return a[1] > f[1] && Math.hypot(a[0] - f[0], a[1] - f[1]) < 120 && zoneEn(a[0], a[1]) === 3; })());
verifier("la maison Jacquet est rue Saint-Louis, près de la rue des Jardins", (() => { const a = lieux[3].ancre; return Math.abs(a[0] - 8) < 20 && Math.abs(a[1] - 28) < 20; })(), lieux[3].ancre.join());
verifier("la terrasse Dufferin longe la falaise, devant le Château", zoneEn(lieux[6].ancre[0], lieux[6].ancre[1]) === 7 && lieux[6].ancre[0] > lieux[7].ancre[0]);
verifier("les zones du sol couvrent la place Royale, la place d'Armes, la terrasse et la Citadelle", [1, 3, 7, 6].every((n) => Z.t.some((v) => Math.round(v / 17) === n)));
const vuesL = api.vues();
verifier("chaque lieu a sa vue (cible, distance, lacet, tangage)", lieux.every((l) => vuesL[l.id] && vuesL[l.id].every((v) => isFinite(v)) && vuesL[l.id][2] > 100));
verifier("vue d'ensemble de trois quarts depuis le fleuve (caméra à l'est-sud-est)", api.ensemble[3] > 50 && api.ensemble[3] < 90 && api.ensemble[4] > 15 && api.ensemble[4] < 40);
verifier("le composant reste léger (moins de 500 Ko)", Buffer.byteLength(composant, "utf8") < 500 * 1024, (Buffer.byteLength(composant, "utf8") / 1024).toFixed(1) + " Ko");

console.log("ÉTIQUETTES CALMES");
function extraire(src, nom) {
  const i = src.indexOf("function " + nom + "(");
  if (i < 0) return null;
  for (let k = src.indexOf("{", i), prof = 0; k < src.length; k++) {
    if (src[k] === "{") prof++;
    else if (src[k] === "}" && --prof === 0) return src.slice(i, k + 1);
  }
  return null;
}
const srcApres = extraire(script, "apresRendu"), srcDisposer = extraire(script, "disposer"), srcMontrer = extraire(script, "montrer");
const srcRepos = extraire(script, "auRepos"), srcAttendre = extraire(script, "attendreRepos");
verifier("les fonctions des étiquettes se trouvent dans le script", !!srcApres && !!srcDisposer && !!srcMontrer && !!srcRepos && !!srcAttendre);
if (srcApres && srcRepos && srcAttendre) {
  const simuler = new Function("etat", `
    var cam = etat.cam, svg = null, etiquettes = [], W_ = 0, H_ = 0, sigCam = "", minuteurRepos = null, enMouvement = false, dejaPlacees = false;
    var dernierMouvement = 0, vol = null, pointeurs = etat.pointeurs;
    var toile = { clientWidth: 800, clientHeight: 500 }, appels = { disposer: 0, poser: 0, minuteurs: 0 };
    var performance = { now: function () { return etat.t; } };
    function hautLibre() { return 40; }
    function poser() { appels.poser++; }
    function disposer() { appels.disposer++; }
    function clearTimeout(id) { etat.minuteurs = etat.minuteurs.filter(function (m) { return m.id !== id; }); }
    function setTimeout(f, ms) { appels.minuteurs++; var id = ++etat.n; etat.minuteurs.push({ id: id, t: etat.t + ms, f: f }); return id; }
    ${srcApres}
    ${srcRepos}
    ${srcAttendre}
    return { apres: apresRendu, appels: appels };`);
  const etat = { cam: { x: 0, y: 0, d: 900, lacet: 0, tangage: 37, h: 0 }, pointeurs: {}, t: 0, n: 0, minuteurs: [] };
  const avancer = (ms) => { const fin = etat.t + ms; for (;;) { const m = etat.minuteurs.filter((q) => q.t <= fin).sort((a, b) => a.t - b.t)[0]; if (!m) break; etat.t = m.t; etat.minuteurs = etat.minuteurs.filter((q) => q !== m); m.f(); } etat.t = fin; };
  const S = simuler(etat);
  S.apres(null);
  etat.pointeurs[1] = { x: 0, y: 0 };
  for (let i = 1; i <= 20; i++) { etat.cam.lacet += 2; etat.cam.d *= 0.99; S.apres(null); avancer(300); }
  verifier("pendant 20 images de glisser (même lentes), aucun nouveau placement : les étiquettes suivent leur point",
    S.appels.disposer === 1 && S.appels.poser === 21, JSON.stringify(S.appels));
  avancer(1000);
  verifier("tant que le doigt reste appuyé, le placement attend", S.appels.disposer === 1, JSON.stringify(S.appels));
  delete etat.pointeurs[1];
  avancer(600);
  verifier("au repos (doigt levé, caméra immobile), un seul placement", S.appels.disposer === 2, JSON.stringify(S.appels));
  for (let i = 0; i < 3; i++) { S.apres(null); avancer(16); }
  avancer(1000);
  verifier("une image sans mouvement ne relance rien", S.appels.disposer === 2, JSON.stringify(S.appels));
}
{
  const srcActive = extraire(script, "active"), srcPermis = extraire(script, "permis"), srcVisible = extraire(script, "visible"), srcEtat = extraire(script, "etatEtiquettes");
  verifier("les règles d'affichage des étiquettes se trouvent dans le script", !!srcActive && !!srcPermis && !!srcVisible && !!srcEtat);
  if (srcActive && srcPermis && srcVisible) {
    const regle = new Function("etat", `var filtre = etat.filtre, choisi = etat.choisi, activite = etat.activite; ${srcActive} ${srcPermis} ${srcVisible} return visible;`);
    const etiq = (l, dedans) => ({ l, dedans });
    const vis = (filtre, choisi, activite, dedans) => lieux.filter((l) => regle({ filtre, choisi, activite })(etiq(l, dedans === undefined ? true : dedans))).map((l) => l.num).join();
    verifier("sans filtre, les 13 étiquettes sont affichées", vis("tous", null, null) === "1,2,3,4,5,6,7,8,9,10,11,12,13", vis("tous", null, null));
    verifier("filtre Régime britannique : seules les étiquettes des lieux créés par les Britanniques restent", vis("br", null, null) === "6,10,11", vis("br", null, null));
    verifier("filtre Régime français : les lieux créés plus tard (terrasse, musée, funiculaire) disparaissent", vis("fr", null, null) === "1,2,3,4,5,9", vis("fr", null, null));
    verifier("filtre Période contemporaine : quatre étiquettes", vis("co", null, null) === "7,8,12,13", vis("co", null, null));
    verifier("une étiquette hors du cadre reste cachée", vis("tous", null, null, false) === "");
    verifier("pendant l'activité, seule l'étiquette du lieu demandé paraît", vis("tous", null, { ordre: [lieux[4]], i: 0 }) === "5");
  }
  verifier("un changement de filtre cache ou montre les étiquettes tout de suite (pas au prochain mouvement)",
    !!srcEtat && /montrer\(e, visible\(e\)\)/.test(srcEtat) && /e\.neuf = true/.test(srcEtat) && !!srcApres && /montrer\(e, visible\(e\)\)/.test(srcApres));
  verifier("une étiquette qui réapparaît se pose à sa place sans glisser depuis l'ancienne", !!srcDisposer && /e\.de = e\.neuf \? c\.off\.slice\(\) : e\.off\.slice\(\)/.test(srcDisposer));
  verifier("avec les couleurs des régimes, seuls les lieux de la période filtrée gardent leur couleur",
    /"bool gardee\(int p\) \{ return uFiltre == 0 \|\| \(\(uFiltre >> p\) & 1\) == 1; \}"/.test(script) && /ip > 0 && gardee\(ip\)/.test(script) && /iz > 0 && gardee\(iz\)/.test(script) && /\|\| !gardee\(ip\)\)/.test(script) &&
    /if \(code !== "tous"\) \{ garde\.forEach\(function \(n\) \{ masqueFiltre \|= 1 << n; \}\); \}/.test(script) && /gl\.uniform1i\(p\.u\.uFiltre, masqueFiltre\)/.test(script));
  verifier("survol et clic sur la maquette ignorent les lieux cachés par le filtre",
    /if \(activite \|\| \(id && !permis\(LIEUX\[id - 1\]\)\)\) \{ id = 0; \}/.test(script) && /if \(id && permis\(LIEUX\[id - 1\]\)\) \{ choisir\(LIEUX\[id - 1\]\.id\); \}/.test(script));
}
verifier("le placement garde d'abord la place actuelle, puis essaie d'autres places, puis le seul numéro",
  !!srcDisposer && /ajouter\(\[e\.cible\], false\)/.test(srcDisposer) && /ajouter\(PRES, true\)/.test(srcDisposer) && /est-compact/.test(srcDisposer));
verifier("le glissement vers une nouvelle place est doux (0,28 s), sans redessiner la maquette", !!srcDisposer && /\/ 280\)/.test(srcDisposer));
verifier("les étiquettes apparaissent et disparaissent en fondu, jamais par bascule brusque",
  !!srcMontrer && /classList\.toggle\("est-visible"/.test(srcMontrer) && /\.vqc \.vqc__ancre \{[^}]*transition: opacity/.test(composant) && !/visibility\s*=\s*[^;]*hidden/.test(script));
verifier("le numéro porte la couleur du régime d'origine et un anneau pour les régimes suivants", /conic-gradient/.test(script) && /vqc__num--['"] \+ l\.o/.test(script));

console.log("ZOOM À LA MOLETTE ET RECADRAGE");
{
  const doit = api.molettePourMaquette, facteur = api.facteurMolette;
  verifier("les règles de la molette sont accessibles", typeof doit === "function" && typeof facteur === "function");
  const roue = (o) => Object.assign({ ctrlKey: false, metaKey: false, deltaY: 100, deltaMode: 0 }, o);
  verifier("molette seule sur la maquette, page immobile : on zoome", doit(roue(), false, 10000, 9000) === true);
  verifier("la page défilait il y a 150 ms : on la laisse défiler (pas de piège)", doit(roue(), false, 10000, 9850) === false);
  verifier("garde-fou de 400 ms", doit(roue(), false, 10000, 9601) === false && doit(roue(), false, 10000, 9600) === true);
  verifier("Ctrl + molette ou pincement : on zoome même juste après un défilement", doit(roue({ ctrlKey: true }), false, 10000, 9990) === true);
  verifier("en plein écran, la molette zoome toujours", doit(roue(), true, 10000, 9990) === true);
  const f1 = facteur(roue()), f2 = facteur(roue({ deltaY: -100 })), f3 = facteur(roue({ deltaY: 3, deltaMode: 1 })), fx = facteur(roue({ deltaY: 5000 }));
  verifier("pas doux : un cran éloigne d'environ 15 %", f1 > 1.1 && f1 < 1.2, f1.toFixed(3));
  verifier("le cran inverse rapproche d'autant", Math.abs(f1 * f2 - 1) < 1e-9);
  verifier("une molette réglée en lignes (Firefox) donne le même pas", Math.abs(f3 - f1) < 0.01, f3.toFixed(3));
  verifier("un grand coup de molette reste borné", fx <= Math.exp(240 * 0.0014) + 1e-9, fx.toFixed(3));
  verifier("la molette de la maquette bloque le défilement (preventDefault, non passive) et la page est surveillée",
    /scene\.addEventListener\("wheel", function \(e\) \{\s*if \(!molettePourMaquette\(e, estPleinEcran\(\)/.test(script) &&
    /e\.preventDefault\(\);\s*vol = null;\s*var b = toile\.getBoundingClientRect\(\);\s*zoomer\(facteurMolette\(e\)/.test(script) &&
    /\}, \{ passive: false \}\)/.test(script) &&
    /window\.addEventListener\("wheel", noterDefilement, \{ passive: true, capture: true \}\)/.test(script));
  verifier("l'aide annonce le zoom à la molette seule", /Molette pour zoomer/.test(un(".vqc__aide").textContent) && !/Ctrl/.test(un(".vqc__aide").textContent));
  const srcRedim = extraire(script, "surRedim");
  verifier("le cadrage est gardé quand la toile change de forme (plein écran, rotation)", !!srcRedim && /facteurAspect\(\)/.test(srcRedim) && /cam\.d \*= r/.test(srcRedim) && /new ResizeObserver\(surRedim\)\.observe\(toile\)/.test(script));
}

console.log("TYPOGRAPHIE DES TEXTES");
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script").forEach((n) => n.remove());
const textes = lieux.map((l) => [l.nom, l.quand].concat(l.texte, [l.suite]).join(" ")).join(" ") + " " + copie.textContent;
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(textes));
verifier("aucune virgule devant « et »", !/, et /.test(textes));
verifier("espace insécable avant le deux-points", !/[^ \s]:(?![\d/])/.test(textes) && !/\w :/.test(textes), (textes.match(/.{20}[^ \s]:(?![\d/]).{5}/) || [""])[0]);
verifier("aucune espace avant ; ! ?", !/[  ][;!?]/.test(textes), (textes.match(/.{20}[  ][;!?].{5}/) || [""])[0]);

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
