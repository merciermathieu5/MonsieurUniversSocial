/*
 * Test de la carte « La diffusion de l'imprimerie » dans un DOM simulé.
 *     node outils/test_imprimerie.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js, pour vérifier
 * le curseur du temps, le défilement, les villes, les onglets, les pistes
 * « À toi », la cohérence des données, le plein écran et la typographie, puis
 * l'absence de doublon d'identifiants dans la fiche 07 construite.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const SOURCE = path.join(RACINE, "theme", "composants", "imprimerie.html");
const composant = fs.readFileSync(SOURCE, "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La diffusion du savoir</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
// Le défilement automatique est piloté à la main : on capture la minuterie.
let minuterie = null;
window.setInterval = (fn) => { minuterie = fn; return 1; };
window.clearInterval = () => { minuterie = null; };
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
// Un second passage du script ne doit rien doubler.
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const racine = document.getElementById("imprimerie");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function touche(el, key) { el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })); }
function texteVisible(base) {
  const copie = base.cloneNode(true);
  copie.querySelectorAll("style, script, [hidden]").forEach((n) => n.remove());
  return copie.textContent.replace(/[ \t\n\r]+/g, " ");
}
const curseur = un(".imp__curseur");
function annee(a) {
  curseur.value = String(a);
  curseur.dispatchEvent(new window.Event("input", { bubbles: true }));
}
const visibles = () => tous(".imp__ville.est-visible").map((g) => g.getAttribute("data-ville"));
const evenement = () => un(".imp__evenement").textContent.replace(/ /g, " ");
const ongletActif = () => (tous(".imp__onglet").find((o) => o.getAttribute("aria-selected") === "true") || {}).getAttribute("data-vue");
const puce = (cle) => un(`.imp__puce[data-ville="${cle}"]`);

// Les données, lues dans la source même du composant.
const VILLES = JSON.parse(composant.match(/var VILLES = (\[.*?\]);\n/s)[1]);
const parCle = Object.fromEntries(VILLES.map((v) => [v.cle, v]));

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("24 villes sur la carte, une seule fois chacune", tous(".imp__ville").length === 24 && new Set(tous(".imp__ville").map((g) => g.dataset.ville)).size === 24, tous(".imp__ville").length);
verifier("un nom et une puce par ville", tous(".imp__nom").length === 24 && tous(".imp__puce").length === 24);
verifier("le curseur va de 1450 à 1500", curseur.min === "1450" && curseur.max === "1500" && curseur.value === "1450");
const onglets = tous(".imp__onglet");
verifier("trois onglets ARIA reliés à leur panneau",
  onglets.length === 3 && onglets.every((o) => o.getAttribute("role") === "tab" && document.getElementById(o.getAttribute("aria-controls")) &&
    document.getElementById(o.getAttribute("aria-controls")).getAttribute("role") === "tabpanel"));
verifier("le récit s'affiche au départ", ongletActif() === "recit" && !document.getElementById("imp-vue-recit").hidden && document.getElementById("imp-vue-ville").hidden);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("aucune espace insécable brute dans la source", !composant.includes(" "));

console.log("DONNÉES");
verifier("les villes sont dans l'ordre chronologique", VILLES.every((v, k) => k === 0 || VILLES[k - 1].annee <= v.annee));
verifier("toutes les dates sont entre 1450 et 1500", VILLES.every((v) => v.annee >= 1450 && v.annee <= 1500));
verifier("chaque ville a un texte, un pays et une date affichée", VILLES.every((v) => v.texte.length > 50 && v.pays && /\d{4}/.test(v.affiche)));
verifier("la date affichée correspond à l'année de la carte", VILLES.every((v) => v.affiche.endsWith(String(v.annee))));
verifier("Mayence est la seule ville au départ", VILLES.filter((v) => v.annee === 1450).map((v) => v.cle).join() === "mayence");
verifier("la note du récit annonce bien 24 villes", /24 villes/.test(un(".imp__paragraphe--note").textContent) && VILLES.length === 24);
const pistes = tous(".imp__piste").map((p) => p.textContent.replace(/ /g, " "));
const avant1465 = VILLES.filter((v) => v.annee <= 1464).map((v) => v.nom);
verifier("piste 1 : avant 1465, seules Mayence, Strasbourg et Bamberg impriment",
  avant1465.join() === "Mayence,Strasbourg,Bamberg" && avant1465.every((n) => pistes[0].includes(n)), avant1465.join());
verifier("piste 2 : Stockholm 33 ans et Faro 37 ans après Mayence",
  parCle.stockholm.annee - 1450 === 33 && parCle.faro.annee - 1450 === 37 && /1483/.test(pistes[1]) && /33 ans/.test(pistes[1]) && /1487/.test(pistes[1]) && /37 ans/.test(pistes[1]));
const bilan = texteVisible(document.getElementById("imp-vue-recit").parentNode).replace(/ /g, " ");
verifier("Venise : 4 500 éditions, dans la fiche de la ville comme dans le bilan",
  /4.500 éditions/.test(parCle.venise.texte) && /environ 4.500/.test(document.getElementById("imp-vue-bilan").textContent));
verifier("les villes nommées dans « Pourquoi si vite? » sont sur la carte",
  ["Subiaco", "Venise", "Paris", "Valence", "Cracovie"].every((n) => VILLES.some((v) => v.nom === n)));

console.log("CURSEUR");
verifier("en 1450, seule Mayence imprime", visibles().join() === "mayence" && /1 ville de la carte imprime/.test(un(".imp__compteur-texte").textContent));
verifier("en 1450, l'événement parle de Gutenberg", /Vers 1450/.test(evenement()) && /Gutenberg/.test(evenement()));
annee(1464);
verifier("en 1464, trois villes", visibles().join() === "mayence,strasbourg,bamberg" && /3 villes de la carte impriment/.test(un(".imp__compteur-texte").textContent));
verifier("le curseur annonce l'année aux lecteurs d'écran", curseur.getAttribute("aria-valuetext") === "1464" && un(".imp__annee").textContent === "1464");
verifier("une ville visible devient atteignable au clavier", un('.imp__ville[data-ville="bamberg"]').getAttribute("tabindex") === "0" && un('.imp__ville[data-ville="subiaco"]').getAttribute("tabindex") === "-1");
annee(1473);
const de1473 = VILLES.filter((v) => v.annee === 1473).map((v) => v.nom);
verifier("en 1473, l'événement liste les nouvelles villes de l'année",
  de1473.length > 1 && de1473.every((n) => evenement().includes(n)) && /Premières presses à/.test(evenement()), evenement());
verifier("en 1473, le compteur suit les données", visibles().length === VILLES.filter((v) => v.annee <= 1473).length);
annee(1474);
verifier("une année sans nouvelle ville le dit", /Aucune nouvelle ville/.test(evenement()));
annee(1475);
verifier("en 1475, première presse à Valence", /Première presse à Valence/.test(evenement()));
annee(1500);
verifier("en 1500, les 24 villes impriment", visibles().length === 24 && /24 villes de la carte impriment/.test(un(".imp__compteur-texte").textContent));
verifier("en 1500, l'événement rappelle les 200 villes d'Europe", /plus de 200 villes/.test(evenement()));
annee(1460);
verifier("revenir en arrière cache les villes plus récentes", visibles().join() === "mayence,strasbourg");

console.log("DÉFILEMENT");
annee(1450);
const jouer = un(".imp__jouer");
clic(jouer);
verifier("le bouton lance le défilement", typeof minuterie === "function" && /Arrêter/.test(jouer.getAttribute("aria-label")));
for (let k = 0; k < 11; k++) minuterie();
verifier("chaque pas avance d'un an", curseur.value === "1461" && visibles().includes("bamberg"));
clic(jouer);
verifier("un second clic arrête le défilement", minuterie === null && /Faire défiler/.test(jouer.getAttribute("aria-label")));
annee(1499);
clic(jouer);
minuterie();
verifier("le défilement atteint 1500", curseur.value === "1500");
minuterie();
verifier("arrivé en 1500, il s'arrête et montre le bilan", minuterie === null && ongletActif() === "bilan");
clic(jouer);
verifier("relancé en 1500, il repart de 1450", curseur.value === "1450" && typeof minuterie === "function");
clic(jouer);

console.log("VILLES");
annee(1450);
clic(puce("faro"));
verifier("choisir une ville future fait avancer le temps jusqu'à elle", curseur.value === "1487" && visibles().includes("faro"));
verifier("la fiche de la ville s'ouvre", ongletActif() === "ville" && /Faro/.test(un(".imp__fiche").textContent) && /Pentateuque/.test(un(".imp__fiche").textContent));
verifier("la ville est marquée sur la carte et dans la liste",
  un('.imp__ville[data-ville="faro"]').classList.contains("est-choisie") && puce("faro").getAttribute("aria-pressed") === "true");
verifier("la fiche situe la ville parmi les premières", /Parmi les 24 premières villes/.test(un(".imp__fiche").textContent.replace(/ /g, " ")));
verifier("la fiche donne le pays actuel", /Portugal/.test(un(".imp__fiche").textContent));
annee(1460);
verifier("reculer avant sa date retire le choix", /Aucune ville choisie/.test(un(".imp__fiche").textContent) && puce("faro").getAttribute("aria-pressed") === "false");
verifier("les villes futures sont signalées dans la liste", puce("faro").classList.contains("est-futur") && !puce("strasbourg").classList.contains("est-futur"));
clic(un('.imp__ville[data-ville="mayence"]'));
verifier("cliquer sur un point de la carte ouvre sa ville", /Mayence/.test(un(".imp__fiche").textContent) && /La première ville/.test(un(".imp__fiche").textContent));
touche(un('.imp__ville[data-ville="strasbourg"]'), "Enter");
verifier("Entrée sur un point choisit la ville", /Strasbourg/.test(un(".imp__fiche").textContent) && /Mentelin/.test(un(".imp__fiche").textContent));

console.log("ONGLETS ET À TOI");
onglets[1].focus();
touche(onglets[1], "ArrowRight");
verifier("la flèche droite passe à l'onglet suivant", ongletActif() === "bilan" && document.activeElement === onglets[2]);
touche(onglets[2], "ArrowRight");
verifier("et revient au premier", ongletActif() === "recit" && document.activeElement === onglets[0]);
verifier("un seul onglet atteignable au clavier", onglets.filter((o) => o.tabIndex === 0).length === 1);
const voirs = tous(".imp__voir");
verifier("trois questions, chacune avec sa piste cachée",
  tous(".imp__question").length === 3 && voirs.length === 3 && tous(".imp__piste").every((p) => p.hidden));
clic(voirs[1]);
verifier("Voir une piste révèle la piste", !tous(".imp__piste")[1].hidden && voirs[1].getAttribute("aria-expanded") === "true" && /Masquer/.test(voirs[1].textContent));
clic(voirs[1]);
verifier("puis la cache", tous(".imp__piste")[1].hidden && voirs[1].getAttribute("aria-expanded") === "false");

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".imp__entete > .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".imp__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  annee(1480);
  verifier("le curseur marche encore textes repliés", visibles().length === VILLES.filter((v) => v.annee <= 1480).length);
  clic(replier);
  verifier("puis les textes se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
annee(1500);
let tout = "";
["recit", "bilan"].forEach((v) => { clic(un(`.imp__onglet[data-vue="${v}"]`)); tout += " " + texteVisible(racine); });
tous(".imp__piste").forEach((p) => { tout += " " + p.textContent; });
VILLES.forEach((v) => { clic(puce(v.cle)); tout += " " + texteVisible(un(".imp__fiche")); });
for (let a = 1450; a <= 1500; a++) { annee(a); tout += " " + un(".imp__evenement").textContent + " " + un(".imp__compteur-texte").textContent; }
tous(".imp__ville").forEach((g) => { tout += " " + g.getAttribute("aria-label"); });
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(tout));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(tout), (tout.match(/.{30},\s+et\s.{10}/) || [""])[0]);
verifier("une espace insécable devant chaque deux-points", !/(?<! ):/.test(tout), (tout.match(/.{20}(?<! ):.{10}/) || [""])[0]);
verifier("aucune espace devant ? ! ;", !/[   ][?!;]/.test(tout), (tout.match(/.{20}[   ][?!;]/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?! )/.test(tout) && !/(?<! )»/.test(tout));
verifier("aucun nombre coupé par une espace ordinaire", !/\d \d{3}\b/.test(tout), (tout.match(/.{15}\d \d{3}\b.{5}/) || [""])[0]);

console.log("FICHE 07 CONSTRUITE");
const construite = path.join(RACINE, "docs", "histoire", "07-vision-de-lhomme.html");
if (fs.existsSync(construite)) {
  const page = new JSDOM(fs.readFileSync(construite, "utf8"), { runScripts: "dangerously", pretendToBeVisual: true });
  const d = page.window.document;
  const bloc = d.getElementById("imprimerie");
  verifier("la fiche contient la carte, initialisée", !!bloc && bloc.getAttribute("data-pret") === "1");
  const idsPage = Array.from(d.querySelectorAll("[id]")).map((el) => el.id);
  const doublons = idsPage.filter((id, k) => idsPage.indexOf(id) !== k);
  verifier("aucun identifiant en double dans la fiche entière", doublons.length === 0, doublons.slice(0, 5).join());
  page.window.close();
} else {
  verifier("la fiche 07 est construite (lancer build.py)", false);
}

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
window.close();
process.exit(echecs ? 1 : 0);
