/*
 * Test de l'interface « Le parcours d'une loi » dans un DOM simulé.
 *     node outils/test_parcours_loi.js
 *
 * Vérifie les deux parcours, l'ostracisme, le tirage au sort, la comparaison,
 * le plein écran, la typographie, puis l'absence de doublon d'identifiants
 * dans la fiche 03 construite, où trois interfaces cohabitent.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "parcours-loi.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les institutions politiques d'Athènes</h2>
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
const racine = document.getElementById("parcours-loi");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function touche(el, key) { el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })); }
function texteVisible(base) {
  const copie = base.cloneNode(true);
  copie.querySelectorAll("style, script").forEach((n) => n.remove());
  return copie.textContent.replace(/[ \t\n\r]+/g, " ");
}
const onglet = (vue) => un(`.pdl__onglet[data-vue="${vue}"]`);
const etapesDe = (piste) => tous(`.pdl__piste[data-piste="${piste}"] .pdl__etape`);
const panneauVisible = () => tous(".pdl__panneau.est-visible").map((p) => p.getAttribute("data-cle")).join();
const suivant = un(".pdl__suivant");
const precedent = un(".pdl__precedent");

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("trois onglets : Athènes, Québec, Comparer", tous(".pdl__onglet").map((o) => o.getAttribute("data-vue")).join() === "athenes,quebec,comparer");
verifier("chaque onglet contrôle un panneau d'onglet",
  tous(".pdl__onglet").every((o) => o.getAttribute("role") === "tab" && document.getElementById(o.getAttribute("aria-controls")) &&
    document.getElementById(o.getAttribute("aria-controls")).getAttribute("role") === "tabpanel"));
verifier("six étapes à Athènes", etapesDe("athenes").length === 6, etapesDe("athenes").length);
verifier("neuf étapes au Québec, élections et tribunaux compris", etapesDe("quebec").length === 9, etapesDe("quebec").length);
verifier("seize panneaux : 6, plus l'ostracisme, plus 9", tous(".pdl__panneau").length === 16, tous(".pdl__panneau").length);
verifier("chaque étape vise son panneau", tous(".pdl__etape").every((b) => document.getElementById(b.getAttribute("aria-controls"))));
verifier("quatre cartes de comparaison", tous(".pdl__carte").length === 4, tous(".pdl__carte").length);
verifier("Athènes s'affiche au départ, à la première étape",
  onglet("athenes").getAttribute("aria-selected") === "true" && panneauVisible() === "athenes-proposition" && precedent.disabled);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);

console.log("ATHÈNES");
const noms = etapesDe("athenes").map((b) => b.getAttribute("data-cle")).join();
verifier("l'ordre : proposition, boulè, débat, vote, héliée, magistrats", noms === "proposition,boule,debat,vote,heliee,magistrats", noms);
verifier("l'héliée est une étape facultative", etapesDe("athenes")[4].classList.contains("est-facultatif"));
etapesDe("athenes").forEach((b, k) => {
  clic(b);
  verifier(`l'étape « ${un(".pdl__court", b).textContent} » ouvre son seul panneau`,
    panneauVisible() === "athenes-" + b.getAttribute("data-cle") && b.getAttribute("aria-current") === "step" &&
    etapesDe("athenes").filter((x) => x.classList.contains("est-passe")).length === k);
});
verifier("à la dernière étape, Étape suivante est désactivée", suivant.disabled);
clic(precedent);
verifier("Étape précédente recule", panneauVisible() === "athenes-heliee");
const boule = document.getElementById("pdl-p-athenes-boule");
verifier("la boulè : 500 citoyens tirés au sort pour un an", /500 citoyens/.test(texteVisible(boule)) && /Tirage au sort, pour un an/.test(texteVisible(boule)));
verifier("chaque panneau donne qui, combien et comment", tous(".pdl__panneau .pdl__fiche").every((f) => f.querySelectorAll("dt").length === 3 && f.querySelectorAll("dd").length === 3));
const vote = document.getElementById("pdl-p-athenes-vote");
verifier("le vote se fait à main levée, sans représentants", /main levée/.test(texteVisible(vote)) && /démocratie directe/.test(texteVisible(vote)));
verifier("l'exemple réel suit Thémistocle de la proposition à Salamine",
  /-483/.test(texteVisible(document.getElementById("pdl-p-athenes-proposition"))) && /Salamine/.test(texteVisible(document.getElementById("pdl-p-athenes-magistrats"))));

console.log("TIRAGE AU SORT");
clic(etapesDe("athenes")[1]);
const tirer = un(".pdl__tirer", boule);
verifier("50 billes dans l'urne", tous(".pdl__bille", boule).length === 50);
const choisis = new Set();
for (let k = 0; k < 50; k++) { clic(tirer); choisis.add(tirer.getAttribute("data-choisi")); }
verifier("50 tirages donnent 50 présidents différents", choisis.size === 50, choisis.size);
verifier("une seule bille préside à la fois", tous(".pdl__bille.preside", boule).length === 1 && tous(".pdl__bille.a-preside", boule).length === 49);
verifier("le résultat dit que personne n'a présidé deux fois", /personne n.a été choisi deux fois/.test(un(".pdl__resultat", boule).textContent));
clic(tirer);
verifier("Recommencer vide l'urne", tous(".pdl__bille.preside, .pdl__bille.a-preside", boule).length === 0 && /Tirer au sort/.test(tirer.textContent));

console.log("OSTRACISME");
const special = un(".pdl__special");
verifier("le bouton de l'ostracisme est sous le parcours d'Athènes", !!special && !!special.closest('.pdl__piste[data-piste="athenes"]'));
clic(special);
verifier("il ouvre son panneau", panneauVisible() === "athenes-ostracisme" && special.classList.contains("est-courant"));
verifier("aucune étape n'est courante pendant ce temps", etapesDe("athenes").every((b) => !b.classList.contains("est-courant")));
const ostra = document.getElementById("pdl-p-athenes-ostracisme");
verifier("trois étapes, 6 000 votes, 10 ans d'exil",
  tous(".pdl__ostra > li", ostra).length === 3 && /6 000 votes/.test(texteVisible(ostra)) && /10 ans/.test(texteVisible(ostra)));
const voir = un(".pdl__voir", ostra);
const reponse = un(".pdl__indice-reponse", ostra);
verifier("l'hypothèse est cachée au départ", reponse.hidden && voir.getAttribute("aria-expanded") === "false");
clic(voir);
verifier("puis se révèle", !reponse.hidden && voir.getAttribute("aria-expanded") === "true" && /hypothèse/.test(reponse.textContent));
verifier("Revenir au parcours", /Revenir/.test(suivant.textContent));
clic(suivant);
verifier("ramène à l'étape où l'on était", panneauVisible() === "athenes-boule");

console.log("QUÉBEC");
clic(onglet("quebec"));
verifier("l'onglet Québec montre son parcours", un('.pdl__piste[data-piste="quebec"]').classList.contains("est-visible") && panneauVisible() === "quebec-election");
const nomsQc = etapesDe("quebec").map((b) => b.getAttribute("data-cle")).join();
verifier("les sept étapes de l'Assemblée nationale, encadrées par les élections et les tribunaux",
  nomsQc === "election,presentation,consultations,principe,etude,rapport,adoption,sanction,tribunaux", nomsQc);
verifier("les élections viennent avant tout, numérotées 0", etapesDe("quebec")[0].classList.contains("est-prealable") && un(".pdl__num", etapesDe("quebec")[0]).textContent === "0");
verifier("les sept étapes officielles sont numérotées de 1 à 7, les tribunaux à part", etapesDe("quebec").slice(1).map((b) => un(".pdl__num", b).textContent).join() === "1,2,3,4,5,6,7,+" && /étape 7 sur 7/.test(document.getElementById("pdl-p-quebec-sanction").textContent));
verifier("consultations et tribunaux sont facultatifs",
  etapesDe("quebec")[2].classList.contains("est-facultatif") && etapesDe("quebec")[8].classList.contains("est-facultatif"));
verifier("127 députés", /127 députés/.test(texteVisible(document.getElementById("pdl-p-quebec-election"))));
verifier("la sanction fait du projet une loi", /devient une loi/.test(texteVisible(document.getElementById("pdl-p-quebec-sanction"))));
const dates = ["presentation", "principe", "adoption", "sanction"].map((c) => texteVisible(document.getElementById("pdl-p-quebec-" + c)));
verifier("l'exemple réel suit le projet de loi no 3, daté à chaque étape connue",
  /7 novembre 2012/.test(dates[0]) && /21 mai 2013/.test(dates[1]) && /14 juin 2013/.test(dates[2]) && /14 juin 2013/.test(dates[3]));
verifier("le numéro du projet de loi ne se sépare pas", /no 3/.test(dates[0]));
for (let k = 0; k < 8; k++) clic(suivant);
verifier("Étape suivante parcourt tout le Québec", panneauVisible() === "quebec-tribunaux" && suivant.disabled);
clic(onglet("athenes"));
verifier("chaque parcours garde sa position", panneauVisible() === "athenes-boule");

console.log("COMPARER");
clic(onglet("comparer"));
verifier("l'onglet Comparer cache les parcours", racine.classList.contains("est-comparer") && panneauVisible() === "");
verifier("chaque carte oppose Athènes et le Québec",
  tous(".pdl__carte").every((c) => /À Athènes/.test(c.textContent) && /Au Québec/.test(c.textContent) && /Ce qui se ressemble/.test(c.textContent) && /Ce qui diffère/.test(c.textContent)));
verifier("une carte nomme la démocratie directe et la représentative",
  tous(".pdl__carte").some((c) => /démocratie directe/.test(c.textContent) && /démocratie représentative/.test(c.textContent)));
onglet("comparer").focus();
touche(onglet("comparer"), "ArrowRight");
verifier("les flèches font tourner les onglets", document.activeElement === onglet("athenes") && !racine.classList.contains("est-comparer"));

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".pdl__entete > .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".pdl__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("l'interface passe en plein écran", racine.classList.contains("est-plein-ecran"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
let tout = texteVisible(racine);
tous(".pdl__indice-reponse").forEach((r) => { tout += " " + r.textContent; });
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(tout));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(tout), (tout.match(/.{30},\s+et\s.{10}/) || [""])[0]);
verifier("une espace insécable devant chaque deux-points", !/(?<! ):/.test(tout), (tout.match(/.{20}(?<! ):.{10}/) || [""])[0]);
verifier("aucune espace devant ? ! ;", !/[   ][?!;]/.test(tout), (tout.match(/.{20}[   ][?!;]/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?! )/.test(tout) && !/(?<! )»/.test(tout));
verifier("aucun nombre coupé par une espace ordinaire", !/\d \d{3}\b/.test(tout), (tout.match(/.{15}\d \d{3}\b.{5}/) || [""])[0]);

console.log("FICHE 03 CONSTRUITE");
const construite = path.join(RACINE, "docs", "histoire", "03-premiere-democratie.html");
if (fs.existsSync(construite)) {
  const page = new JSDOM(fs.readFileSync(construite, "utf8"), { runScripts: "dangerously", pretendToBeVisual: true });
  const d = page.window.document;
  ["parcours-loi", "qui-est-citoyen", "athenes-sparte"].forEach((id) => {
    const bloc = d.getElementById(id);
    verifier(`la fiche contient ${id}, initialisé`, !!bloc && bloc.getAttribute("data-pret") === "1");
  });
  const idsPage = Array.from(d.querySelectorAll("[id]")).map((el) => el.id);
  const doublons = idsPage.filter((id, k) => idsPage.indexOf(id) !== k);
  verifier("aucun identifiant en double dans la fiche entière", doublons.length === 0, doublons.slice(0, 5).join());
  const ordre = ["parcours-loi", "qui-est-citoyen", "athenes-sparte"].map((id) => d.body.innerHTML.indexOf(`id="${id}"`));
  verifier("les trois interfaces sont dans l'ordre de la fiche", ordre[0] > 0 && ordre[0] < ordre[1] && ordre[1] < ordre[2], ordre.join());
} else {
  verifier("la fiche 03 est construite (lancer build.py)", false);
}

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
