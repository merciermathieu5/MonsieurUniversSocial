/*
 * Test de la carte des cités grecques et de leurs mers dans un DOM simulé.
 *     node outils/test_grece_cites.js
 *
 * Même mécanique que la carte des cités de Mésopotamie (test_cites.js) : trois
 * vues fixes, des cadres pour agrandir, une puce et un panneau par lieu.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "grece-cites.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La Grèce, un monde de cités-États</h2>
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
const racine = document.getElementById("grece-cites");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const VUES = ["ensemble", "grece", "peloponnese"];
const vueVisible = () => {
  const v = tous(".grc__svg.est-visible");
  return v.length === 1 ? v[0].getAttribute("data-carte") : v.map((x) => x.getAttribute("data-carte")).join("+") || null;
};
const carte = (nom) => racine.querySelector(`.grc__svg[data-carte="${nom}"]`);
const panneauxVisibles = () => tous(".grc__panneau.est-visible").map((p) => p.getAttribute("data-lieu"));
const choisirB = (b) => { if (b.getAttribute("aria-pressed") === "true") clic(b); clic(b); };
const boutonsPresses = () => tous('.grc__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-lieu"));
const allerVue = (v) => clic(racine.querySelector(`.grc__vue[data-vue="${v}"]`));

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("trois vues des lieux, deux cartes des régions et deux cartes muettes",
  tous(".grc__svg:not(.grc__svg--exercice):not(.grc__svg--regions)").length === 3 && tous(".grc__svg--regions").length === 2 && tous(".grc__svg--exercice").length === 2, tous(".grc__svg").length);
verifier("la vue d'ensemble s'affiche au départ", vueVisible() === "ensemble", vueVisible());
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("aucun lieu choisi au départ", boutonsPresses().length === 0 && tous(".est-choisi").length === 0);
const tousBoutons = tous(".grc__bouton");
const estRegion = (b) => b.getAttribute("data-vue").indexOf("regions") === 0;
const boutons = tousBoutons.filter((b) => !estRegion(b));
const boutonsRegions = tousBoutons.filter(estRegion);
verifier("30 boutons de lieux : 11 cités-États, 7 colonies, 3 sanctuaires, 9 mers et golfes", boutons.length === 30, boutons.length);
verifier("25 boutons de régions", boutonsRegions.length === 25, boutonsRegions.length);
verifier("un panneau par bouton, relié par aria-controls",
  tousBoutons.every((b) => { const p = document.getElementById(b.getAttribute("aria-controls")); return p && p.getAttribute("data-lieu") === b.getAttribute("data-lieu"); }));
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("chaque <use> vise un tracé existant", tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("titre en role=heading niveau 3", racine.querySelector(".grc__titre").getAttribute("aria-level") === "3");
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("aucune espace insécable brute dans le script", !/ /.test(script));

console.log("LIEUX");
const lieux = boutons.filter((b) => racine.querySelector(`.grc__point[data-lieu="${b.getAttribute("data-lieu")}"]`));
verifier("21 lieux habités", lieux.length === 21, lieux.length);
lieux.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  const vue = b.getAttribute("data-vue");
  const point = carte(vue).querySelector(`.grc__point[data-lieu="${cle}"]`);
  const nom = point && point.querySelector(".grc__nom");
  verifier(`${b.textContent} est nommé dans la vue ${vue}`,
    point && !point.classList.contains("grc__point--reduit") && nom && nom.textContent === b.textContent);
});
verifier("chaque lieu n'est nommé que dans une seule vue",
  lieux.every((b) => tous(`.grc__point[data-lieu="${b.getAttribute("data-lieu")}"]:not(.grc__point--reduit)`).length === 1));
verifier("Athènes, Sparte et Corinthe se lisent dans la vue Attique et Péloponnèse",
  ["athenes", "sparte", "corinthe"].every((c) => racine.querySelector(`.grc__bouton[data-lieu="${c}"]`).getAttribute("data-vue") === "peloponnese"));
verifier("les colonies lointaines se lisent dans la vue d'ensemble",
  ["massalia", "syracuse", "tarente", "cyrene", "naucratis"].every((c) => racine.querySelector(`.grc__bouton[data-lieu="${c}"]`).getAttribute("data-vue") === "ensemble"));
verifier("dans la vue d'ensemble, les points de la Grèce sont réduits",
  tous(".grc__point--reduit", carte("ensemble")).length >= 10);

console.log("CHOIX D'UN LIEU");
lieux.forEach((b) => {
  allerVue("ensemble");
  choisirB(b);
  const cle = b.getAttribute("data-lieu");
  const ok = vueVisible() === b.getAttribute("data-vue")
    && panneauxVisibles().join() === cle
    && boutonsPresses().join() === cle
    && carte(b.getAttribute("data-vue")).querySelector(`.grc__point[data-lieu="${cle}"]`).classList.contains("est-choisi");
  verifier(`${b.textContent} : bonne vue, point et panneau`, ok, `${vueVisible()} / ${panneauxVisibles()}`);
});

console.log("MERS ET GOLFES");
const mers = boutons.filter((b) => !lieux.includes(b));
verifier("9 mers et golfes", mers.length === 9, mers.map((b) => b.textContent).join());
mers.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  const vues = b.getAttribute("data-vues").split(" ");
  verifier(`${b.textContent} est nommée dans chacune de ses vues`,
    vues.every((v) => carte(v).querySelector(`.grc__etiq--mer[data-lieu="${cle}"]`) && carte(v).querySelector(`.grc__eau[data-lieu="${cle}"]`)));
  const ailleurs = VUES.find((v) => !vues.includes(v));
  if (ailleurs) {
    allerVue(ailleurs);
    choisirB(b);
    verifier(`${b.textContent} : depuis ${ailleurs}, bascule vers ${b.getAttribute("data-vue")}`, vueVisible() === b.getAttribute("data-vue"), vueVisible());
  }
  vues.forEach((v) => {
    allerVue(v);
    choisirB(b);
    const surCarte = tous(`.grc__eau[data-lieu="${cle}"]`, carte(v));
    verifier(`${b.textContent} : mise en évidence dans la vue ${v}`,
      vueVisible() === v && surCarte.length > 0 && surCarte.every((el) => el.classList.contains("est-choisi")) && panneauxVisibles().join() === cle,
      `${vueVisible()} ${surCarte.length}`);
  });
});
verifier("les noms anciens sont donnés avec le nom actuel",
  /mer Noire/.test(racine.querySelector("#grc-pont").textContent) && /Marmara/.test(racine.querySelector("#grc-propontide").textContent));

console.log("CARTE");
allerVue("ensemble");
clic(carte("ensemble").querySelector('.grc__zoom[data-zoom="grece"]'));
verifier("le cadre de la Grèce agrandit la carte", vueVisible() === "grece", vueVisible());
clic(carte("grece").querySelector('.grc__zoom[data-zoom="peloponnese"]'));
verifier("le cadre de l'Attique et du Péloponnèse agrandit la carte", vueVisible() === "peloponnese", vueVisible());
verifier("le bouton de vue suit la carte",
  tous('.grc__vue[aria-pressed="true"]').map((b) => b.getAttribute("data-vue")).join() === "peloponnese");
clic(carte("peloponnese").querySelector('.grc__point[data-lieu="sparte"]'));
verifier("un clic sur un point choisit la cité sans changer de vue",
  vueVisible() === "peloponnese" && panneauxVisibles().join() === "sparte" && boutonsPresses().join() === "sparte");
clic(carte("peloponnese").querySelector('.grc__eau[data-lieu="saronique"]'));
verifier("un clic sur le golfe Saronique le choisit", panneauxVisibles().join() === "saronique" && boutonsPresses().join() === "saronique");
allerVue("ensemble");
clic(carte("ensemble").querySelector('.grc__point--reduit[data-lieu="athenes"]'));
verifier("un point réduit ne choisit rien", panneauxVisibles().join() === "saronique" && vueVisible() === "ensemble");

console.log("DÉSÉLECTION ET RÉINITIALISATION");
verifier("data-reinitialiser sur la racine et bouton Réinitialiser ajouté par page.js avant Plein écran",
  racine.hasAttribute("data-reinitialiser") && !!racine.querySelector(".grc__entete .reinitialiser") && racine.querySelector(".grc__entete .reinitialiser").nextElementSibling === racine.querySelector(".grc__entete .plein-ecran"));
const etat = () => JSON.stringify({ v: vueVisible(), p: panneauxVisibles(), b: boutonsPresses(), c: tous(".est-choisi").length });
const depart = JSON.stringify({ v: "ensemble", p: ["accueil"], b: [], c: 0 });
clic(racine.querySelector(".grc__entete .reinitialiser"));
verifier("Réinitialiser donne l'état du chargement", etat() === depart, etat());
const bAth = racine.querySelector('.grc__bouton[data-lieu="athenes"]');
clic(bAth);
const vueAth = vueVisible();
clic(bAth);
verifier("un second clic sur le bouton choisi le désélectionne et ramène la vue d'avant", vueAth === "peloponnese" && etat() === depart, etat());
clic(racine.querySelector('.grc__bouton[data-lieu="milet"]'));
allerVue("peloponnese");
clic(racine.querySelector(".grc__entete .reinitialiser"));
verifier("Réinitialiser après plusieurs actions ramène l'état du chargement", etat() === depart, etat());

console.log("COLONNE : LIEUX DE LA CARTE AFFICHÉE");
const visiblesListe = () => tous(".grc__bouton").filter((b) => !b.hidden).map((b) => b.getAttribute("data-lieu"));
VUES.forEach((v) => {
  allerVue(v);
  const attendus = boutons.filter((b) => b.getAttribute("data-liste").split(" ").includes(v)).map((b) => b.getAttribute("data-lieu"));
  verifier(`vue ${v} : la liste ne montre que les lieux nommés sur cette carte`,
    visiblesListe().join() === attendus.join() && attendus.length > 0 && attendus.every((c) => carte(v).querySelector(`[data-lieu="${c}"]`)), visiblesListe().join());
  verifier(`vue ${v} : les groupes vides sont masqués`,
    tous(".grc__choix .grc__groupe").every((gr) => gr.hidden === !gr.querySelector(".grc__bouton:not([hidden])")));
});
allerVue("peloponnese");
verifier("vue Attique et Péloponnèse : Athènes et Sparte listées, pas Massalia",
  visiblesListe().includes("athenes") && visiblesListe().includes("sparte") && !visiblesListe().includes("massalia"));
verifier("colonne : la liste, puis la fiche, dans une boîte qui défile", (() => { const c = racine.querySelector(".grc__cote > .grc__cote-int"); return !!c && c.firstElementChild.classList.contains("grc__choix") && c.children[1].classList.contains("grc__contenu"); })());
verifier("chaque puce porte une pastille", tous(".grc__bouton").every((b) => b.querySelector(".grc__pastille")));

console.log("RÉGIONS");
allerVue("regions");
verifier("l'onglet Régions affiche la carte des régions", vueVisible() === "regions" && racine.querySelector('.grc__vue[data-vue="regions"]').getAttribute("aria-pressed") === "true", vueVisible());
verifier("la colonne ne liste plus rien : les régions se choisissent sur la carte", visiblesListe().length === 0);
verifier("légende des cinq ensembles de régions", tous(".grc__legende > span").length === 5 && racine.getAttribute("data-vue") === "regions");
verifier("chaque région est un bouton accessible au clavier, coloré selon son ensemble",
  tous(".grc__region").every((z) => z.getAttribute("role") === "button" && z.getAttribute("tabindex") === "0" && z.getAttribute("aria-label") && /grc__region--(nord|centre|pelo|iles|asie)/.test(z.getAttribute("class")) && /grc__region--t[0-3]/.test(z.getAttribute("class"))));
verifier("titre de la colonne : Les régions", racine.querySelector(".grc__choix-titre").textContent === "Les régions");
verifier("accueil propre aux régions", panneauxVisibles().join() === "accueil-regions", panneauxVisibles().join());
boutonsRegions.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  const vue = b.getAttribute("data-vue");
  allerVue("ensemble");
  choisirB(b);
  const zone = carte(vue).querySelector(`.grc__region[data-lieu="${cle}"]`);
  const nom = carte(vue).querySelector(`.grc__etiq--reg[data-lieu="${cle}"]`);
  verifier(`${b.textContent} : délimitée, nommée et mise en évidence (${vue})`,
    vueVisible() === vue && zone && zone.getAttribute("d").length > 20 && zone.classList.contains("est-choisi") && nom && nom.textContent === b.textContent && panneauxVisibles().join() === cle,
    `${vueVisible()} ${panneauxVisibles()}`);
});
verifier("chaque région est nommée sur les cartes annoncées par data-vues, et seulement là",
  boutonsRegions.every((b) => { const vs = b.getAttribute("data-vues").split(" "); return vs.every((v) => carte(v).querySelector(`.grc__etiq--reg[data-lieu="${b.getAttribute("data-lieu")}"]`)) && tous(`.grc__etiq--reg[data-lieu="${b.getAttribute("data-lieu")}"]`).length === vs.length; }));
verifier("les régions sont découpées par le trait de côte", tous(".grc__svg--regions .grc__regions").every((g) => /url\(#grc-clip-/.test(g.getAttribute("clip-path"))));
allerVue("regions");
clic(carte("regions").querySelector('.grc__zoom[data-zoom="regions-detail"]'));
verifier("le cadre agrandit la Grèce centrale et le Péloponnèse", vueVisible() === "regions-detail", vueVisible());
verifier("le bouton Régions reste actif dans le détail", racine.querySelector('.grc__vue[data-vue="regions"]').getAttribute("aria-pressed") === "true");
clic(carte("regions-detail").querySelector('.grc__region[data-lieu="laconie"]'));
verifier("un clic sur une région la choisit", panneauxVisibles().join() === "laconie" && boutonsPresses().join() === "laconie");
carte("regions-detail").querySelector('.grc__region[data-lieu="arcadie"]').dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
verifier("la touche Entrée choisit une région", panneauxVisibles().join() === "arcadie", panneauxVisibles().join());
clic(carte("regions-detail").querySelector('.grc__region[data-lieu="laconie"]'));
verifier("la fiche de la Laconie parle de Sparte", /Sparte/.test(racine.querySelector("#grc-laconie").textContent));
allerVue("peloponnese");
verifier("revenir aux lieux ferme la fiche de la région", panneauxVisibles().join() === "accueil" && boutonsPresses().length === 0, panneauxVisibles().join());
clic(racine.querySelector('.grc__bouton[data-lieu="athenes"]'));
allerVue("regions");
verifier("passer aux régions ferme la fiche d'un lieu", panneauxVisibles().join() === "accueil-regions", panneauxVisibles().join());

console.log("EXERCICE");
const exo = racine.querySelector('.grc__vue[data-vue="exercice"]');
const caseEx = (id) => racine.querySelector(`.grc__case[data-case="${id}"]`);
const etiquette = (id) => racine.querySelector(`.grc__etiquette[data-etiquette="${id}"]`);
const visibles = () => tous(".grc__etiquette").filter((e) => !e.hidden && e.closest(".grc__banque")).map((e) => e.getAttribute("data-etiquette")).sort();
const placer = (etiq, c) => { clic(etiquette(etiq)); clic(caseEx(c)); };
const bilanEx = () => racine.querySelector(".grc__ex-bilan").textContent;
verifier("bouton Exercice dans la barre des vues", !!exo);
clic(exo);
verifier("l'exercice affiche la carte muette des mers", vueVisible() === "exercice-mers" && racine.classList.contains("est-exercice"), vueVisible());
verifier("la liste des lieux et les fiches sont masquées", racine.classList.contains("est-exercice"));
const MERS_EX = ["adriatique", "egee", "ionienne", "mediterranee", "pont", "propontide", "tyrrhenienne"];
verifier("étape 1 : sept étiquettes de mers dans la banque", visibles().join() === MERS_EX.join(), visibles().join());
verifier("sept cases sur la carte des mers", tous(".grc__case", carte("exercice-mers")).length === 7);
verifier("les cases n'affichent pas la réponse", tous(".grc__case").every((c) => c.querySelector(".grc__case-texte").textContent === "" && /^Case \d+, vide$/.test(c.getAttribute("aria-label"))));
verifier("aucun nom de lieu écrit sur les cartes muettes", tous(".grc__svg--exercice text").every((t) => /^\d*$/.test(t.textContent)));
clic(etiquette("egee"));
verifier("choisir une étiquette la marque", etiquette("egee").getAttribute("aria-pressed") === "true");
clic(caseEx("egee"));
verifier("cliquer une case y place l'étiquette et la retire de la banque",
  caseEx("egee").querySelector(".grc__case-texte").textContent === "Mer Égée" && !visibles().includes("egee") && /Mer Égée/.test(caseEx("egee").getAttribute("aria-label")));
placer("ionienne", "adriatique");
clic(racine.querySelector(".grc__ex-verifier"));
verifier("Vérifier : bonne case en vert, mauvaise en rouge",
  caseEx("egee").classList.contains("est-juste") && caseEx("adriatique").classList.contains("est-faux"));
verifier("le bilan compte les bonnes réponses et les cases vides", /^1 bonne réponse sur 7\./.test(bilanEx()) && /5 cases vides/.test(bilanEx()), bilanEx());
clic(caseEx("adriatique"));
verifier("cliquer une case remplie reprend son étiquette, prête à replacer",
  !caseEx("adriatique").classList.contains("est-rempli") && etiquette("ionienne").getAttribute("aria-pressed") === "true" && visibles().includes("ionienne"));
clic(caseEx("ionienne"));
MERS_EX.filter((m) => !["egee", "ionienne"].includes(m)).forEach((m) => placer(m, m));
verifier("banque vide quand tout est placé", visibles().length === 0);
clic(racine.querySelector(".grc__ex-verifier"));
verifier("tout juste : félicitations et invitation à l'étape 2", /^Bravo! Les 7 étiquettes/.test(bilanEx()) && /étape 2/.test(bilanEx()) && tous(".grc__case.est-juste", carte("exercice-mers")).length === 7, bilanEx());
clic(racine.querySelector('.grc__etape[data-etape="grece"]'));
verifier("étape 2 : carte muette de l'Attique et du Péloponnèse", vueVisible() === "exercice-grece", vueVisible());
verifier("étape 2 : Attique, Péloponnèse, Athènes, Sparte et trois autres cités",
  visibles().join() === ["argos", "athenes", "attique", "corinthe", "peloponnese", "sparte", "thebes"].join(), visibles().join());
verifier("étape 2 : les cinq cités sont reliées à un point", tous(".grc__case", carte("exercice-grece")).filter((c) => c.querySelector(".grc__ex-point")).length === 5);
["attique", "peloponnese", "athenes", "sparte", "corinthe", "thebes", "argos"].forEach((c) => placer(c, c));
clic(racine.querySelector(".grc__ex-verifier"));
verifier("étape 2 réussie", /^Bravo! Les 7 étiquettes/.test(bilanEx()) && !/étape 2/.test(bilanEx()), bilanEx());
clic(racine.querySelector(".grc__ex-recommencer"));
verifier("Recommencer vide les cases de l'étape", tous(".grc__case.est-rempli", carte("exercice-grece")).length === 0 && visibles().length === 7 && bilanEx() === "");
clic(racine.querySelector('.grc__etape[data-etape="mers"]'));
verifier("l'étape 1 garde ses réponses", tous(".grc__case.est-rempli", carte("exercice-mers")).length === 7);
allerVue("grece");
verifier("un bouton de vue quitte l'exercice", vueVisible() === "grece" && !racine.classList.contains("est-exercice"));
clic(exo);
clic(racine.querySelector(".grc__entete .reinitialiser"));
verifier("Réinitialiser quitte l'exercice et vide toutes les cases", etat() === depart && !racine.classList.contains("est-exercice") && tous(".grc__case.est-rempli").length === 0, etat());

console.log("PLEIN ÉCRAN");
const pleinBouton = racine.querySelector(".grc__entete .plein-ecran");
const replier = racine.querySelector(".grc__replier");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && /Afficher/.test(replier.textContent));
  clic(replier);
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
const texte = racine.textContent;
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(texte));
verifier("dates en négatif, sans « av. J.-C. »", !/av\.\s*J\.-C\./.test(texte) && !/av\.\s*J\.-C\./.test(composant));
verifier("chaque panneau a un lieu, un rôle, un texte et un « Aujourd'hui » ou « À savoir »",
  tous(".grc__panneau:not(.grc__panneau--accueil)").every((p) => p.querySelector(".grc__lieu") && p.querySelector(".grc__role") && p.querySelector(".grc__detail").textContent.length > 80 && /^(Aujourd'hui|À savoir)\./.test(p.querySelector(".grc__auj").textContent)));
verifier("chaque vue a une description pour les lecteurs d'écran",
  tous(".grc__svg").every((s) => /^(img|group)$/.test(s.getAttribute("role")) && (s.getAttribute("aria-label") || "").length > 40));
verifier("la source nomme Natural Earth et signale les côtes qui ont bougé", /Natural Earth/.test(texte) && /Milet/.test(racine.querySelector(".grc__source").textContent));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
