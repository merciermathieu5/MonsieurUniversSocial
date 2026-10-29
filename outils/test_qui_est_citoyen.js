/*
 * Test de l'interface « Qui est citoyen? » dans un DOM simulé.
 *     node outils/test_qui_est_citoyen.js
 *
 * Vérifie le filtrage des 100 silhouettes étape par étape, le bilan chiffré,
 * la cohérence des nombres affichés, le plein écran et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "qui-est-citoyen.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les classes sociales athéniennes</h2>
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
const racine = document.getElementById("qui-est-citoyen");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function texteVisible(base) {
  const copie = base.cloneNode(true);
  copie.querySelectorAll("style, script").forEach((n) => n.remove());
  return copie.textContent.replace(/[ \t\n\r]+/g, " ");
}
const figures = () => tous(".qec__fig");
const etatDe = (fig) => (fig.getAttribute("class").match(/est-(retire|droit|vote)/) || [, "neutre"])[1];
const compter = () => {
  const n = { neutre: 0, retire: 0, droit: 0, vote: 0 };
  figures().forEach((f) => { n[etatDe(f)] += 1; });
  return n;
};
const plage = (a, b, etat) => figures().slice(a, b).every((f) => etatDe(f) === etat);
const bandesVisibles = () => tous(".qec__bande.est-visible").map((b) => b.getAttribute("data-bande")).sort().join();
const lignesBilan = () => tous(".qec__ligne").map((l) => un(".qec__nb", l).textContent.replace(/\u00a0/g, " "));
const suivant = un(".qec__suivant");
const precedent = un(".qec__precedent");
const etapes = tous(".qec__etape");
const courante = () => etapes.findIndex((b) => b.getAttribute("aria-current") === "step");

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("100 silhouettes, pas une de plus", figures().length === 100, figures().length);
verifier("sept étapes", etapes.length === 7, etapes.length);
verifier("deux groupes d'étapes : Athènes puis le Québec",
  tous(".qec__groupe").map((g) => g.textContent).join("|") === "À Athènes|Au Québec");
verifier("la grille a un nom accessible", /100 silhouettes/.test(un(".qec__grille").getAttribute("aria-label")));
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("la moitié de silhouette vise un masque existant", !!document.getElementById("qec-moitie"));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);

console.log("ATHÈNES");
verifier("étape 1 : toutes les silhouettes sont des habitants", compter().neutre === 100 && courante() === 0 && precedent.disabled);
verifier("étape 1 : le bilan part de 100", lignesBilan().join() === "100");
verifier("étape 1 : l'échelle est de 4 000 personnes par silhouette", /4\u00a0000 personnes/.test(un(".qec__echelle").textContent));
clic(suivant);
verifier("étape 2 : les 25 esclaves sont retirés", compter().retire === 25 && plage(0, 25, "retire") && courante() === 1, JSON.stringify(compter()));
verifier("étape 2 : leur bande est nommée", bandesVisibles() === "esclaves", bandesVisibles());
verifier("étape 2 : le bilan soustrait 25", lignesBilan().join("|") === "100|\u2212 25");
clic(suivant);
verifier("étape 3 : les 20 métèques sont retirés à leur tour", compter().retire === 45 && plage(25, 45, "retire"));
clic(suivant);
verifier("étape 4 : il reste 10 citoyens qui ont le droit de voter",
  compter().retire === 90 && compter().droit === 10 && plage(90, 100, "droit"), JSON.stringify(compter()));
const bilan4 = lignesBilan();
verifier("étape 4 : 100 moins 25, 20 et 45 donne bien 10",
  bilan4.length === 5 && 100 - 25 - 20 - 45 === Number(bilan4[4].replace(/\D/g, "")) && /^= 10$/.test(bilan4[4]), bilan4.join("|"));
clic(suivant);
verifier("étape 5 : une silhouette et demie vient à l'ecclésia",
  compter().vote === 1 && etatDe(figures()[90]) === "vote" && un(".qec__demi").classList.contains("est-visible"));
verifier("étape 5 : 6 000 sur 40 000 citoyens, soit 1,5 silhouette de 4 000",
  6000 / 4000 === 1.5 && /1,5/.test(un(".qec__compte").textContent) && /6\u00a0000|6 000/.test(texteVisible(un(".qec__bilan"))));
verifier("étape 5 : le texte nomme la Pnyx", /Pnyx/.test(un(".qec__explication").textContent));

console.log("QUÉBEC");
clic(suivant);
verifier("étape 6 : 30 silhouettes ne peuvent pas voter, 70 le peuvent",
  compter().retire === 30 && compter().droit === 70 && plage(0, 30, "retire") && !un(".qec__demi").classList.contains("est-visible"), JSON.stringify(compter()));
verifier("étape 6 : l'échelle change", /90\u00a0000 personnes/.test(un(".qec__echelle").textContent));
verifier("étape 6 : le lieu change", /Québec en 2026/.test(un(".qec__lieu").textContent));
verifier("étape 6 : le bilan repart du Québec", lignesBilan().join("|") === "100|\u2212 30|= 70", lignesBilan().join("|"));
clic(suivant);
verifier("étape 7 : 47 ont voté, 23 inscrits n'ont pas voté",
  compter().vote === 47 && compter().droit === 23 && compter().retire === 30 && plage(53, 100, "vote"), JSON.stringify(compter()));
verifier("étape 7 : 70 moins 23 donne bien 47", lignesBilan().slice(-2).join("|") === "\u2212 23|= 47");
const bilanQc = texteVisible(un(".qec__bilan"));
const millions = (re) => Number((bilanQc.match(re) || [, "NaN"])[1].replace(",", "."));
const pop = millions(/Habitants du Québec\s*environ ([\d,]+) millions/);
const exclus = millions(/inscrits\s*environ ([\d,]+) millions/);
const inscrits = millions(/Électeurs inscrits\s*environ ([\d,]+) millions/);
const abst = millions(/octobre 2026\s*environ ([\d,]+) millions/);
const votants = millions(/Ont voté\s*environ ([\d,]+) millions/);
verifier("les millions s'additionnent : habitants moins exclus donne les inscrits",
  Math.abs(pop - exclus - inscrits) < 0.051, [pop, exclus, inscrits].join(" / "));
verifier("les millions s'additionnent : inscrits moins abstention donne les votants",
  Math.abs(inscrits - abst - votants) < 0.051, [inscrits, abst, votants].join(" / "));
verifier("6,4 millions à 66,93 % donnent bien environ 4,3 millions", Math.abs(6.4 * 0.6693 - votants) < 0.05);
verifier("les silhouettes suivent les millions : 70 inscrits et 47 votants sur 100",
  Math.round(inscrits / pop * 100) === 70 && Math.round(votants / pop * 100) === 47);
verifier("étape 7 : la question Et toi? s'affiche", !un(".qec__et-toi").hidden && /Et toi\?/.test(un(".qec__et-toi").textContent));
verifier("le dernier bouton propose de recommencer", /Recommencer/.test(suivant.textContent));
clic(suivant);
verifier("Recommencer revient à l'étape 1", courante() === 0 && compter().neutre === 100 && un(".qec__et-toi").hidden);

console.log("NAVIGATION");
clic(etapes[3]);
verifier("une pastille d'étape mène directement à son étape", courante() === 3 && compter().droit === 10);
clic(precedent);
verifier("Étape précédente recule d'une étape", courante() === 2 && compter().retire === 45);
verifier("les étapes passées sont marquées", etapes.slice(0, 2).every((b) => b.classList.contains("est-passe")) && !etapes[2].classList.contains("est-passe"));

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".qec__entete .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".qec__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("l'interface passe en plein écran", racine.classList.contains("est-plein-ecran"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(suivant);
  verifier("on avance encore quand les textes sont repliés", courante() === 3);
  clic(replier);
  verifier("puis les textes se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
let tout = "";
for (let k = 0; k < etapes.length; k++) { clic(etapes[k]); tout += " " + texteVisible(racine); }
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(tout));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(tout), (tout.match(/.{30},\s+et\s.{10}/) || [""])[0]);
verifier("une espace insécable devant chaque deux-points", !/(?<!\u00a0):/.test(tout), (tout.match(/.{20}(?<!\u00a0):.{10}/) || [""])[0]);
verifier("aucune espace devant ? ! ;", !/[ \u00a0 ][?!;]/.test(tout), (tout.match(/.{20}[ \u00a0 ][?!;]/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?!\u00a0)/.test(tout) && !/(?<!\u00a0)»/.test(tout));

verifier("aucun nombre coupé par une espace ordinaire", !/\d \d{3}\b/.test(tout), (tout.match(/.{15}\d \d{3}\b.{5}/) || [""])[0]);

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
