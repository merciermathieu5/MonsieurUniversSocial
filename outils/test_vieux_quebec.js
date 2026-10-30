/*
 * Test de la maquette 3D du Vieux-Québec (fiche de géographie 03) dans un DOM simulé.
 *     node outils/test_vieux_quebec.js [composant.html]
 *
 * Le DOM simulé n'a pas de WebGL : on vérifie donc le mode de secours, la liste des 19 lieux, les
 * panneaux, le filtre par période de création, les couleurs des régimes, l'activité et sa rétroaction, les
 * textes, puis la construction de la maquette sans carte graphique (relief et falaise, bâtiments,
 * arbres, aucune coordonnée invalide, 19 lieux bien situés, funiculaire et ses gares, église, portes percées), la désélection,
 * le bouton Réinitialiser et les règles des étiquettes calmes, de
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
// Éléments présentés dans la fiche (sections et photos) : tous doivent être dans la maquette.
const DE_LA_FICHE = SEPT.concat(["notre-dame-victoires", "frontenac", "porte-saint-louis", "porte-saint-jean", "porte-prescott", "seminaire", "funiculaire", "petit-champlain", "terminal"]);
const RETIRES = ["casse-cou", "musee"];
const N = 19;

console.log("MISE EN PLACE");
verifier("composant présent", !!racine && !!api);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.vqc === api && tous(".vqc__ancre").length === 0);
verifier("l'entête se termine par __entete (bouton Plein écran de page.js)", !!un(".vqc__entete"));
if (fs.existsSync(pageJs)) verifier("page.js ajoute le bouton Plein écran dans l'entête", !!un(".vqc__entete .plein-ecran"));
verifier("sans WebGL : mode de secours", racine.classList.contains("sans-3d") && !un(".vqc__secours").hidden);
verifier("le message de secours est rempli", un(".vqc__secours-texte").textContent.length > 60);
const boutons = tous(".vqc__lieu");
const lieux = api.lieux;
verifier("19 lieux dans la liste", boutons.length === N, boutons.length);
verifier("19 lieux dans les données, numérotés dans l'ordre", lieux.length === N && lieux.every((l, i) => l.num === i + 1 && boutons[i].getAttribute("data-lieu") === l.id));
const bouton = (id) => boutons.find((b) => b.getAttribute("data-lieu") === id);
const num = (id) => lieux.find((l) => l.id === id).num;
verifier("tous les éléments présentés dans la fiche sont dans la maquette", DE_LA_FICHE.every((id) => lieux.some((l) => l.id === id)), DE_LA_FICHE.filter((id) => !lieux.some((l) => l.id === id)).join());
verifier("la liste est regroupée par section de la fiche (4 groupes nommés)", tous(".vqc__choix .vqc__groupe").length === 4 && tous(".vqc__choix ul.vqc__lieux").length === 4);
const REGIMES_VERIFIES = { "notre-dame-victoires": ["fr", "br,co"], "porte-saint-louis": ["fr", "co"], "porte-saint-jean": ["fr", "co"], "porte-prescott": ["br", "co"],
  "petit-champlain": ["fr", "br,co"], "terminal": ["co", ""], "funiculaire": ["co", "fr"], "place-royale": ["fr", "br,co"] };
verifier("régime de création et transformations des nouveaux lieux (d'après les sources)", Object.keys(REGIMES_VERIFIES).every((id) => { const l = lieux.find((x) => x.id === id); return l.o === REGIMES_VERIFIES[id][0] && l.t.join() === REGIMES_VERIFIES[id][1]; }));
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
clic(bouton("citadelle"));
verifier("choisir la Citadelle affiche son nom", /La Citadelle/.test(texteContenu()));
verifier("le bouton choisi est enfoncé", bouton("citadelle").getAttribute("aria-pressed") === "true" && boutons.filter((b) => b.getAttribute("aria-pressed") === "true").length === 1);
verifier("le régime d'origine et les transformations sont nommés", /Régime britannique/.test(texteContenu()) && /Période contemporaine/.test(texteContenu()) && /création/.test(texteContenu()));
verifier("le lieu choisi est mis en évidence sur la maquette", api.etat().choisi === "citadelle" && api.etat().marques.join() === String(num("citadelle")));
clic(boutons[0]);
verifier("choisir la place Royale remplace le texte", /La place Royale/.test(texteContenu()) && /Continuité et changement/.test(texteContenu()));
clic(bouton("frontenac"));
verifier("un lieu sans transformation affiche « À retenir »", /Le Château Frontenac/.test(texteContenu()) && /À retenir/.test(texteContenu()));
clic(un(".vqc__retour"));
verifier("le bouton de retour ramène l'accueil", /Trois régimes dans les mêmes rues/.test(texteContenu()) && api.etat().choisi === null);

console.log("DÉSÉLECTION ET RÉINITIALISATION");
clic(bouton("ursulines"));
clic(bouton("ursulines"));
verifier("un second clic sur un lieu de la liste le désélectionne (accueil, aucune surbrillance)",
  api.etat().choisi === null && api.etat().marques.length === 0 && bouton("ursulines").getAttribute("aria-pressed") === "false" && /Trois régimes dans les mêmes rues/.test(texteContenu()));
verifier("la désélection est annoncée", un(".vqc__annonce").textContent === "Retour à l'accueil de la maquette", un(".vqc__annonce").textContent);
clic(bouton("ursulines")); clic(bouton("seminaire"));
verifier("choisir un autre lieu remplace le premier (un seul bouton enfoncé)", api.etat().choisi === "seminaire" && boutons.filter((b) => b.getAttribute("aria-pressed") === "true").length === 1);
clic(bouton("seminaire"));
verifier("puis un second clic sur ce lieu revient à l'accueil", api.etat().choisi === null);
verifier("la vue d'avant le premier choix est gardée, puis oubliée après le retour", (() => { const src = script; return /if \(l && !choisi && !sansVol && gl\) \{ vueAvant = \[cam\.x, cam\.y, cam\.d \/ facteurAspect\(\), cam\.lacet, cam\.tangage, cam\.h\]; \}/.test(src) && /function revenir\(\) \{\s*var vue = vueAvant;\s*choisir\(null\);\s*if \(gl\) \{ allerA\(vue \|\| ENSEMBLE\); \}/.test(src); })() && api.etat().vueAvant === null);
verifier("Échap sur la maquette désélectionne aussi", /k === "Escape" && choisi && !activite\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); revenir\(\); return; \}/.test(script));
verifier("l'étiquette d'un lieu et la maquette basculent aussi le choix", /b\.addEventListener\("click", function \(\) \{ if \(activite\) \{ return; \} basculer\(l\.id\); \}\);/.test(script) && /if \(id && permis\(LIEUX\[id - 1\]\)\) \{ basculer\(LIEUX\[id - 1\]\.id\); \}/.test(script));
const btReinit = un(".vqc__entete .reinitialiser");
verifier("page.js pose le bouton Réinitialiser (data-reinitialiser) avant Plein écran", racine.hasAttribute("data-reinitialiser") && (!fs.existsSync(pageJs) || (!!btReinit && btReinit.nextElementSibling === un(".vqc__entete .plein-ecran"))));
// plusieurs actions, puis Réinitialiser
clic(un('.vqc__filtre[data-filtre="br"]')); clic(un(".vqc__couleurs")); clic(bouton("morrin"));
un(".vqc__contenu").scrollTop = 120;
if (btReinit) clic(btReinit); else racine.dispatchEvent(new window.CustomEvent("reinitialiser"));
verifier("Réinitialiser : filtre Tous les régimes, couleurs naturelles, aucun lieu, accueil",
  api.etat().filtre === "tous" && api.etat().regime === 0 && api.etat().choisi === null && api.etat().marques.length === 0 &&
  un('.vqc__filtre[data-filtre="tous"]').getAttribute("aria-pressed") === "true" && un(".vqc__couleurs").getAttribute("aria-pressed") === "false" &&
  !boutons.some((b) => b.classList.contains("est-atenue") || b.getAttribute("aria-pressed") === "true") && /Trois régimes dans les mêmes rues/.test(texteContenu()) && un(".vqc__contenu").scrollTop === 0);
verifier("Réinitialiser est annoncé", un(".vqc__annonce").textContent === "Maquette réinitialisée");
clic(un(".vqc__activite-lancer"));
racine.dispatchEvent(new window.CustomEvent("reinitialiser"));
verifier("Réinitialiser quitte aussi l'activité", !api.etat().activite && un(".vqc__bandeau").hidden && !un(".vqc__activite-lancer").hidden);
verifier("Réinitialiser ramène la caméra à la vue d'ensemble", /function reinitialiser\(\) \{[\s\S]{0,300}allerA\(ENSEMBLE/.test(script));

console.log("FILTRE PAR PÉRIODE DE CRÉATION");
verifier("la barre du filtre annonce la période de création", /Période de création/.test(un(".vqc__barre-nom").textContent) && /période de création/.test(un(".vqc__barre").getAttribute("aria-label")));
const parPeriode = { fr: [1, 2, 3, 4, 5, 6, 10, 11, 13, 15], br: [7, 12, 17, 18], co: [8, 9, 14, 16, 19] };
["fr", "br", "co"].forEach((code) => {
  clic(un(`.vqc__filtre[data-filtre="${code}"]`));
  const garde = lieux.filter((l) => l.o === code).map((l) => l.num);
  const attenues = boutons.filter((b) => b.classList.contains("est-atenue")).map((b, i) => b.getAttribute("data-lieu"));
  verifier(`${code} : seuls les lieux créés pendant cette période restent (${garde.join(", ")})`,
    api.etat().marques.join() === garde.join() && garde.join() === parPeriode[code].join() && api.etat().focus === 1, api.etat().marques.join());
  verifier(`${code} : les autres lieux sont atténués dans la liste`, attenues.length === N - garde.length && lieux.every((l) => attenues.includes(l.id) === (l.o !== code)));
});
verifier("un lieu seulement transformé par la période n'est pas retenu (Ursulines, créé sous le régime français)", (() => { clic(un('.vqc__filtre[data-filtre="br"]')); return api.etat().marques.indexOf(num("ursulines")) < 0; })());
verifier("le bouton du filtre est enfoncé", un('.vqc__filtre[data-filtre="br"]').getAttribute("aria-pressed") === "true" && un('.vqc__filtre[data-filtre="tous"]').getAttribute("aria-pressed") === "false");
verifier("le filtre est annoncé aux lecteurs d'écran", un(".vqc__annonce").textContent === "Lieux créés pendant le régime britannique", un(".vqc__annonce").textContent);
clic(bouton("citadelle"));
verifier("choisir un lieu de la période filtrée garde le filtre", api.etat().filtre === "br" && api.etat().choisi === "citadelle" && api.etat().marques.join() === String(num("citadelle")));
clic(un(".vqc__retour"));
verifier("revenir à l'accueil garde le filtre et ses lieux", api.etat().filtre === "br" && api.etat().choisi === null && api.etat().marques.join() === parPeriode.br.join());
clic(boutons[0]);
verifier("choisir dans la liste un lieu d'une autre période ramène tous les régimes",
  api.etat().filtre === "tous" && api.etat().choisi === "place-royale" && un('.vqc__filtre[data-filtre="tous"]').getAttribute("aria-pressed") === "true" && !boutons.some((b) => b.classList.contains("est-atenue")));
clic(un(".vqc__retour"));
clic(un('.vqc__filtre[data-filtre="co"]'));
clic(bouton("frontenac"));
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
verifier("une partie compte 12 lieux tirés au hasard parmi les 19", api.etat().nbQuestions === 12 && /Lieu 1 sur 12/.test(texteContenu()));
for (let i = 0; i < 12; i++) {
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
verifier("12 bonnes réponses quand on répond juste", bons === 12, bons);
verifier("le bilan s'affiche", /12 bonnes réponses sur 12/.test(texteContenu()));
clic(un(".vqc__quitter"));
verifier("quitter l'activité revient à l'accueil et rétablit les couleurs naturelles", /Trois régimes dans les mêmes rues/.test(texteContenu()) && api.etat().regime === 0 && !api.etat().activite && un(".vqc__bandeau").hidden);
clic(un(".vqc__activite-lancer"));
const nom1 = un(".vqc__contenu .vqc__nom").textContent, lieu1 = lieux.find((l) => l.nom === nom1);
const faux = ["fr", "br", "co"].find((c) => c !== lieu1.o);
clic(un(`.vqc__reponse[data-reponse="${faux}"]`));
verifier("une mauvaise réponse est signalée et la bonne est montrée", /Pas tout à fait\./.test(un(".vqc__retro").textContent) && un(`.vqc__reponse[data-reponse="${faux}"]`).classList.contains("est-faux") && un(`.vqc__reponse[data-reponse="${lieu1.o}"]`).classList.contains("est-juste"));
clic(bouton("place-armes"));
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
// Les 19 lieux : chaque numéro est sur son objet réel (bâtiment, rempart ou zone du sol).
const Z = api.zones();
function zoneEn(x, y) {
  const S = { x0: -800, y1: 920, x1: 800 }, k = Z.w / (S.x1 - S.x0);
  const i = Math.floor((x - S.x0) * k), j = Math.floor((S.y1 - y) * k);
  return Math.round(Z.t[j * Z.w + i] / 12);
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
verifier("les 19 lieux sont situés sur leur objet réel (bâtiment, rempart, funiculaire ou zone)", situes.every(Boolean), lieux.filter((l, i) => !situes[i]).map((l) => l.id).join());
verifier("la place d'Armes est juste devant le Château Frontenac", (() => { const a = lieux[num("place-armes") - 1].ancre, f = lieux[num("frontenac") - 1].ancre; return a[1] > f[1] && Math.hypot(a[0] - f[0], a[1] - f[1]) < 120 && zoneEn(a[0], a[1]) === num("place-armes"); })());
verifier("la maison Jacquet est rue Saint-Louis, près de la rue des Jardins", (() => { const a = lieux[num("maison-jacquet") - 1].ancre; return Math.abs(a[0] - 8) < 20 && Math.abs(a[1] - 28) < 20; })(), lieux[num("maison-jacquet") - 1].ancre.join());
verifier("la terrasse Dufferin longe la falaise, devant le Château", (() => { const t = lieux[num("terrasse") - 1].ancre, f = lieux[num("frontenac") - 1].ancre; return zoneEn(t[0], t[1]) === num("terrasse") && t[0] > f[0]; })());
verifier("les zones du sol couvrent la place Royale, la place d'Armes, la terrasse, la Citadelle, la rue du Petit-Champlain", ["place-royale", "place-armes", "terrasse", "citadelle", "petit-champlain"].every((id) => Z.t.some((v) => Math.round(v / 12) === num(id))));
verifier("la carte des zones code jusqu'à 21 lieux (numéro × 12, couleurs pour 21 lieux)", /t\[j \* w \+ i\] = z\[0\] \* 12;/.test(script) && (script.match(/255\.0 \/ 12\.0/g) || []).length === 2 && /uCoulLieu\[21\]/.test(script) && /new Float32Array\(63\)/.test(script));
// Le funiculaire : toute la voie, de la terrasse (en haut) à la maison Louis-Jolliet (en bas).
const zDe = (id) => { let zmin = Infinity, zmax = -Infinity, xs = []; for (let v = 0; v < M.vol.n; v++) { if (M.vol.o[v * 8 + 4] !== num(id)) continue; const z = M.vol.f[v * 6 + 1]; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); xs.push(M.vol.f[v * 6]); } return { zmin, zmax, n: xs.length, x0: Math.min(...xs), x1: Math.max(...xs) }; };
{
  // Édifice Price : tour Art déco d'environ 82 m, qui recule par paliers et finit en toit pointu
  const pts = [];
  for (let v = 0; v < M.vol.n; v++) if (M.vol.o[v * 8 + 4] === num("price")) pts.push([M.vol.f[v * 6], M.vol.f[v * 6 + 1], M.vol.f[v * 6 + 2]]);
  const zmin = Math.min(...pts.map((p) => p[1])), zmax = Math.max(...pts.map((p) => p[1])), h = zmax - zmin;
  const largeur = (a, b) => { const q = pts.filter((p) => p[1] >= zmin + a * h && p[1] <= zmin + b * h); return q.length ? Math.max(...q.map((p) => p[0])) - Math.min(...q.map((p) => p[0])) : 0; };
  const bas = largeur(0, 0.6), palier = largeur(0.76, 0.84), toit = largeur(0.95, 1);
  verifier("l'édifice Price est une tour d'environ 82 m (avec son épi)", pts.length > 50 && h > 75 && h < 100, h.toFixed(1) + " m");
  verifier("l'édifice Price recule par paliers et se termine en pointe", bas > 0 && palier < bas - 1.5 && toit < palier * 0.6, [bas, palier, toit].map((v) => v.toFixed(1)).join(" / "));
}
const fu = zDe("funiculaire");
verifier("funiculaire : une voie inclinée d'environ 55 m de dénivelé (fiche : 59 m), de la terrasse au Petit-Champlain", /\(S\.funi \|\| \[\]\)\.forEach\(function \(s\) \{ funiculaire\(lot, lirePoints\(s\)\); \}\);/.test(script) && fu.zmax - fu.zmin > 45 && fu.x1 - fu.x0 > 30, (fu.zmax - fu.zmin).toFixed(1) + " m, " + (fu.x1 - fu.x0).toFixed(1) + " m");
{
  // la voie du funiculaire est posée contre la falaise : ses rails ne passent jamais sous le relief
  let sous = 0, rails = 0, cab = 0;
  for (let v = 0; v < M.vol.n; v++) {
    if (M.vol.o[v * 8 + 4] !== num("funiculaire")) continue;
    const r = M.vol.o[v * 8], g = M.vol.o[v * 8 + 1], b = M.vol.o[v * 8 + 2];
    const x = M.vol.f[v * 6], y = -M.vol.f[v * 6 + 2], z = M.vol.f[v * 6 + 1];
    if (r === 91 && g === 85 && b === 80) { rails++; if (z < api.H(x, y) + 0.3) sous++; }
    if (r === 236 && g === 229 && b === 211) cab++;
  }
  verifier("funiculaire : quatre rails sur deux voies, jamais sous la falaise, et deux cabines au cadre crème", rails >= 4 * 6 * 30 && sous === 0 && cab >= 1000, rails + " sommets de rails, " + sous + " sous le relief, " + cab + " sommets crème");
}
const nd = zDe("notre-dame-victoires");
verifier("Notre-Dame-des-Victoires : un bâtiment à elle, avec pignon et clocheton au-dessus du faîte", nd.n > 60 && nd.zmax - nd.zmin > 22, (nd.zmax - nd.zmin).toFixed(1) + " m");
verifier("l'escalier du Casse-Cou et le Musée de la civilisation ne sont plus des lieux (ni liste, ni modèle d'escalier)",
  RETIRES.every((id) => !lieux.some((l) => l.id === id) && !un(`.vqc__lieu[data-lieu="${id}"]`)) && !/function escalier\(/.test(script) && !/Casse-Cou/.test(un(".vqc__source").textContent));
verifier("chaque porte et le terminal ont leur modèle", ["porte-saint-louis", "porte-saint-jean", "porte-prescott", "terminal"].every((id) => zDe(id).n > 20));
// Les portes : la rue passe dessous. Un rayon tiré le long de la rue, à hauteur d'une personne, ne touche
// aucun triangle de la maquette (ni la porte, ni un rempart, ni un bâtiment).
const DONNEES = JSON.parse(composant.split("\n").find((l) => l.trim().startsWith("var D = {")).trim().replace(/^var D = /, "").replace(/;\s*$/, ""));
function rayonLibre(O, Dir, L) {
  const f = M.vol.f;
  for (let t = 0; t < M.vol.n; t += 3) {
    const a = [f[t * 6], f[t * 6 + 1], f[t * 6 + 2]], b = [f[t * 6 + 6], f[t * 6 + 7], f[t * 6 + 8]], c = [f[t * 6 + 12], f[t * 6 + 13], f[t * 6 + 14]];
    if (Math.min(a[0], b[0], c[0]) > Math.max(O[0], O[0] + Dir[0] * L) + 0.01 || Math.max(a[0], b[0], c[0]) < Math.min(O[0], O[0] + Dir[0] * L) - 0.01) continue;
    if (Math.min(a[2], b[2], c[2]) > Math.max(O[2], O[2] + Dir[2] * L) + 0.01 || Math.max(a[2], b[2], c[2]) < Math.min(O[2], O[2] + Dir[2] * L) - 0.01) continue;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const p = [Dir[1] * e2[2] - Dir[2] * e2[1], Dir[2] * e2[0] - Dir[0] * e2[2], Dir[0] * e2[1] - Dir[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-9) continue;
    const s0 = [O[0] - a[0], O[1] - a[1], O[2] - a[2]], u = (s0[0] * p[0] + s0[1] * p[1] + s0[2] * p[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s0[1] * e1[2] - s0[2] * e1[1], s0[2] * e1[0] - s0[0] * e1[2], s0[0] * e1[1] - s0[1] * e1[0]];
    const w = (Dir[0] * q[0] + Dir[1] * q[1] + Dir[2] * q[2]) / det;
    if (w < 0 || u + w > 1) continue;
    const d = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (d >= 0 && d <= L) return false;
  }
  return true;
}
const portes = DONNEES.scene.portes || [];
verifier("trois portes modélisées à part (Saint-Louis, Saint-Jean, Prescott), pas en blocs pleins", portes.length === 3 && portes.map((p) => lieux[p[0] - 1].id).join() === "porte-saint-louis,porte-saint-jean,porte-prescott");
portes.forEach((p) => {
  const id = lieux[p[0] - 1].id, u = [p[3], p[4]], v = [-u[1], u[0]], hu = p[6], s0 = p[8], cv = p[9];
  const cx = p[1] + v[0] * (cv + s0), cy = p[2] + v[1] * (cv + s0), zr = api.H(cx, cy);
  const libre = [1.2, 2.2].every((hz) => rayonLibre([cx - u[0] * (hu + 2), zr + hz, -(cy - u[1] * (hu + 2))], [u[0], 0, -u[1]], 2 * hu + 4));
  const porteLa = !rayonLibre([cx - v[0] * 14, zr + (p[7] === 3 ? 6.6 : 8.6), -(cy - v[1] * 14)], [v[0], 0, -v[1]], 28);
  verifier(`${id} : la rue passe dessous (rien à 1,2 m ni à 2,2 m du sol) et la porte est bien là, au-dessus`, libre && porteLa, "libre " + libre + ", porte " + porteLa);
});
verifier("Saint-Louis : tourelles en poivrière; Saint-Jean : tourelles crénelées; Prescott : passerelle entre deux culées",
  /tourelle\(dExt \* \(hu \+ 0\.7\), sg \* \(hv - 1\.2\), zr \+ 4\.5, zT \+ 1\.8, sorte === 1\)/.test(script) && /if \(sorte === 3\) \{/.test(script) && /creneaux\(/.test(script));
verifier("le quartier du Petit-Champlain regroupe les maisons de la rue", zDe("petit-champlain").n > 500, zDe("petit-champlain").n);
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
    verifier("sans filtre, les 19 étiquettes sont affichées", vis("tous", null, null) === lieux.map((l) => l.num).join(), vis("tous", null, null));
    verifier("filtre Régime britannique : seules les étiquettes des lieux créés par les Britanniques restent", vis("br", null, null) === "7,12,17,18", vis("br", null, null));
    verifier("filtre Régime français : les lieux créés plus tard (terrasse, funiculaire, terminal) disparaissent", vis("fr", null, null) === "1,2,3,4,5,6,10,11,13,15", vis("fr", null, null));
    verifier("filtre Période contemporaine : cinq étiquettes (avec l'édifice Price)", vis("co", null, null) === "8,9,14,16,19", vis("co", null, null));
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
    /if \(activite \|\| \(id && !permis\(LIEUX\[id - 1\]\)\)\) \{ id = 0; \}/.test(script) && /if \(id && permis\(LIEUX\[id - 1\]\)\) \{ basculer\(LIEUX\[id - 1\]\.id\); \}/.test(script));
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
