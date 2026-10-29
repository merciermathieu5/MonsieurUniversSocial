/*
 * Test de la maquette 3D de l'aqueduc romain dans un DOM simulé.
 *     node outils/test_aqueduc_romain.js [composant.html]
 *
 * Le DOM simulé n'a pas de WebGL : on vérifie donc le mode de secours, les boutons, les
 * panneaux, les outils (pente exagérée, eau dans le canal, siphon), la visite qui suit l'eau,
 * les textes, puis la construction de la maquette sans carte graphique (géométrie, eau,
 * terrain, carte des zones) et les règles de la pente, des étiquettes calmes et de la
 * molette. Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "aqueduc-romain.html");
const composant = fs.readFileSync(fichier, "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La romanisation</h2>
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
const racine = document.getElementById("aqueduc-romain");
const api = racine && racine.aqueduc;
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
const panneauxVisibles = () => tous(".aqu__panneau.est-visible").map((p) => p.getAttribute("data-panneau"));
const presses = () => tous('.aqu__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-partie") || b.getAttribute("data-outil") || b.getAttribute("data-action"));
const ORDRE = ["source", "canal", "pente", "regards", "tranchee", "tunnel", "arcades", "pont", "castellum", "fontaines", "thermes", "maisons", "egouts"];
const PARTIES = ["", ...ORDRE, "chasse", "rampant", "pontSiphon", "fuite"];

console.log("MISE EN PLACE");
verifier("composant présent", !!racine && !!api);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.aqueduc === api);
verifier("sans WebGL : mode de secours", racine.classList.contains("sans-3d") && !un(".aqu__secours").hidden);
verifier("le message de secours est rempli", un(".aqu__secours-texte").textContent.length > 60);
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("aucun bouton enfoncé au départ", presses().length === 0, presses().join());
const boutonsParties = tous(".aqu__bouton[data-partie]");
verifier("13 parties à choisir, numérotées de 1 à 13, de la source aux égouts",
  boutonsParties.length === 13 && boutonsParties.map((b) => b.getAttribute("data-partie")).join() === ORDRE.join() &&
  boutonsParties.map((b) => un(".aqu__num", b).textContent).join() === "1,2,3,4,5,6,7,8,9,10,11,12,13");
verifier("trois outils pour mieux voir : pente exagérée, eau dans le canal, siphon",
  tous(".aqu__bouton--outil").map((b) => b.getAttribute("data-outil")).join() === "pente,coupe,siphon");
verifier("un bouton pour suivre l'eau, de la source à la ville", tous(".aqu__bouton--visite").length === 1);
verifier("16 panneaux : accueil, 13 parties, fin de la visite, siphon", tous(".aqu__panneau").length === 16, tous(".aqu__panneau").length);
verifier("chaque partie a son panneau", boutonsParties.every((b) => un(`.aqu__panneau[data-panneau="partie-${b.getAttribute("data-partie")}"]`)));
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune balise figure", tous("figure").length === 0);
verifier("la toile a un nom accessible", (un(".aqu__toile").getAttribute("aria-label") || "").length > 100);
verifier("les étiquettes et les traits de la maquette sont cachés aux lecteurs d'écran",
  un(".aqu__reperes").getAttribute("aria-hidden") === "true" && un(".aqu__traits").getAttribute("aria-hidden") === "true");
verifier("tous les boutons ont type=button", tous("button").every((b) => b.getAttribute("type") === "button"));
verifier("l'en-tête porte une classe en __entete (bouton Plein écran de page.js)", !!un(".aqu__entete"));
verifier("les listes du composant n'ont pas de puces (::before et ::marker neutralisés)",
  /\.aqu ul > li::before\s*\{[^}]*content:\s*none/.test(composant) && /\.aqu ul > li::marker\s*\{[^}]*content:\s*none/.test(composant));
verifier("une variante sombre est prévue", /data-sombre="on"\]\s*\.aqu|\[data-sombre="on"\] \.aqu/.test(composant));
verifier("le mouvement réduit est respecté (prefers-reduced-motion)", /prefers-reduced-motion/.test(composant));

console.log("CHOIX D'UNE PARTIE");
clic(un('.aqu__bouton[data-partie="castellum"]'));
verifier("le panneau du bassin de répartition s'affiche seul", panneauxVisibles().join() === "partie-castellum", panneauxVisibles().join());
verifier("son bouton est enfoncé, lui seul", presses().join() === "castellum", presses().join());
verifier("le choix est noté sur le composant", racine.getAttribute("data-choix") === "castellum");
verifier("la maquette est filtrée sur la partie choisie", racine.classList.contains("est-filtre"));
clic(un('.aqu__bouton[data-partie="pente"]'));
verifier("la partie « pente » allume la pente exagérée", api.etat3d.exagCible === 1 && /pente/.test(racine.getAttribute("data-outils")) && !un(".aqu__bandeau").hidden);
verifier("le bandeau rappelle la vraie descente", /12\s?m/.test(un(".aqu__bandeau").textContent) && /50\s?km/.test(un(".aqu__bandeau").textContent), un(".aqu__bandeau").textContent);
clic(un('.aqu__bouton[data-partie="pont"]'));
verifier("une autre partie éteint la pente exagérée", api.etat3d.exagCible === 0 && un(".aqu__bandeau").hidden);
const agir = un('.aqu__panneau.est-visible .aqu__agir[data-outil="siphon"]');
verifier("le panneau du pont propose la variante du siphon", !!agir);
clic(agir);
verifier("le siphon remplace le pont, avec son panneau et son bandeau",
  api.etat3d.siphon === true && panneauxVisibles().join() === "siphon" && /Lyon/.test(un(".aqu__bandeau").textContent), panneauxVisibles().join());
clic(un('.aqu__panneau.est-visible .aqu__retour[data-partie="pont"]'));
verifier("Revenir au pont du Gard enlève le siphon", api.etat3d.siphon === false && panneauxVisibles().join() === "partie-pont");
clic(un('.aqu__panneau.est-visible .aqu__retour'));
verifier("Revenir à l'accueil efface la mise en évidence", panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-filtre") && presses().length === 0);

console.log("OUTILS POUR MIEUX VOIR");
clic(un('.aqu__bouton--outil[data-outil="coupe"]'));
verifier("« Voir l'eau dans le canal » s'allume et s'éteint", api.etat3d.coupe === true && presses().join() === "coupe" &&
  (clic(un('.aqu__bouton--outil[data-outil="coupe"]')), api.etat3d.coupe === false && presses().length === 0));
clic(un('.aqu__bouton--outil[data-outil="pente"]'));
verifier("le bouton de la pente exagérée s'allume", api.etat3d.exagCible === 1 && presses().join() === "pente");
clic(un('.aqu__bouton--outil[data-outil="pente"]'));
verifier("puis s'éteint", api.etat3d.exagCible === 0 && presses().length === 0);

console.log("SUIVRE L'EAU");
clic(un(".aqu__bouton--visite"));
verifier("la visite commence à la source", panneauxVisibles().join() === "partie-source" && presses().sort().join() === "source,visite" && racine.classList.contains("est-visite"), presses().join());
verifier("le bouton Précédent est inactif à la première étape", un('.aqu__panneau.est-visible .aqu__precedent').disabled);
clic(un('.aqu__panneau.est-visible .aqu__suivant'));
verifier("Suivant passe au canal", panneauxVisibles().join() === "partie-canal");
clic(un('.aqu__panneau.est-visible .aqu__precedent'));
verifier("Précédent revient à la source", panneauxVisibles().join() === "partie-source");
const vus = [];
for (let i = 0; i < 13; i++) { vus.push(panneauxVisibles().join()); clic(un('.aqu__panneau.est-visible .aqu__suivant')); }
verifier("la visite suit l'eau dans l'ordre des 13 parties", vus.join() === ORDRE.map((c) => "partie-" + c).join(), vus.join());
verifier("la dernière étape pose une question", panneauxVisibles().join() === "visite-fin" && !!un('.aqu__panneau.est-visible .aqu__question'));
clic(un('.aqu__panneau.est-visible .aqu__terminer'));
verifier("Terminer revient à l'accueil", panneauxVisibles().join() === "accueil" && presses().length === 0 && !racine.classList.contains("est-visite"));
clic(un('.aqu__appel[data-action="visite"]'));
verifier("le bouton de l'accueil lance aussi la visite", panneauxVisibles().join() === "partie-source");
api.accueil();

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".aqu__entete > .plein-ecran");
verifier("le bouton Plein écran (posé par page.js) est dans l'en-tête", !!pleinBouton);
const texteBouton = un('.aqu__outil[data-action="texte"]');
verifier("le bouton qui replie les textes existe", !!texteBouton && texteBouton.getAttribute("aria-expanded") === "true");
verifier("les textes sont regroupés dans le panneau latéral", [".aqu__choix", ".aqu__contenu"].every((sel) => un(".aqu__cote > " + sel)));
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
  if (/[\u2014\u2013]/.test(t)) fautes.push("tiret long ou moyen");
  if (/, et /.test(t)) fautes.push("virgule devant « et »");
  if (/[ \u00a0\u202f][;!?]/.test(t)) fautes.push("espace avant ; ! ?");
  if (/[^\s]:(?!\d)|\w :/.test(t)) fautes.push("deux-points sans espace insécable");
  if (/«(?!\u00a0)|(?<!\u00a0)»/.test(t)) fautes.push("guillemets sans espace insécable");
  if (/\d \d{3}\b/.test(t)) fautes.push("nombre sans espace insécable");
  if (/\d (km|m|cm|m³|h|heures|ans|%)(?![a-zà-ÿ])/.test(t)) fautes.push("unité sans espace insécable");
  return fautes;
}
const copie = racine.cloneNode(true);
tous("style, script", copie).forEach((el) => el.remove());
const visible = copie.textContent;
const textes = tous(".aqu__panneau, .aqu__source, .aqu__credit, .aqu__consigne, .aqu__aide").map((e) => e.textContent).join("\n");
verifier("typographie des panneaux conforme", controleTexte(textes).length === 0, controleTexte(textes).join(", "));
verifier("le contrôle typographique détecte une faute volontaire",
  ["une phrase \u2014 fautive", "la source, et le canal", "Quoi ?", "ceci: cela", "\u00ab\u00a0mot\u00bb", "35 000 m³", "50 km"].every((t) => controleTexte(t).length > 0) &&
  controleTexte("Le pont mesure 48,77\u00a0m\u00a0: il a trois rangs d'arches, \u00ab\u00a0comme ceci\u00a0\u00bb.").length === 0);
verifier("aucun texte provisoire", !/à venir|TODO|XXX|lorem/i.test(visible));
const accueilTexte = un('[data-panneau="accueil"]').textContent;
verifier("l'accueil dit que c'est un aqueduc type, inspiré de Nîmes, aux distances raccourcies et aux ouvrages agrandis",
  /aqueduc romain type/.test(accueilTexte) && /Nîmes/.test(accueilTexte) && /raccourcit/.test(accueilTexte) && /ouvrages sont agrandis/.test(accueilTexte));
const source = un(".aqu__source").textContent;
verifier("la note des sources dit que les ouvrages sont agrandis (et non plus « vraies dimensions »)",
  /ouvrages sont agrandis/.test(source) && !/vraies dimensions/.test(source));
verifier("les sources citent le pont du Gard, l'UNESCO, Vitruve et le castellum", ["pont du Gard", "UNESCO", "Vitruve", "castellum"].every((m) => source.includes(m)));
verifier("crédit visible des arbres (Kenney, CC0) et source des modèles", /Kenney/.test(un(".aqu__credit").textContent) && /CC0/.test(un(".aqu__credit").textContent) && /kenney\.nl/.test(source));
verifier("chaque panneau de partie a un titre, son rôle et au moins un paragraphe",
  ORDRE.every((c) => { const p = un(`[data-panneau="partie-${c}"]`); return un(".aqu__role", p) && /Son rôle/.test(un(".aqu__role-texte", p).textContent) && un(".aqu__detail", p); }));
verifier("les faits clés sont présents : 50 km, 24,8 cm par km, 48,77 m, 3 rangs d'arches",
  /50\s?km/.test(visible) && /24,8\s?cm/.test(visible) && /48,77\s?m/.test(visible) && /trois rangs|3 rangs/.test(visible));
verifier("l'aide annonce le zoom à la molette seule", /Molette pour zoomer/.test(un(".aqu__aide").textContent) && !/Ctrl/.test(un(".aqu__aide").textContent));
verifier("l'ancien avis « garde la touche Ctrl » a disparu", !/garde la touche Ctrl/.test(composant) && !un(".aqu__avis"));

console.log("CONSTRUCTION DE LA MAQUETTE");
let t0 = Date.now();
const M = api.batir();
const duree = Date.now() - t0;
verifier("l'aqueduc se construit", M && M.vol && M.pont && M.dalles && M.eau && M.trace && M.siphon && M.boites && M.instances);
verifier("aucune valeur invalide dans les volumes, l'eau et les boîtes",
  ["vol", "dalles", "pont", "pontDalles", "siphon", "niveau"].every((k) => M[k].f.length && M[k].f.every((v) => Number.isFinite(v))) &&
  [M.eau.f, M.eauPont.f, M.trace.f, M.boites.f].every((f) => f.length && f.every((v) => Number.isFinite(v))));
verifier("chaque boîte a des dimensions positives", (() => { const f = M.boites.f; for (let i = 0; i < f.length; i += 7) { if (!(f[i + 4] > 0 && f[i + 5] > 0 && f[i + 6] > 0)) return false; } return true; })());
verifier("aucune valeur invalide dans les instances des arbres", Object.keys(M.instances).every((k) => M.instances[k].f.every((v) => Number.isFinite(v))));
const parties = new Set();
["vol", "dalles", "pont", "siphon", "niveau"].forEach((k) => { for (let i = 4; i < M[k].o.length; i += 8) parties.add(M[k].o[i]); });
for (let i = 4; i < M.boites.o.length; i += 8) parties.add(M.boites.o[i]);
for (let i = 1; i < M.eau.o.length; i += 4) parties.add(M.eau.o[i]);
const Z = api.zones(), zonesVues = new Set(Z.t);
const manquants = PARTIES.slice(1).filter((c, i) => !parties.has(i + 1) && !zonesVues.has(i + 1));
verifier("les 13 parties et les 4 pièces du siphon existent dans la maquette (volume ou zone du sol)", manquants.length === 0, manquants.join());
verifier("la carte des zones couvre les ouvrages du sol",
  ["source", "canal", "regards", "tranchee", "tunnel", "arcades", "pont", "castellum", "fontaines", "thermes", "maisons", "egouts"].every((c) => zonesVues.has(PARTIES.indexOf(c))));
verifier("l'eau coule dans le canal, sur le pont, dans les fontaines et les égouts",
  [M.eau, M.eauPont].some((E) => { for (let i = 3; i < E.o.length; i += 4) if (E.o[i] === 1) return true; return false; }) &&
  [10, 13].every((id) => { for (let i = 1; i < M.eau.o.length; i += 4) if (M.eau.o[i] === id) return true; return false; }));
verifier("des arbres en bosquets (plus de 300) et des oliviers", Object.keys(M.instances).reduce((s, k) => s + M.instances[k].n, 0) > 300);
verifier("dix fontaines au plus, au moins quatre", M.fontaines.length >= 4 && M.fontaines.length <= 10, M.fontaines.length);
verifier("une dizaine de regards le long de la tranchée", M.regards.length >= 8, M.regards.length);
verifier("la construction reste rapide (moins de 1,5 s)", duree < 1500, duree + " ms");

console.log("PENTE ET TRACÉ");
const LT = api.longueur;
verifier("le canal descend tout le long, très doucement (24,8 cm par km, comme à Nîmes)",
  api.zFond(0) > api.zFond(LT) && Math.abs((api.zFond(0) - api.zFond(LT)) / LT * 1000 - 0.248) < 1e-6, ((api.zFond(0) - api.zFond(LT)) / LT * 1000).toFixed(4));
const genres = new Set(); for (let s = 0; s <= LT; s += 4) genres.add(api.genre(s));
verifier("le tracé passe par une tranchée, un tunnel, un mur, des arcades et le pont", ["tranchee", "tunnel", "mur", "arcades", "pont"].every((g) => genres.has(g)), [...genres].join());
const A = api.ancres;
verifier("le pont du Gard enjambe une gorge profonde", api.H(A.pont[0], A.pont[1]) < api.zFond(LT / 2) - 50, api.H(A.pont[0], A.pont[1]).toFixed(1));
verifier("les arcades portent le canal au-dessus d'une combe", api.H(A.arcades[0], A.arcades[1]) < api.zFond(0) - 10, api.H(A.arcades[0], A.arcades[1]).toFixed(1));
verifier("le tunnel passe sous une colline", api.H(A.tunnel[0], A.tunnel[1]) > api.zFond(0) + 25, api.H(A.tunnel[0], A.tunnel[1]).toFixed(1));
verifier("la source est plus haute que le bassin de répartition, lui-même au-dessus des égouts",
  api.H(A.source[0], A.source[1]) > api.H(A.castellum[0], A.castellum[1]) && api.H(A.castellum[0], A.castellum[1]) > api.H(A.egouts[0], A.egouts[1]));

console.log("TERRAIN");
t0 = Date.now();
const T = api.terrain();
verifier("le terrain se maille sans valeur invalide", T.pos.every((v) => Number.isFinite(v)) && T.nor.every((v) => Number.isFinite(v)) && T.idx.length % 3 === 0);
verifier("les normales du terrain sont unitaires", (() => { for (let i = 0; i < T.nor.length; i += 3 * 97) { const l = Math.hypot(T.nor[i], T.nor[i + 1], T.nor[i + 2]); if (Math.abs(l - 1) > 1e-3) return false; } return true; })());
verifier("tous les indices du terrain sont valides", (() => { for (let i = 0; i < T.idx.length; i++) if (T.idx[i] >= T.n) return false; return true; })());
verifier("le terrain du maillage reste rapide", Date.now() - t0 < 1500, (Date.now() - t0) + " ms");
verifier("moins de 260 000 triangles de terrain", T.ntri < 260000, T.ntri);
verifier("le composant reste léger (moins de 350 Ko)", Buffer.byteLength(composant, "utf8") < 350 * 1024, (Buffer.byteLength(composant, "utf8") / 1024).toFixed(1) + " Ko");

console.log("ÉTIQUETTES CALMES");
// Pendant un mouvement, chaque étiquette suit son point sans refaire le placement : on rejoue
// apresRendu (tirée du script) dans une petite simulation, image par image.
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
  // Les minuteurs sont simulés : etat.t est l'heure, etat.minuteurs la file des rappels.
  const simuler = new Function("etat", `
    var cam = etat.cam, etat3d = { exag: 0 }, svg = null, etiquettes = [], W_ = 0, H_ = 0, sigCam = "", minuteurRepos = null, enMouvement = false, dejaPlacees = false;
    var dernierMouvement = 0, vol = null, pointeurs = etat.pointeurs;
    var toile = { clientWidth: 800, clientHeight: 500 }, appels = { disposer: 0, poser: 0, minuteurs: 0 };
    var performance = { now: function () { return etat.t; } };
    function hautLibre() { return 40; }
    function poser() { appels.poser++; }
    function jauge() {}
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
  // Glisser lent : le doigt reste appuyé et les images arrivent toutes les 300 ms (appareil lent).
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
verifier("le placement garde d'abord la place actuelle (hystérésis), puis essaie d'autres places, puis le seul numéro",
  !!srcDisposer && /ajouter\(\[e\.cible\], false\)/.test(srcDisposer) && /ajouter\(PRES, true\)/.test(srcDisposer) && /est-compact/.test(srcDisposer));
verifier("les grands ouvrages gardent leur nom; les petits peuvent n'afficher que leur numéro", /GRANDS = \{ source: 1, tunnel: 1, arcades: 1, pont: 1, castellum: 1, thermes: 1 \}/.test(script));
verifier("le glissement vers une nouvelle place est doux (0,28 s), sans redessiner la maquette", !!srcDisposer && /\/ 280\)/.test(srcDisposer));
verifier("les étiquettes apparaissent et disparaissent en fondu, jamais par bascule brusque",
  !!srcMontrer && /classList\.toggle\("est-visible"/.test(srcMontrer) && /\.aqu__ancre \{[^}]*transition: opacity/.test(composant) && !/visibility\s*=\s*[^;]*hidden/.test(script));

console.log("ZOOM À LA MOLETTE");
{
  const doit = api.molettePourMaquette, facteur = api.facteurMolette;
  verifier("les règles de la molette sont accessibles", typeof doit === "function" && typeof facteur === "function");
  if (typeof doit === "function" && typeof facteur === "function") {
    const roue = (o) => Object.assign({ ctrlKey: false, metaKey: false, deltaY: 100, deltaMode: 0 }, o);
    verifier("molette seule sur la maquette, page immobile : on zoome", doit(roue(), false, 10000, 9000) === true);
    verifier("la page défilait il y a 150 ms : on la laisse défiler (pas de piège)", doit(roue(), false, 10000, 9850) === false);
    verifier("Ctrl + molette ou pincement : on zoome même juste après un défilement", doit(roue({ ctrlKey: true }), false, 10000, 9990) === true);
    verifier("en plein écran, la molette zoome toujours", doit(roue(), true, 10000, 9990) === true);
    const f1 = facteur(roue()), f2 = facteur(roue({ deltaY: -100 })), f3 = facteur(roue({ deltaY: 3, deltaMode: 1 }));
    const fp = facteur(roue({ ctrlKey: true, deltaY: 5 })), fx = facteur(roue({ deltaY: 5000 }));
    verifier("pas doux : un cran éloigne d'environ 15 %", f1 > 1.1 && f1 < 1.2, f1.toFixed(3));
    verifier("le cran inverse rapproche d'autant", Math.abs(f1 * f2 - 1) < 1e-9, (f1 * f2).toFixed(6));
    verifier("une molette réglée en lignes (Firefox) donne le même pas", Math.abs(f3 - f1) < 0.01, f3.toFixed(3));
    verifier("le pincement du pavé tactile garde sa vitesse", Math.abs(fp - Math.exp(5 * 0.0022)) < 1e-9, fp.toFixed(4));
    verifier("un grand coup de molette reste borné", fx <= Math.exp(240 * 0.0014) + 1e-9, fx.toFixed(3));
  }
  verifier("la molette de la maquette bloque le défilement (preventDefault, non passive) et la page est surveillée",
    /scene\.addEventListener\("wheel", function \(e\) \{\s*if \(!molettePourMaquette\(e, estPleinEcran\(\)/.test(script) &&
    /e\.preventDefault\(\);\s*vol = null;\s*var b = toile\.getBoundingClientRect\(\);\s*zoomer\(facteurMolette\(e\)/.test(script) &&
    /\}, \{ passive: false \}\)/.test(script) &&
    /window\.addEventListener\("wheel", noterDefilement, \{ passive: true, capture: true \}\)/.test(script) &&
    /document\.addEventListener\("scroll", noterDefilement, \{ passive: true, capture: true \}\)/.test(script));
}

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
