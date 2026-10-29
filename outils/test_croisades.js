/*
 * Test de la carte des croisades dans un DOM simulé.
 *     node outils/test_croisades.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 * Le mouvement réduit est demandé : les déplacements de la carte se font
 * alors d'un coup, ce qui rend le test prévisible.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "croisades.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les croisades</h2>
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
const racine = document.getElementById("croisades");
const api = racine && racine.croisades;
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
const svg = un(".crd__svg");
const panneauxVisibles = () => tous(".crd__panneau.est-visible").map((p) => p.getAttribute("data-panneau"));
const presses = () => tous('.crd__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-croisade") || b.getAttribute("data-lieu") || b.getAttribute("data-action"));
const vueChoisie = () => tous('.crd__vue[aria-pressed="true"]').map((b) => b.getAttribute("data-vue")).join();
const fenetre = () => (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
const surlignes = () => tous(".crd__surlignage .crd__surligne");
const etatsVisibles = () => tous(".crd__etat.est-visible").map((p) => p.getAttribute("data-etat"));

// Textes visibles : le composant sans son style ni son script.
const copie = racine.cloneNode(true);
tous("style, script", copie).forEach((el) => el.remove());
const visible = copie.textContent;

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.croisades === api);
const boutonsCroisades = tous(".crd__bouton--croisade");
const boutonsLieux = tous(".crd__bouton[data-lieu]");
verifier("5 croisades à choisir", boutonsCroisades.length === 5, boutonsCroisades.length);
verifier("31 lieux à choisir", boutonsLieux.length === 31, boutonsLieux.length);
verifier("un bouton pour suivre la première croisade", tous(".crd__bouton--visite").length === 1);
verifier("un bouton pour les États latins", tous(".crd__bouton--etats").length === 1);
verifier("un panneau par bouton, relié par aria-controls",
  boutonsCroisades.concat(boutonsLieux).every((b) => {
    const p = document.getElementById(b.getAttribute("aria-controls"));
    const cle = b.getAttribute("data-croisade") ? "croisade-" + b.getAttribute("data-croisade") : "lieu-" + b.getAttribute("data-lieu");
    return p && p.getAttribute("data-panneau") === cle;
  }));
verifier("sept étapes à la première croisade", tous(".crd__panneau--etape").length === 7, tous(".crd__panneau--etape").length);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("chaque <use> vise un élément existant",
  tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("chaque aria-controls vise un élément existant",
  tous("[aria-controls]").every((b) => document.getElementById(b.getAttribute("aria-controls"))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("le titre du composant est un faux titre de niveau 3", un(".crd__titre").getAttribute("role") === "heading" && un(".crd__titre").getAttribute("aria-level") === "3");
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("l'en-tête se termine par __entete", /__entete$/.test(un(".crd__entete").className));
verifier("la carte a une description pour les lecteurs d'écran",
  svg.getAttribute("role") === "img" && (svg.getAttribute("aria-label") || "").length > 60);
const marqueurs = tous(".crd__lieu");
verifier("chaque lieu a son point sur la carte, et une seule fois",
  boutonsLieux.every((b) => tous(`.crd__lieu[data-lieu="${b.getAttribute("data-lieu")}"]`).length === 1));
const routes = tous(".crd__route");
verifier("55 tronçons d'itinéraire, sur terre ou sur mer",
  routes.length === 55 && routes.every((r) => /crd__route--(terre|mer)/.test(r.getAttribute("class"))), routes.length);
verifier("quatre États latins dessinés", tous(".crd__etat").length === 4, tous(".crd__etat").length);

console.log("ACCUEIL");
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("la vue d'ensemble est choisie au départ", vueChoisie() === "ensemble", vueChoisie());
verifier("aucun choix au départ", presses().length === 0 && surlignes().length === 0 && !racine.classList.contains("est-filtre"));
verifier("hors de la visite, pas de bannière", !racine.classList.contains("est-visite"));
const depart = fenetre();

console.log("CROISADES");
boutonsCroisades.forEach((b) => {
  const cle = b.getAttribute("data-croisade");
  clic(b);
  const traits = surlignes();
  verifier(`${b.textContent.trim()} : panneau et itinéraire surligné`,
    panneauxVisibles().join() === "croisade-" + cle && presses().join() === cle && racine.classList.contains("est-filtre") && traits.length > 0,
    `${panneauxVisibles()} / ${traits.length} traits`);
  const etapes = tous(".crd__chemin .crd__puce", document.getElementById("crd-croisade-" + cle));
  verifier(`${b.textContent.trim()} : son chemin passe par des lieux de la carte`,
    etapes.length >= 2 && etapes.every((p) => un(`.crd__lieu[data-lieu="${p.getAttribute("data-lieu")}"]`)), etapes.length);
});

console.log("LIEUX");
boutonsLieux.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  clic(b);
  const point = un(`.crd__lieu[data-lieu="${cle}"]`);
  verifier(`${b.textContent.trim()} : panneau et point choisi`,
    panneauxVisibles().join() === "lieu-" + cle && presses().join() === cle && point.classList.contains("est-choisi"), panneauxVisibles().join());
});

console.log("RENVOIS ENTRE PANNEAUX");
clic(un('.crd__bouton[data-lieu="antioche"]'));
const puceC = un('#crd-lieu-antioche .crd__puce[data-croisade]');
verifier("Antioche renvoie à une croisade", !!puceC);
if (puceC) {
  const c = puceC.getAttribute("data-croisade");
  clic(puceC);
  verifier("la puce ouvre la croisade", panneauxVisibles().join() === "croisade-" + c && presses().join() === c);
  const puceL = un(`#crd-croisade-${c} .crd__puce[data-lieu]`);
  clic(puceL);
  verifier("depuis la croisade, une puce de lieu ouvre le lieu", panneauxVisibles().join() === "lieu-" + puceL.getAttribute("data-lieu"));
}
clic(un(".crd__panneau.est-visible .crd__retour"));
verifier("le lien de retour ramène à l'accueil", panneauxVisibles().join() === "accueil" && presses().length === 0);

console.log("ÉTATS LATINS");
verifier("visibles à l'accueil, sans être choisis", etatsVisibles().length === 4 && tous(".crd__etat.est-choisi").length === 0);
clic(un('.crd__bouton[data-croisade="c4"]'));
verifier("cachés pendant la 4e croisade, qui ne va pas en Terre sainte", etatsVisibles().length < 4, etatsVisibles().join());
clic(un(".crd__bouton--etats"));
verifier("le bouton montre les quatre États", panneauxVisibles().join() === "etats" && etatsVisibles().length === 4, etatsVisibles().join());
const boutonEtat = un('.crd__etat-bouton[data-etat="edesse"]');
clic(boutonEtat);
verifier("choisir le comté d'Édesse le met en évidence", un('.crd__etat[data-etat="edesse"]').classList.contains("est-choisi"));
clic(un(".crd__panneau.est-visible .crd__retour"));

console.log("CARTE");
clic(un('.crd__lieu[data-lieu="jerusalem"]'));
verifier("un clic sur un point choisit le lieu", panneauxVisibles().join() === "lieu-jerusalem");
clic(un('.crd__vue[data-vue="orient"]'));
const ori = fenetre();
verifier("la vue Terre sainte rapproche la carte", vueChoisie() === "orient" && ori[2] < depart[2] * 0.5, ori.join(" "));
const avant = fenetre();
clic(un('.crd__outil[data-zoom="moins"]'));
verifier("le bouton − réduit", fenetre()[2] > avant[2] + 1 && vueChoisie() === "", fenetre().join(" "));
const milieu = fenetre();
clic(un('.crd__outil[data-zoom="plus"]'));
verifier("le bouton + agrandit", fenetre()[2] < milieu[2] - 1);
const ici = fenetre();
touche(svg, "ArrowLeft");
verifier("la flèche gauche déplace la carte vers l'ouest", fenetre()[0] < ici[0]);
clic(un('.crd__outil[data-zoom="ensemble"]'));
verifier("la maison ramène la vue d'ensemble", vueChoisie() === "ensemble" && Math.abs(fenetre()[2] - depart[2]) < 0.5, fenetre().join(" "));

console.log("LA PREMIÈRE CROISADE PAS À PAS");
const etapes = tous(".crd__panneau--etape").map((p) => p.getAttribute("data-panneau"));
const barre = un(".crd__barre-texte");
clic(un(".crd__bouton--visite"));
verifier("la visite commence à l'appel de Clermont",
  racine.classList.contains("est-visite") && panneauxVisibles().join() === etapes[0] && /1 sur 7/.test(barre.textContent), barre.textContent);
verifier("le bouton de la visite est enfoncé", presses().join() === "visite");
verifier("on ne peut pas reculer à la première étape", un(".crd__barre-prec").disabled);
for (let i = 1; i < 7; i++) {
  clic(un(".crd__barre-suiv"));
  verifier(`étape ${i + 1} : ${un(".crd__panneau.est-visible .crd__role").textContent}`,
    panneauxVisibles().join() === etapes[i] && barre.textContent.indexOf(`${i + 1} sur 7`) >= 0, panneauxVisibles().join() + " / " + barre.textContent);
}
verifier("à la dernière étape, les États latins apparaissent", etatsVisibles().length === 4, etatsVisibles().join());
verifier("on ne peut pas avancer à la dernière étape", un(".crd__barre-suiv").disabled);
clic(un(".crd__barre-prec"));
verifier("on peut revenir en arrière", panneauxVisibles().join() === etapes[5]);
clic(un(".crd__barre-fin"));
verifier("le bouton × quitte la visite", panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && surlignes().length === 0);
clic(un('.crd__panneau--accueil .crd__appel[data-action="visite"]'));
verifier("l'appel du panneau d'accueil lance la visite", panneauxVisibles().join() === etapes[0]);
clic(un(".crd__barre-fin"));

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".crd__entete > .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".crd__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  verifier("les choix et les textes sont rangés à côté de la carte",
    !!un(".crd__cote > .crd__choix") && !!un(".crd__cote > .crd__contenu") && !!un(".crd__cadre > .crd__carte"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && replier.textContent === "Afficher le texte");
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && replier.textContent === "Masquer le texte");
  clic(un('.crd__bouton[data-croisade="c3"]'));
  verifier("en plein écran, un choix ouvre toujours son panneau", panneauxVisibles().join() === "croisade-c3");
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(visible));
verifier("aucune virgule devant « et »", !/,[ \t\n\r]+et[ \t\n\r]/.test(visible), (visible.match(/.{30},\s+et\s.{10}/) || [""])[0]);
verifier("aucune espace devant ; ! ?", !/[   ][;!?]/.test(visible), (visible.match(/.{20}[   ][;!?].{5}/) || [""])[0]);
const sansAdresses = visible.replace(/https?:\/\//g, "");
verifier("une espace insécable devant chaque deux-points", !/(?<! ):/.test(sansAdresses), (sansAdresses.match(/.{20}(?<! ):.{10}/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?! )/.test(visible) && !/(?<! )»/.test(visible), (visible.match(/.{10}«(?! ).{10}|.{10}(?<! )».{10}/) || [""])[0]);
verifier("le script n'a aucune espace insécable cachée", script.indexOf(" ") < 0);
verifier("chaque lieu a un texte d'au moins 80 caractères et ce qu'il est aujourd'hui",
  tous(".crd__panneau[data-panneau^='lieu-']").every((p) => un(".crd__detail", p).textContent.length > 80 && /Aujourd/.test(un(".crd__auj", p).textContent)));
verifier("chaque croisade a un fait étonnant", tous(".crd__panneau[data-panneau^='croisade-']").every((p) => un(".crd__savais", p)));
verifier("Jérusalem est prise le 15 juillet 1099", /15 juillet 1099|15 juillet 1099/.test(visible));
verifier("la source nomme Natural Earth", /Natural Earth/.test(visible));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
