/*
 * Test de la carte du Grand commerce et de la peste noire dans un DOM simulé.
 *     node outils/test_grand_commerce.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 * Le mouvement réduit est demandé : les déplacements de la carte se font alors
 * d'un coup, ce qui rend le test prévisible.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "grand-commerce.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La peste noire</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.matchMedia = (requete) => ({
  matches: /prefers-reduced-motion:\s*reduce/.test(requete), media: requete,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
});
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const racine = document.getElementById("grand-commerce");
const api = racine && racine.grandCommerce;
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
function touche(el, cle) { el.dispatchEvent(new window.KeyboardEvent("keydown", { key: cle, bubbles: true })); }
const svg = un(".gco__svg");
const panneauxVisibles = () => tous(".gco__panneau.est-visible").map((p) => p.getAttribute("data-panneau"));
const presses = () => tous('.gco__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-produit") || b.getAttribute("data-lieu") || b.getAttribute("data-action"));
const vueChoisie = () => tous('.gco__vue[aria-pressed="true"]').map((b) => b.getAttribute("data-vue")).join();
const fenetre = () => (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
const surlignes = () => tous(".gco__surlignage .gco__surligne");
const etendue = JSON.parse((script.match(/"etendue":(\[[^\]]+\])/) || [0, "null"])[1]);
const donnees = JSON.parse(script.slice(script.indexOf("var D = ") + 8, script.indexOf(";\n", script.indexOf("var D = "))));
const lieu = (cle) => un(`.gco__lieu[data-lieu="${cle}"]`);
const avecClasse = (classe) => tous(".gco__lieu").filter((l) => l.classList.contains(classe)).map((l) => l.getAttribute("data-lieu")).sort();

// Textes visibles : le composant sans son style ni son script.
const copie = racine.cloneNode(true);
tous("style, script", copie).forEach((el) => el.remove());
const visible = copie.textContent;

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.grandCommerce === api);
const boutonsProduits = tous(".gco__bouton[data-produit]");
const boutonsLieux = tous(".gco__bouton[data-lieu]");
verifier("7 produits à choisir", boutonsProduits.length === 7, boutonsProduits.length);
verifier("16 villes marchandes à choisir", boutonsLieux.length === 16, boutonsLieux.length);
verifier("un bouton pour suivre la peste noire", tous(".gco__bouton--visite").length === 1);
verifier("un panneau par bouton, relié par aria-controls",
  boutonsProduits.concat(boutonsLieux).every((b) => {
    const p = document.getElementById(b.getAttribute("aria-controls"));
    const cle = b.getAttribute("data-produit") ? "produit-" + b.getAttribute("data-produit") : "lieu-" + b.getAttribute("data-lieu");
    return p && p.getAttribute("data-panneau") === cle;
  }));
verifier("neuf étapes à la visite de la peste, bilan compris", tous(".gco__panneau--etape").length === 9 && donnees.etapes.length === 9, tous(".gco__panneau--etape").length);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("chaque <use> vise un élément existant",
  tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("la carte a une description pour les lecteurs d'écran",
  svg.getAttribute("role") === "img" && (svg.getAttribute("aria-label") || "").length > 60);
const marqueurs = tous(".gco__lieu");
verifier("29 villes sur la carte : 16 marchandes et 13 de la peste seulement",
  marqueurs.length === 29 && avecClasse("gco__lieu--commerce").length === 16, marqueurs.length);
verifier("chaque ville marchande a son point, une seule fois, avec le nom de son bouton",
  boutonsLieux.every((b) => {
    const cle = b.getAttribute("data-lieu");
    return tous(`.gco__lieu[data-lieu="${cle}"]`).length === 1 && un(".gco__nom-texte", lieu(cle)).textContent === b.textContent
      && lieu(cle).classList.contains("gco__lieu--commerce");
  }));
const villesPeste = tous(".gco__lieu--peste");
verifier("26 villes touchées par la peste, chacune avec son étape et sa date",
  villesPeste.length === 26 && villesPeste.every((l) => l.hasAttribute("data-etape") && l.getAttribute("data-date") && un(".gco__date", l)
    && un(".gco__date", l).textContent === l.getAttribute("data-court")), villesPeste.length);
const badges = tous(".gco__badge");
verifier("9 pastilles d'origine, au moins une par produit",
  badges.length === 9 && boutonsProduits.every((b) => tous(`.gco__badge[data-produit="${b.getAttribute("data-produit")}"]`).length >= 1), badges.length);
const routes = tous(".gco__route");
verifier("48 tronçons de route du commerce, sur terre ou sur mer",
  routes.length === 48 && routes.every((r) => /gco__route--(terre|mer)/.test(r.getAttribute("class"))), routes.length);
verifier("12 chemins de la peste seulement, dessinés pendant la visite",
  Object.keys(donnees.aretes).length - routes.length === 12, Object.keys(donnees.aretes).length - routes.length);
verifier("l'étendue des données est connue", Array.isArray(etendue) && etendue.length === 4);

console.log("ACCUEIL");
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("la vue d'ensemble est choisie au départ", vueChoisie() === "ensemble", vueChoisie());
verifier("aucun choix au départ", presses().length === 0 && surlignes().length === 0 && !racine.classList.contains("est-filtre"));
verifier("la carte du commerce s'affiche, pas la visite", !racine.classList.contains("est-visite"));
const depart = fenetre();
verifier("la fenêtre de départ reste dans les données",
  depart[0] >= etendue[0] - 0.01 && depart[1] >= etendue[1] - 0.01 && depart[0] + depart[2] <= etendue[2] + 0.01 && depart[1] + depart[3] <= etendue[3] + 0.01, depart.join(" "));

console.log("PRODUITS");
boutonsProduits.forEach((b) => {
  const cle = b.getAttribute("data-produit");
  clic(b);
  const traits = surlignes();
  const miens = tous(`.gco__badge[data-produit="${cle}"]`);
  const ok = panneauxVisibles().join() === "produit-" + cle
    && presses().join() === cle
    && racine.classList.contains("est-filtre")
    && traits.length > 0
    && traits.every((u) => u.classList.contains("gco-p-" + cle) && u.classList.contains("gco__surligne--flux"))
    && miens.every((x) => x.classList.contains("est-choisi"))
    && badges.filter((x) => !miens.includes(x)).every((x) => x.classList.contains("est-pale"));
  verifier(`${b.textContent} : panneau, chemin surligné et pastilles`, ok, `${panneauxVisibles()} / ${traits.length} traits`);
  const panneau = document.getElementById("gco-produit-" + cle);
  const etapes = tous(".gco__chemin .gco__puce", panneau);
  verifier(`${b.textContent} : son chemin passe par des villes de la carte`,
    etapes.length >= 2 && etapes.every((p) => !p.hasAttribute("data-lieu") || lieu(p.getAttribute("data-lieu"))), etapes.length);
});
clic(un('.gco__bouton[data-produit="soie"]'));
const pales = marqueurs.filter((m) => m.classList.contains("est-pale")).map((m) => m.getAttribute("data-lieu"));
verifier("la soie : les villes hors de son chemin pâlissent", pales.includes("bergen") && !pales.includes("caffa") && !pales.includes("venise"), pales.join());

console.log("VILLES MARCHANDES");
boutonsLieux.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  clic(b);
  const lies = tous(".gco__route.est-lie");
  const ok = panneauxVisibles().join() === "lieu-" + cle && presses().join() === cle
    && lieu(cle).classList.contains("est-choisi") && surlignes().length === 0 && !racine.classList.contains("est-filtre") && lies.length >= 1;
  verifier(`${b.textContent} : panneau, point et routes reliées`, ok, `${panneauxVisibles()} / ${lies.length} routes`);
});
verifier("les villes touchées par la peste renvoient à leur étape",
  boutonsLieux.every((b) => {
    const cle = b.getAttribute("data-lieu");
    const lien = un(`#gco-lieu-${cle} .gco__lien[data-etape]`);
    return lieu(cle).hasAttribute("data-etape") ? !!lien && lien.getAttribute("data-etape") === lieu(cle).getAttribute("data-etape") : !lien;
  }));

console.log("RENVOIS ENTRE PANNEAUX");
clic(un('.gco__bouton[data-lieu="venise"]'));
clic(un('#gco-lieu-venise .gco__puce[data-produit="epices"]'));
verifier("depuis Venise, la puce des épices ouvre les épices", panneauxVisibles().join() === "produit-epices" && presses().join() === "epices");
clic(un('#gco-produit-epices .gco__puce[data-lieu="bruges"]'));
verifier("depuis les épices, la puce de Bruges ouvre Bruges", panneauxVisibles().join() === "lieu-bruges" && presses().join() === "bruges");
clic(un("#gco-lieu-bruges .gco__retour"));
verifier("le lien de retour ramène à l'accueil", panneauxVisibles().join() === "accueil" && presses().length === 0);
clic(un('.gco__bouton[data-lieu="venise"]'));
clic(un("#gco-lieu-venise .gco__lien"));
verifier("depuis Venise, « Voir sur la carte » ouvre l'étape où la peste l'atteint",
  racine.classList.contains("est-visite") && panneauxVisibles().join() === "etape-3" && lieu("venise").classList.contains("est-nouveau"));
clic(un(".gco__frise-fin"));

console.log("CARTE");
clic(un('.gco__lieu[data-lieu="florence"] .gco__point'));
verifier("un clic sur un point choisit la ville", panneauxVisibles().join() === "lieu-florence" && presses().join() === "florence");
clic(un('.gco__lieu[data-lieu="paris"] .gco__point'));
verifier("une ville de la peste seulement ne s'ouvre pas sur la carte du commerce", panneauxVisibles().join() === "lieu-florence");
clic(un('.gco__badge[data-produit="fourrures"] .gco__badge-fond'));
verifier("un clic sur une pastille choisit le produit", panneauxVisibles().join() === "produit-fourrures" && presses().join() === "fourrures");
clic(un('.gco__vue[data-vue="mediterranee"]'));
const med = fenetre();
verifier("la vue Méditerranée rapproche la carte", vueChoisie() === "mediterranee" && med[2] < depart[2] * 0.95, med.join(" "));
clic(un('.gco__vue[data-vue="nord"]'));
verifier("la vue Europe du Nord se place au nord", vueChoisie() === "nord" && fenetre()[1] < med[1], fenetre().join(" "));
const avant = fenetre();
clic(un('.gco__outil[data-zoom="plus"]'));
verifier("le bouton + agrandit", fenetre()[2] < avant[2] - 1 && vueChoisie() === "", fenetre().join(" "));
const milieu = fenetre();
clic(un('.gco__outil[data-zoom="moins"]'));
verifier("le bouton − réduit", fenetre()[2] > milieu[2] + 1);
for (let i = 0; i < 12; i++) clic(un('.gco__outil[data-zoom="moins"]'));
const loin = fenetre();
verifier("on ne recule jamais au-delà des données",
  loin[2] <= etendue[2] - etendue[0] + 0.01 && loin[3] <= etendue[3] - etendue[1] + 0.01 && loin[0] >= etendue[0] - 0.01 && loin[1] >= etendue[1] - 0.01, loin.join(" "));
for (let i = 0; i < 20; i++) clic(un('.gco__outil[data-zoom="plus"]'));
verifier("ni ne s'approche sans limite", fenetre()[2] >= 119.9, fenetre().join(" "));
const ici = fenetre();
touche(svg, "ArrowRight");
verifier("la flèche droite déplace la carte vers l'est", fenetre()[0] > ici[0]);
clic(un('.gco__outil[data-zoom="ensemble"]'));
verifier("la maison ramène la vue d'ensemble", vueChoisie() === "ensemble" && Math.abs(fenetre()[2] - depart[2]) < 0.5, fenetre().join(" "));
verifier("l'échelle affiche une distance en kilomètres", /^\d[\d\u00a0]* km$/.test(un(".gco__echelle-texte").textContent.replace(/\u00a0km/, " km")), un(".gco__echelle-texte").textContent);

console.log("LA PESTE NOIRE");
const etapesPanneaux = tous(".gco__panneau--etape").map((p) => p.getAttribute("data-panneau"));
const curseur = un(".gco__curseur");
const date = un(".gco__frise-date");
clic(un(".gco__bouton--visite"));
verifier("la visite commence en 1346",
  racine.classList.contains("est-visite") && panneauxVisibles().join() === "etape-0" && /^1346/.test(date.textContent) && curseur.value === "0", date.textContent);
verifier("le curseur décrit l'étape aux lecteurs d'écran", /^1346\u00a0: /.test(curseur.getAttribute("aria-valuetext") || ""), curseur.getAttribute("aria-valuetext"));
verifier("le bouton de la visite est enfoncé", presses().join() === "visite");
verifier("on ne peut pas reculer à la première étape", un(".gco__frise-prec").disabled && un(".gco__panneau.est-visible .gco__precedent").disabled);
verifier("en 1346, Tana et Caffa sont touchées, Constantinople pas encore",
  avecClasse("est-nouveau").join() === "caffa,tana" && lieu("constantinople").classList.contains("est-avenir"), avecClasse("est-nouveau").join());
verifier("les chemins de 1346 sont dessinés en rouge",
  surlignes().length === 2 && surlignes().every((u) => u.classList.contains("gco__peste")), surlignes().length);
const attendues = donnees.etapes.map((e) => e.villes.slice().sort().join());
let traits = surlignes().length;
let croissant = true;
for (let i = 1; i < 9; i++) {
  clic(un(".gco__frise-suiv"));
  const n = surlignes().length;
  if (n < traits) croissant = false;
  traits = n;
  const ok = panneauxVisibles().join() === etapesPanneaux[i] && curseur.value === String(i)
    && date.textContent.indexOf(donnees.etapes[i].court) === 0
    && avecClasse("est-nouveau").join() === attendues[i]
    && donnees.etapes.slice(0, i).every((e) => e.villes.every((v) => lieu(v).classList.contains("est-touche") && !lieu(v).classList.contains("est-nouveau")))
    && donnees.etapes.slice(i + 1).every((e) => e.villes.every((v) => lieu(v).classList.contains("est-avenir")));
  verifier(`étape ${i + 1} : ${un(".gco__panneau.est-visible .gco__role").textContent}`, ok, `${panneauxVisibles()} / ${avecClasse("est-nouveau").join()}`);
  const courants = surlignes().filter((u) => u.classList.contains("gco__surligne--flux")).length;
  verifier(`étape ${i + 1} : seuls les chemins de l'étape avancent en pointillé`, courants === donnees.etapes[i].troncons.length, courants);
}
const total = donnees.etapes.reduce((s, e) => s + e.troncons.length, 0);
verifier("le chemin de la peste ne fait que s'allonger", croissant && traits === total, `${traits} / ${total}`);
verifier("au bilan, les 26 villes sont touchées", avecClasse("est-touche").length === 26);
verifier("on ne peut pas avancer au bilan", un(".gco__frise-suiv").disabled);
const bilan = un(".gco__panneau--bilan");
verifier("le bilan donne quatre estimations et quatre conséquences",
  tous(".gco__stats > li", bilan).length === 4 && tous(".gco__raisons > li", bilan).length === 4);
verifier("le bilan propose de revenir au commerce", !!un(".gco__panneau.est-visible .gco__terminer"));
curseur.value = "4";
curseur.dispatchEvent(new window.Event("input", { bubbles: true }));
verifier("le curseur du temps mène à l'été 1348", panneauxVisibles().join() === "etape-4" && avecClasse("est-nouveau").join() === attendues[4], panneauxVisibles().join());
clic(un('.gco__lieu[data-lieu="bergen"] .gco__point'));
verifier("un clic sur Bergen mène à l'étape où la peste l'atteint", panneauxVisibles().join() === "etape-5" && curseur.value === "5");
const entree = new window.Event("pointerenter");
lieu("bergen").dispatchEvent(entree);
verifier("au survol, la bulle donne la date d'arrivée", /^Bergen\u00a0: à l'été 1349$/.test(un(".gco__bulle").textContent) && !un(".gco__bulle").hidden, un(".gco__bulle").textContent);
lieu("bergen").dispatchEvent(new window.Event("pointerleave"));
clic(un(".gco__panneau.est-visible .gco__precedent"));
verifier("on peut revenir en arrière", panneauxVisibles().join() === "etape-4");
verifier("les villes marchandes sans date connue sont absentes de la visite",
  !lieu("bruges").classList.contains("gco__lieu--peste") && !lieu("champagne").classList.contains("gco__lieu--peste"));
clic(un('.gco__bouton[data-produit="ble"]'));
verifier("choisir un produit quitte la visite", !racine.classList.contains("est-visite") && panneauxVisibles().join() === "produit-ble" && !surlignes().some((u) => u.classList.contains("gco__peste")));
clic(un(".gco__bouton--visite"));
clic(un(".gco__frise-fin"));
verifier("le bouton × quitte la visite", panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && surlignes().length === 0 && avecClasse("est-touche").length === 0);
clic(un('.gco__panneau--accueil .gco__appel[data-action="visite"]'));
verifier("l'appel du panneau d'accueil lance la visite", panneauxVisibles().join() === "etape-0");
api.allerEtape(8, true);
clic(un(".gco__panneau.est-visible .gco__terminer"));
verifier("revenir au commerce ramène l'accueil et la vue d'ensemble",
  panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && vueChoisie() === "ensemble");

console.log("DATES");
const ordre = { "janv.": 1, "début": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6, "été": 7, "août": 8, "oct.": 10, "automne": 10.5, "nov.": 11, "fin": 12 };
const cleDate = (c) => +c.match(/\d{4}/)[0] * 100 + (ordre[c.split(" ")[0]] || 0);
verifier("chaque étape liste ses villes dans l'ordre chronologique",
  tous(".gco__panneau--etape").slice(0, 8).every((p) => {
    const dates = tous(".gco__touchee-date", p).map((d) => cleDate(d.textContent));
    return dates.length >= 1 && dates.every((d, k) => k === 0 || d >= dates[k - 1]);
  }));
verifier("les étapes se suivent dans le temps",
  donnees.etapes.slice(0, 8).every((e, k, liste) => k === 0 || Math.min(...e.villes.map((v) => cleDate(lieu(v).getAttribute("data-court"))))
    >= Math.min(...liste[k - 1].villes.map((v) => cleDate(lieu(v).getAttribute("data-court"))))));
verifier("chaque ville des panneaux d'étape est sur la carte avec la même date",
  tous(".gco__panneau--etape").slice(0, 8).every((p, k) => tous(".gco__touchees > li", p).every((li) => {
    const nom = un(".gco__touchee-nom", li).textContent;
    const l = marqueurs.find((m) => m.getAttribute("data-nom") === nom);
    return l && l.getAttribute("data-etape") === String(k) && l.getAttribute("data-court") === un(".gco__touchee-date", li).textContent;
  })));
verifier("Messine en octobre 1347, Marseille en novembre, Paris à l'été 1348, Moscou en 1353",
  lieu("messine").getAttribute("data-court") === "oct. 1347" && lieu("marseille").getAttribute("data-court") === "nov. 1347"
    && lieu("paris").getAttribute("data-court") === "été 1348" && lieu("moscou").getAttribute("data-court") === "1353");

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".gco__entete > .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".gco__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  verifier("les choix et les textes sont rangés à côté de la carte",
    !!un(".gco__cote > .gco__choix") && !!un(".gco__cote > .gco__contenu") && !!un(".gco__cadre > .gco__carte"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(un('.gco__bouton[data-produit="poisson"]'));
  verifier("en plein écran, un choix ouvre toujours son panneau", panneauxVisibles().join() === "produit-poisson");
  clic(un(".gco__bouton--visite"));
  verifier("en plein écran, la visite s'ouvre aussi", panneauxVisibles().join() === "etape-0" && racine.classList.contains("est-visite"));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(racine.textContent));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(visible), (visible.match(/.{30},\s+et\s.{10}/) || [""])[0]);
const sansAdresses = visible.replace(/https?:\/\//g, "");
verifier("une espace insécable devant chaque deux-points", !/(?<!\u00a0):/.test(sansAdresses), (sansAdresses.match(/.{20}(?<!\u00a0):.{10}/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?!\u00a0)/.test(visible) && !/(?<!\u00a0)»/.test(visible), (visible.match(/.{10}«(?!\u00a0).{10}|.{10}(?<!\u00a0)».{10}/) || [""])[0]);
verifier("aucune espace devant ; ! ? (usage québécois)", !/[ \u00a0\u202f][;!?]/.test(visible), (visible.match(/.{20}[ \u00a0\u202f][;!?].{5}/) || [""])[0]);
verifier("aucun nombre coupé par une espace ordinaire", !/\d \d{3}\b/.test(visible), (visible.match(/.{15}\d \d{3}\b.{5}/) || [""])[0]);
verifier("chaque produit dit d'où il vient, à quoi il sert, et un fait étonnant",
  tous(".gco__panneau[data-panneau^='produit-']").every((p) => tous(".gco__detail", p).length >= 2 && un(".gco__savais", p)));
verifier("chaque ville a un rôle, un texte et ce qu'elle est aujourd'hui",
  tous(".gco__panneau[data-panneau^='lieu-']").every((p) => un(".gco__role", p) && un(".gco__detail", p).textContent.length > 80 && /Aujourd/.test(un(".gco__auj", p).textContent)));
verifier("chaque étape de la peste a un titre, ses villes et un texte",
  tous(".gco__panneau--etape").slice(0, 8).every((p) => un(".gco__role", p) && tous(".gco__touchees > li", p).length >= 1 && tous(".gco__detail", p).length >= 1));
verifier("les estimations de mortalité sont présentées comme des estimations", /estimations/.test(bilan.textContent));
verifier("la source nomme Natural Earth et Benedictow", /Natural Earth/.test(visible) && /Benedictow/.test(visible));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
