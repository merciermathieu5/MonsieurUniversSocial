/*
 * Test de l'interface « Une journée d'enfant ouvrier » dans un DOM simulé.
 *     node outils/test_enfant_ouvrier.js
 *
 * Le composant est inséré dans une fiche minimale avec page.js, pour vérifier
 * aussi le bouton Plein écran et le panneau de texte repliable.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "enfant-ouvrier.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les classes sociales</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
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
const racine = document.getElementById("enfant-ouvrier");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function touche(el, key) { el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })); }
const texte = (el) => (el ? el.textContent.replace(/\u00a0/g, " ").trim() : "");

// Typographie : on recueille le texte français affiché dans chaque état.
const fautes = new Set();
function controlerTypo(etat) {
  const marcheur = document.createTreeWalker(racine, window.NodeFilter.SHOW_TEXT);
  let n;
  while ((n = marcheur.nextNode())) {
    const parent = n.parentElement;
    if (!parent || parent.closest("script, style, [lang='en']")) continue;
    const t = n.nodeValue;
    if (!t.trim()) continue;
    const signaler = (motif) => fautes.add(`${etat} : ${motif} dans « ${t.trim().slice(0, 70)} »`);
    if (/ :/.test(t)) signaler("espace ordinaire devant le deux-points");
    if (/[ \u00a0\u202f][;!?]/.test(t)) signaler("espace devant ; ! ?");
    if (/« /.test(t) || / »/.test(t)) signaler("espace ordinaire dans les guillemets");
    if (/«(?!\u00a0)/.test(t) || /(?<!\u00a0)»/.test(t)) signaler("guillemet sans insécable");
    if (/[\u2013\u2014]/.test(t)) signaler("tiret long");
    if (/, et /.test(t)) signaler("construction « , et »");
    if (/\d [h]\b/.test(t)) signaler("espace ordinaire entre un nombre et h");
  }
}

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("aucune image", tous("img").length === 0);
const onglets = tous('[role="tab"]');
verifier("trois onglets dans une liste d'onglets", onglets.length === 3 && !!un('[role="tablist"]'), onglets.length);
verifier("chaque onglet contrôle un panneau existant",
  onglets.every((o) => { const p = document.getElementById(o.getAttribute("aria-controls")); return p && p.getAttribute("role") === "tabpanel"; }));
verifier("seule la journée est visible au départ",
  !document.getElementById("sad-vue-journee").hidden && document.getElementById("sad-vue-horaires").hidden && document.getElementById("sad-vue-critique").hidden);
verifier("un seul onglet sélectionné", onglets.filter((o) => o.getAttribute("aria-selected") === "true").length === 1);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("l'en-tête porte le bouton Plein écran", !!un(".sad__entete .plein-ecran"));
controlerTypo("départ");

console.log("LA JOURNÉE");
const moments = tous(".sad__moment");
verifier("dix moments, sans doublon après un second passage", moments.length === 10, moments.length);
verifier("le premier moment est choisi au départ",
  moments[0].getAttribute("aria-pressed") === "true" && moments.filter((b) => b.getAttribute("aria-pressed") === "true").length === 1);
verifier("chaque bouton de moment porte son heure et son nom",
  moments.every((b) => un(".sad__heure", b) && un(".sad__nom", b) && texte(un(".sad__nom", b)).length > 2));
const precedent = tous(".sad__nav .sad__pilule")[0];
const suivant = tous(".sad__nav .sad__pilule")[1];
verifier("Moment précédent inactif au départ", precedent.disabled === true && suivant.disabled === false);
const attendus = { lever: 2, trajet: 2, retard: 1, travail: 1, dejeuner: 2, diner: 1, coups: 2, retour: 1, coucher: 1, apres: 1 };
moments.forEach((b) => {
  clic(b);
  const id = b.getAttribute("data-moment");
  const docs = tous("#sad-documents .sad__doc");
  const nom = texte(un(".sad__nom", b));
  verifier(`${nom} : ${attendus[id]} extrait(s) traduit(s), chacun avec l'original anglais`,
    docs.length === attendus[id] && docs.every((d) => /Traduction de l'anglais/.test(d.textContent) && un("details [lang='en']", d) && un(".sad__ligne--r", d)),
    docs.length);
  verifier(`${nom} : le panneau de texte suit le moment choisi`,
    texte(un('.sad__texte[data-vue="journee"] .sad__cote-titre')) === nom && /sur 10/.test(texte(un('[data-sad="statut"]'))));
  verifier(`${nom} : au moins une question À toi avec sa piste cachée`,
    tous('.sad__texte[data-vue="journee"] .sad__afaire').length >= 1 && tous('.sad__texte[data-vue="journee"] .sad__piste-texte').every((p) => p.hidden));
  verifier(`${nom} : chaque témoin a sa fiche avec une référence`,
    tous('.sad__texte[data-vue="journee"] .sad__temoin').length >= 1 && tous('.sad__texte[data-vue="journee"] .sad__ref').every((r) => /Sadler/.test(r.textContent)));
  controlerTypo(`moment ${id}`);
});
verifier("Moment suivant inactif au dernier moment", suivant.disabled === true && precedent.disabled === false);
clic(precedent);
verifier("Moment précédent recule d'un moment", moments[8].getAttribute("aria-pressed") === "true");
touche(moments[8], "Home");
verifier("la touche Début revient au premier moment", moments[0].getAttribute("aria-pressed") === "true" && document.activeElement === moments[0]);
touche(moments[0], "ArrowRight");
verifier("la flèche droite passe au moment suivant", moments[1].getAttribute("aria-pressed") === "true");
const piste = un('.sad__texte[data-vue="journee"] .sad__piste-btn');
const reponse = document.getElementById(piste.getAttribute("aria-controls"));
clic(piste);
verifier("Voir une piste de réponse ouvre la piste", reponse && !reponse.hidden && piste.getAttribute("aria-expanded") === "true");
clic(piste);
verifier("un second clic la referme", reponse.hidden && piste.getAttribute("aria-expanded") === "false");
const crabtree = texte(un("#sad-documents .sad__doc"));
verifier("le trajet cite Matthew Crabtree qui court en pleurant", /courais en pleurant/.test(crabtree));

console.log("LES HORAIRES");
clic(onglets[1]);
verifier("l'onglet horaires affiche son panneau et son texte",
  !document.getElementById("sad-vue-horaires").hidden && document.getElementById("sad-vue-journee").hidden &&
  !un('.sad__texte[data-vue="horaires"]').hidden && un('.sad__texte[data-vue="journee"]').hidden);
verifier("la consigne change", texte(un('[data-sad="consigne"]')) === "Compare les horaires");
const totaux = () => tous("#sad-vue-horaires .sad__total").map(texte).filter(Boolean);
verifier("période de presse par défaut : 16 h, 16 h et 19 h à l'usine",
  totaux().slice(0, 3).join("|") === "16 h|16 h|19 h", totaux().join("|"));
verifier("période de presse : 15 h 20, 15 h et 18 h de travail",
  totaux().slice(3).join("|") === "15 h 20|15 h|18 h", totaux().join("|"));
verifier("trois barres de journée de 1, 1 et 3 pauses",
  tous("#sad-vue-horaires .sad__graphe")[0].querySelectorAll(".sad__piste:not(.sad__piste--axe)").length === 3 &&
  Array.from(tous("#sad-vue-horaires .sad__graphe")[0].querySelectorAll(".sad__piste:not(.sad__piste--axe)")).map((p) => p.querySelectorAll(".sad__seg").length).join() === "2,2,4");
controlerTypo("horaires presse");
clic(un('[data-periode="normal"]'));
verifier("temps normal : 13 h, 14 h et 14 h 30 à l'usine",
  totaux().slice(0, 3).join("|") === "13 h|14 h|14 h 30", totaux().join("|"));
verifier("temps normal : 12 h 20, 13 h et 13 h 30 de travail",
  totaux().slice(3).join("|") === "12 h 20|13 h|13 h 30", totaux().join("|"));
verifier("la bascule indique la période choisie",
  un('[data-periode="normal"]').getAttribute("aria-pressed") === "true" && un('[data-periode="presse"]').getAttribute("aria-pressed") === "false");
verifier("un tableau de données accompagne les barres", tous("#sad-vue-horaires table tr").length === 4);
controlerTypo("horaires normal");

console.log("CRITIQUE DE SOURCE");
clic(onglets[2]);
const etapes = tous(".sad__etapes .sad__pilule");
verifier("six étapes", etapes.length === 6, etapes.length);
etapes.forEach((b, i) => {
  clic(b);
  verifier(`étape ${i + 1} : titre affiché`, texte(un("#sad-etape .sad__etape-titre")).startsWith(`${i + 1}.`));
  controlerTypo(`étape ${i + 1}`);
});
clic(etapes[1]);
let questions = tous("#sad-etape .sad__questions > li");
verifier("huit vraies questions à classer", questions.length === 8, questions.length);
verifier("chaque question montre l'original anglais", questions.every((q) => un("[lang='en']", q)));
const justes = ["neutre", "orientee", "neutre", "orientee", "neutre", "orientee", "neutre", "orientee"];
verifier("bilan caché avant la fin", un("#sad-etape .sad__bilan").hidden);
clic(un('[data-choix="orientee"]', questions[0]));
verifier("une mauvaise réponse est signalée", questions[0].classList.contains("est-faux") && /Pas tout à fait/.test(texte(un(".sad__verdict", questions[0]))));
questions.forEach((q, i) => clic(un(`[data-choix="${justes[i]}"]`, q)));
verifier("toutes justes : 8 sur 8", /^8 bonnes réponses sur 8/.test(texte(un("#sad-etape .sad__bilan"))) && !un("#sad-etape .sad__bilan").hidden,
  texte(un("#sad-etape .sad__bilan")));
controlerTypo("questions répondues");
clic(etapes[0]);
clic(etapes[1]);
questions = tous("#sad-etape .sad__questions > li");
verifier("les réponses sont gardées quand on revient à l'étape", questions.every((q) => q.classList.contains("est-juste")));
clic(un('[data-sad="recommencer"]'));
questions = tous("#sad-etape .sad__questions > li");
verifier("Recommencer efface les réponses", questions.every((q) => !q.classList.contains("est-juste") && !q.classList.contains("est-faux")) && un("#sad-etape .sad__bilan").hidden);
clic(etapes[5]);
verifier("la loi de 1833 est comparée au projet de Sadler", tous("#sad-etape table tbody tr").length === 5 &&
  /48 heures par semaine/.test(texte(un("#sad-etape table"))));
verifier("la fiche d'identité du document est présente", tous('.sad__texte[data-vue="critique"] dt').length === 6);

console.log("ONGLETS AU CLAVIER");
touche(onglets[2], "ArrowRight");
verifier("la flèche droite boucle vers le premier onglet", onglets[0].getAttribute("aria-selected") === "true" && document.activeElement === onglets[0]);
touche(onglets[0], "End");
verifier("la touche Fin va au dernier onglet", onglets[2].getAttribute("aria-selected") === "true");

console.log("PLEIN ÉCRAN");
const bouton = un(".sad__entete .plein-ecran");
clic(bouton);
verifier("le bouton passe l'interface en plein écran", racine.classList.contains("est-plein-ecran") && bouton.getAttribute("aria-pressed") === "true");
const replier = un('[data-sad="replier"]');
clic(replier);
verifier("Masquer le texte replie le panneau", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && texte(replier) === "Afficher le texte");
clic(replier);
verifier("Afficher le texte le rouvre", !racine.classList.contains("texte-masque") && texte(replier) === "Masquer le texte");
clic(bouton);
verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran") && bouton.getAttribute("aria-pressed") === "false");

console.log("TYPOGRAPHIE");
verifier("aucune faute typographique dans les textes affichés", fautes.size === 0, Array.from(fautes).slice(0, 6).join(" | "));
verifier("aucun tiret long dans le fichier", !/[\u2013\u2014]/.test(composant));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
