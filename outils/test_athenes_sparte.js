/*
 * Test du comparateur « Athènes ou Sparte » dans un DOM simulé.
 *     node outils/test_athenes_sparte.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js, pour vérifier
 * aussi le bouton Plein écran et le repli des textes.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "athenes-sparte.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La cité-État oligarchique de Sparte</h2>
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
const racine = document.getElementById("athenes-sparte");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function touche(el, key) { el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })); }
const visibles = () => tous(".ats__panneau.est-visible").map((p) => p.id);
function texteVisible(base) {
  const copie = base.cloneNode(true);
  copie.querySelectorAll("style, script, .ats__symboles").forEach((n) => n.remove());
  return copie.textContent.replace(/[ \t\n\r]+/g, " ");
}

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
const onglets = tous(".ats__onglet");
verifier("neuf onglets : huit aspects et le test", onglets.length === 9, onglets.length);
verifier("chaque onglet est un onglet ARIA relié à son panneau",
  onglets.every((o) => o.getAttribute("role") === "tab" && document.getElementById(o.getAttribute("aria-controls")) &&
    document.getElementById(o.getAttribute("aria-controls")).getAttribute("role") === "tabpanel"));
verifier("neuf panneaux", tous(".ats__panneau").length === 9, tous(".ats__panneau").length);
verifier("huit lignes dans la vue d'ensemble", tous(".ats__ligne").length === 8, tous(".ats__ligne").length);
verifier("le premier aspect s'affiche au départ", visibles().join() === "ats-panneau-regime", visibles().join());
verifier("un seul onglet sélectionné et atteignable au clavier",
  onglets.filter((o) => o.getAttribute("aria-selected") === "true").length === 1 && onglets.filter((o) => o.tabIndex === 0).length === 1);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("chaque emblème vise un symbole existant",
  tous("use").length > 0 && tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);

console.log("ASPECTS");
const panneauxAspects = tous(".ats__panneau:not(.ats__panneau--test)");
verifier("chaque aspect compare Athènes et Sparte",
  panneauxAspects.every((p) => tous(".ats__cote", p).length === 2 && un(".ats__cote--athenes", p) && un(".ats__cote--sparte", p)));
verifier("chaque côté a un résumé et une explication",
  panneauxAspects.every((p) => tous(".ats__cote", p).every((c) => un(".ats__resume", c).textContent.length > 5 && un(".ats__detail", c).textContent.length > 60)));
verifier("chaque aspect dit ce qui se ressemble et ce qui diffère",
  panneauxAspects.every((p) => /Ce qui se ressemble/.test(un(".ats__constat--semblable", p).textContent) && /Ce qui diffère/.test(un(".ats__constat--differe", p).textContent)));
onglets.slice(0, 8).forEach((o) => {
  clic(o);
  verifier(`l'onglet « ${o.textContent} » montre son seul panneau`,
    visibles().join() === o.getAttribute("aria-controls") && o.getAttribute("aria-selected") === "true");
});
clic(tous(".ats__ligne")[2]);
verifier("une ligne de la vue d'ensemble choisit son aspect",
  visibles().join() === "ats-panneau-lois" && tous(".ats__ligne")[2].classList.contains("est-actif") && onglets[2].getAttribute("aria-selected") === "true");
onglets[0].focus();
touche(onglets[0], "ArrowRight");
verifier("la flèche droite passe à l'onglet suivant", document.activeElement === onglets[1] && visibles().join() === "ats-panneau-citoyens");
touche(onglets[1], "End");
verifier("Fin mène au test", document.activeElement === onglets[8] && racine.classList.contains("est-test"));
touche(onglets[8], "Home");
verifier("Début revient au premier aspect", document.activeElement === onglets[0] && !racine.classList.contains("est-test"));

console.log("COHÉRENCE DES CHIFFRES");
const nombre = (s) => Number(s.replace(/[\s\u00a0 ]/g, ""));
const citoyens = texteVisible(document.getElementById("ats-panneau-citoyens"));
const egaux = citoyens.match(/à peine ([\d\s\u00a0]+) sur une population de ([\d\s\u00a0]+)\./);
verifier("Sparte : 5 000 Égaux sur 250 000 donnent bien 1 sur 50",
  egaux && nombre(egaux[2]) / nombre(egaux[1]) === 50 && /1 sur 50/.test(citoyens), egaux && egaux.slice(1).join(" / "));
verifier("Athènes : 40 000 citoyens sur 400 000 donnent bien 10 %",
  /40\s000 hommes, 10\s%/.test(citoyens) && /400\s000 habitants/.test(citoyens));
const travail = texteVisible(document.getElementById("ats-panneau-travail"));
verifier("200 000 hilotes pour 5 000 Égaux donnent bien 40 pour un",
  /environ 200\s000/.test(travail) && /40 hilotes pour un/.test(travail) && 200000 / nombre(egaux ? egaux[1] : "0") === 40);

console.log("TEST");
clic(onglets[8]);
verifier("l'onglet du test passe en mode test", racine.classList.contains("est-test") && visibles().join() === "ats-panneau-test");
const progression = un(".ats__test > .ats__progression");
verifier("le test commence au premier énoncé", /Énoncé 1 sur 10/.test(progression.textContent), progression.textContent);
verifier("dix points de progression", tous(".ats__point").length === 10);
const rep = (cle) => un(`.ats__reponse[data-choix="${cle}"]`);
verifier("trois réponses possibles", tous(".ats__reponse").length === 3);
const CORRIGE = ["athenes", "sparte", "deux", "sparte", "athenes", "deux", "sparte", "athenes", "deux", "sparte"];
clic(rep("sparte"));
verifier("une mauvaise réponse est marquée, la bonne est montrée",
  rep("sparte").classList.contains("est-faux") && rep("athenes").classList.contains("est-juste") && /Pas tout à fait/.test(un(".ats__retro").textContent));
verifier("les réponses se figent après un choix", tous(".ats__reponse").every((b) => b.disabled));
clic(rep("deux"));
verifier("un second clic ne change rien", !rep("deux").classList.contains("est-faux") && tous(".ats__reponse.est-faux").length === 1);
verifier("le bouton Énoncé suivant apparaît", !un(".ats__suivant").hidden);
for (let k = 1; k < 10; k++) {
  clic(un(".ats__suivant"));
  verifier(`énoncé ${k + 1} : la réponse ${CORRIGE[k]} est juste`, (() => {
    clic(rep(CORRIGE[k]));
    return rep(CORRIGE[k]).classList.contains("est-juste") && /Exact/.test(un(".ats__retro").textContent);
  })());
}
verifier("le dernier bouton mène au résultat", /résultat/.test(un(".ats__suivant").textContent));
clic(un(".ats__suivant"));
verifier("le bilan donne 9 sur 10", !un(".ats__bilan").hidden && /9\s+sur\s+10/.test(un(".ats__score").textContent), un(".ats__score").textContent);
verifier("le message encourage à relire", /Très bien/.test(un(".ats__message").textContent));
verifier("les points gardent la trace des réponses", tous(".ats__point.est-faux").length === 1 && tous(".ats__point.est-juste").length === 9);
clic(un(".ats__recommencer"));
verifier("Recommencer remet le test à zéro",
  /Énoncé 1 sur 10/.test(progression.textContent) && tous(".ats__point.est-juste, .ats__point.est-faux").length === 0 && tous(".ats__reponse").every((b) => !b.disabled));

console.log("PLEIN ÉCRAN");
clic(onglets[3]);
const pleinBouton = un(".ats__entete > .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".ats__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("le comparateur passe en plein écran", racine.classList.contains("est-plein-ecran"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(tous(".ats__ligne")[5]);
  verifier("choisir une ligne rouvre les textes sur cet aspect",
    !racine.classList.contains("texte-masque") && visibles().join() === "ats-panneau-femmes" && /Masquer/.test(replier.textContent));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
const visible = texteVisible(racine);
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(visible));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(visible), (visible.match(/.{30},\s+et\s.{10}/) || [""])[0]);
verifier("une espace insécable devant chaque deux-points", !/(?<!\u00a0):/.test(visible), (visible.match(/.{20}(?<!\u00a0):.{10}/) || [""])[0]);
verifier("aucune espace devant ? ! ;", !/[ \u00a0 ][?!;]/.test(visible), (visible.match(/.{20}[ \u00a0 ][?!;]/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?!\u00a0)/.test(visible) && !/(?<!\u00a0)»/.test(visible));

verifier("aucun nombre coupé par une espace ordinaire", !/\d \d{3}\b/.test(visible), (visible.match(/.{15}\d \d{3}\b.{5}/) || [""])[0]);

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
