/*
 * Test de la carte de la route de la soie dans un DOM simulé.
 *     node outils/test_route_soie.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 * Le mouvement réduit est demandé : les déplacements de la carte et du sac de
 * poivre se font alors d'un coup, ce qui rend le test prévisible.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "route-soie.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>L'expansion européenne</h2>
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
const racine = document.getElementById("route-soie");
const api = racine && racine.routeSoie;
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
const svg = un(".rds__svg");
const panneauxVisibles = () => tous(".rds__panneau.est-visible").map((p) => p.getAttribute("data-panneau"));
const presses = () => tous('.rds__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-produit") || b.getAttribute("data-lieu") || b.getAttribute("data-action"));
const vueChoisie = () => tous('.rds__vue[aria-pressed="true"]').map((b) => b.getAttribute("data-vue")).join();
const fenetre = () => (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
const surlignes = () => tous(".rds__surlignage .rds__surligne");
const etendue = JSON.parse((script.match(/"etendue":(\[[^\]]+\])/) || [0, "null"])[1]);

// Textes visibles : le composant sans son style ni son script.
const copie = racine.cloneNode(true);
tous("style, script", copie).forEach((el) => el.remove());
const visible = copie.textContent;

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.routeSoie === api);
const boutonsProduits = tous(".rds__bouton[data-produit]");
const boutonsLieux = tous(".rds__bouton[data-lieu]");
verifier("11 produits à choisir", boutonsProduits.length === 11, boutonsProduits.length);
verifier("30 villes et ports à choisir", boutonsLieux.length === 30, boutonsLieux.length);
verifier("un bouton pour suivre le sac de poivre", tous(".rds__bouton--visite").length === 1);
verifier("un panneau par bouton, relié par aria-controls",
  boutonsProduits.concat(boutonsLieux).every((b) => {
    const p = document.getElementById(b.getAttribute("aria-controls"));
    const cle = b.getAttribute("data-produit") ? "produit-" + b.getAttribute("data-produit") : "lieu-" + b.getAttribute("data-lieu");
    return p && p.getAttribute("data-panneau") === cle;
  }));
verifier("dix étapes au voyage du poivre", tous(".rds__panneau--etape").length === 10, tous(".rds__panneau--etape").length);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("chaque <use> vise un élément existant",
  tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("la carte a une description pour les lecteurs d'écran",
  svg.getAttribute("role") === "img" && (svg.getAttribute("aria-label") || "").length > 60);
const marqueurs = tous(".rds__lieu");
verifier("chaque ville a son point sur la carte, et une seule fois",
  marqueurs.length === 30 && boutonsLieux.every((b) => tous(`.rds__lieu[data-lieu="${b.getAttribute("data-lieu")}"]`).length === 1));
verifier("chaque point porte le nom de son bouton",
  boutonsLieux.every((b) => un(`.rds__lieu[data-lieu="${b.getAttribute("data-lieu")}"] .rds__nom`).textContent === b.textContent));
const badges = tous(".rds__badge");
verifier("14 pastilles d'origine, au moins une par produit",
  badges.length === 14 && boutonsProduits.every((b) => tous(`.rds__badge[data-produit="${b.getAttribute("data-produit")}"]`).length >= 1), badges.length);
const routes = tous(".rds__route");
verifier("55 tronçons de route, sur terre ou sur mer",
  routes.length === 55 && routes.every((r) => /rds__route--(terre|mer)/.test(r.getAttribute("class"))), routes.length);
verifier("l'étendue des données est connue", Array.isArray(etendue) && etendue.length === 4);

console.log("ACCUEIL");
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("la vue d'ensemble est choisie au départ", vueChoisie() === "ensemble", vueChoisie());
verifier("aucun choix au départ", presses().length === 0 && surlignes().length === 0 && !racine.classList.contains("est-filtre"));
verifier("le sac de poivre est caché hors de la visite", !racine.classList.contains("est-visite"));
const depart = fenetre();
verifier("la fenêtre de départ reste dans les données",
  depart[0] >= etendue[0] - 0.01 && depart[1] >= etendue[1] - 0.01 && depart[0] + depart[2] <= etendue[2] + 0.01 && depart[1] + depart[3] <= etendue[3] + 0.01, depart.join(" "));

console.log("PRODUITS");
boutonsProduits.forEach((b) => {
  const cle = b.getAttribute("data-produit");
  clic(b);
  const traits = surlignes();
  const miens = tous(`.rds__badge[data-produit="${cle}"]`);
  const ok = panneauxVisibles().join() === "produit-" + cle
    && presses().join() === cle
    && racine.classList.contains("est-filtre")
    && traits.length > 0
    && traits.every((u) => u.classList.contains("rds-p-" + cle) && u.classList.contains("rds__surligne--flux"))
    && miens.every((x) => x.classList.contains("est-choisi"))
    && badges.filter((x) => !miens.includes(x)).every((x) => x.classList.contains("est-pale"));
  verifier(`${b.textContent} : panneau, chemin surligné et pastilles`, ok, `${panneauxVisibles()} / ${traits.length} traits`);
  const panneau = document.getElementById("rds-produit-" + cle);
  const etapes = tous(".rds__chemin .rds__puce", panneau);
  verifier(`${b.textContent} : son chemin passe par des villes de la carte`,
    etapes.length >= 2 && etapes.every((p) => un(`.rds__lieu[data-lieu="${p.getAttribute("data-lieu")}"]`)), etapes.length);
});
clic(un('.rds__bouton[data-produit="soie"]'));
const pales = marqueurs.filter((m) => m.classList.contains("est-pale")).map((m) => m.getAttribute("data-lieu"));
verifier("la soie : les villes hors de son chemin pâlissent", pales.includes("calicut") && !pales.includes("samarcande") && !pales.includes("venise"), pales.join());

console.log("VILLES ET PORTS");
boutonsLieux.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  clic(b);
  const point = un(`.rds__lieu[data-lieu="${cle}"]`);
  const lies = tous(".rds__route.est-lie");
  const ok = panneauxVisibles().join() === "lieu-" + cle && presses().join() === cle
    && point.classList.contains("est-choisi") && surlignes().length === 0 && !racine.classList.contains("est-filtre") && lies.length >= 1;
  verifier(`${b.textContent} : panneau, point et routes reliées`, ok, `${panneauxVisibles()} / ${lies.length} routes`);
});

console.log("RENVOIS ENTRE PANNEAUX");
clic(un('.rds__bouton[data-lieu="venise"]'));
clic(un('#rds-lieu-venise .rds__puce[data-produit="poivre"]'));
verifier("depuis Venise, la puce du poivre ouvre le poivre", panneauxVisibles().join() === "produit-poivre" && presses().join() === "poivre");
clic(un('#rds-produit-poivre .rds__puce[data-lieu="aden"]'));
verifier("depuis le poivre, la puce d'Aden ouvre Aden", panneauxVisibles().join() === "lieu-aden" && presses().join() === "aden");
clic(un('#rds-lieu-aden .rds__retour'));
verifier("le lien de retour ramène à l'accueil", panneauxVisibles().join() === "accueil" && presses().length === 0);

console.log("CARTE");
clic(un('.rds__lieu[data-lieu="samarcande"] .rds__point'));
verifier("un clic sur un point choisit la ville", panneauxVisibles().join() === "lieu-samarcande" && presses().join() === "samarcande");
clic(un('.rds__badge[data-produit="muscade"] .rds__badge-fond'));
verifier("un clic sur une pastille choisit le produit", panneauxVisibles().join() === "produit-muscade" && presses().join() === "muscade");
clic(un('.rds__vue[data-vue="mediterranee"]'));
const med = fenetre();
verifier("la vue Méditerranée rapproche la carte", vueChoisie() === "mediterranee" && med[2] < depart[2] * 0.75, med.join(" "));
const avant = fenetre();
clic(un('.rds__outil[data-zoom="plus"]'));
verifier("le bouton + agrandit", fenetre()[2] < avant[2] - 1 && vueChoisie() === "", fenetre().join(" "));
const milieu = fenetre();
clic(un('.rds__outil[data-zoom="moins"]'));
verifier("le bouton − réduit", fenetre()[2] > milieu[2] + 1);
for (let i = 0; i < 12; i++) clic(un('.rds__outil[data-zoom="moins"]'));
const loin = fenetre();
verifier("on ne recule jamais au-delà des données",
  loin[2] <= etendue[2] - etendue[0] + 0.01 && loin[3] <= etendue[3] - etendue[1] + 0.01 && loin[0] >= etendue[0] - 0.01 && loin[1] >= etendue[1] - 0.01, loin.join(" "));
for (let i = 0; i < 20; i++) clic(un('.rds__outil[data-zoom="plus"]'));
verifier("ni ne s'approche sans limite", fenetre()[2] >= 139.9, fenetre().join(" "));
const ici = fenetre();
touche(svg, "ArrowRight");
verifier("la flèche droite déplace la carte vers l'est", fenetre()[0] > ici[0]);
clic(un('.rds__outil[data-zoom="ensemble"]'));
verifier("la maison ramène la vue d'ensemble", vueChoisie() === "ensemble" && Math.abs(fenetre()[2] - depart[2]) < 0.5, fenetre().join(" "));

console.log("LE VOYAGE DU POIVRE");
const etapes = tous(".rds__panneau--etape").map((p) => p.getAttribute("data-panneau"));
const barre = un(".rds__barre-texte");
const sac = un(".rds__sac");
const posSac = () => (sac.getAttribute("transform").match(/translate\(([-\d.]+) ([-\d.]+)\)/) || []).slice(1).map(Number);
clic(un(".rds__bouton--visite"));
verifier("la visite commence à la première étape",
  racine.classList.contains("est-visite") && panneauxVisibles().join() === etapes[0] && /^Étape 1 sur 10/.test(barre.textContent), barre.textContent);
verifier("le bouton de la visite est enfoncé", presses().join() === "visite");
verifier("on ne peut pas reculer à la première étape", un(".rds__barre-prec").disabled && un(".rds__panneau.est-visible .rds__precedent").disabled);
let traits = surlignes().length;
let croissant = true;
for (let i = 1; i < 10; i++) {
  clic(un(".rds__barre-suiv"));
  const n = surlignes().length;
  if (n < traits) croissant = false;
  traits = n;
  verifier(`étape ${i + 1} : ${un(".rds__panneau.est-visible .rds__role").textContent}`,
    panneauxVisibles().join() === etapes[i] && barre.textContent.indexOf(`Étape ${i + 1} sur 10`) === 0, panneauxVisibles().join());
  if (etapes[i] === "etape-venise") {
    const v = un('.rds__lieu[data-lieu="venise"]');
    const p = posSac();
    verifier("à Venise, le sac est posé sur Venise",
      Math.abs(p[0] - +v.getAttribute("data-x")) < 0.01 && Math.abs(p[1] - +v.getAttribute("data-y")) < 0.01, p.join(" "));
  }
}
verifier("le chemin surligné ne fait que s'allonger", croissant);
verifier("on ne peut pas avancer à la dernière étape", un(".rds__barre-suiv").disabled);
verifier("la dernière étape propose de terminer", !!un(".rds__panneau.est-visible .rds__terminer"));
clic(un(".rds__barre-prec"));
verifier("on peut revenir en arrière", panneauxVisibles().join() === etapes[8]);
clic(un(".rds__panneau.est-visible .rds__suivant"));
clic(un(".rds__panneau.est-visible .rds__terminer"));
verifier("terminer la visite ramène l'accueil et la vue d'ensemble",
  panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && vueChoisie() === "ensemble");
clic(un(".rds__bouton--visite"));
clic(un(".rds__barre-fin"));
verifier("le bouton × quitte aussi la visite", panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && surlignes().length === 0);
clic(un('.rds__panneau--accueil .rds__appel[data-action="visite"]'));
verifier("l'appel du panneau d'accueil lance la visite", panneauxVisibles().join() === etapes[0]);
clic(un(".rds__barre-fin"));

console.log("PRIX DU POIVRE");
const valeurs = (p) => tous(".rds__jauge-val", p).map((v) => v.textContent.replace(/\s/g, " "));
const prixAttendus = ["1 à 2 g", "10 à 14 g", "14 à 18 g", "20 à 30 g"];
const premiere = un(`[data-panneau="${etapes[0]}"]`);
verifier("à la récolte, seul le prix en Inde est connu", valeurs(premiere).join("|") === [prixAttendus[0], "?", "?", "?"].join("|"), valeurs(premiere).join("|"));
const derniere = un(`[data-panneau="${etapes[9]}"]`);
verifier("au bilan, les quatre prix de Pearson", valeurs(derniere).join("|") === prixAttendus.join("|"), valeurs(derniere).join("|"));
verifier("au bilan, le prix est multiplié par 10 à 30", /×\s*10 à 30/.test(un(".rds__multiplie", derniere).textContent.replace(/\s/g, " ")));
verifier("au bilan, quatre raisons", tous(".rds__raisons > li", derniere).length === 4);
verifier("chaque étape, sauf la récolte et le bilan, nomme ce qui fait monter le prix",
  etapes.slice(1, 9).every((e) => tous(".rds__cout", un(`[data-panneau="${e}"]`)).length >= 1));
verifier("chaque jauge est décrite pour les lecteurs d'écran",
  tous(".rds__jauge").every((j) => j.getAttribute("role") === "img" && /grammes/.test(j.getAttribute("aria-label") || "")));

console.log("DÉSÉLECTION ET RÉINITIALISATION");
{
  const btR = un(".rds__entete .reinitialiser");
  verifier("data-reinitialiser : page.js ajoute le bouton Réinitialiser avant Plein écran",
    racine.hasAttribute("data-reinitialiser") && !!btR && btR.nextElementSibling === un(".rds__entete .plein-ecran"));
  clic(un('.rds__outil[data-zoom="ensemble"]'));
  const v0 = fenetre();
  const bP = boutonsProduits[0];
  clic(bP);
  verifier("choisir un produit le surligne", presses().join() === bP.getAttribute("data-produit") && surlignes().length > 0);
  clic(bP);
  verifier("un second clic sur le produit le désélectionne", presses().length === 0 && panneauxVisibles().join() === "accueil" && surlignes().length === 0 && !racine.classList.contains("est-filtre") && bP.getAttribute("aria-pressed") === "false");
  verifier("et ramène la vue d'avant", Math.abs(fenetre()[2] - v0[2]) < 0.5 && vueChoisie() === "ensemble", fenetre().join(" "));
  const bL = boutonsLieux[0], cleL = bL.getAttribute("data-lieu");
  clic(bL); clic(bL);
  verifier("un second clic sur un bouton de ville la désélectionne", presses().length === 0 && panneauxVisibles().join() === "accueil" && !un(`.rds__lieu[data-lieu="${cleL}"]`).classList.contains("est-choisi"));
  const point = un(".rds__lieu");
  const cleP = point.getAttribute("data-lieu");
  clic(point);
  verifier("un clic sur un point de la carte le choisit", panneauxVisibles().join() === "lieu-" + cleP);
  clic(point);
  verifier("un second clic sur le même point le désélectionne", panneauxVisibles().join() === "accueil" && !point.classList.contains("est-choisi"));
  const badge = un(".rds__badge");
  clic(badge); clic(badge);
  verifier("un second clic sur un badge de produit le désélectionne", panneauxVisibles().join() === "accueil" && !badge.classList.contains("est-choisi"));
  clic(un(".rds__bouton--visite")); clic(un(".rds__bouton--visite"));
  verifier("un second clic sur la visite l'arrête", panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && surlignes().length === 0);
  clic(bP);
  touche(svg, "Escape");
  verifier("Échap sur la carte désélectionne", panneauxVisibles().join() === "accueil" && presses().length === 0);
  clic(un(".rds__bouton--visite"));
  clic(un(".rds__barre-suiv")); clic(un(".rds__barre-suiv"));
  clic(un('.rds__outil[data-zoom="plus"]'));
  clic(btR);
  verifier("Réinitialiser : accueil, aucun choix, visite arrêtée", panneauxVisibles().join() === "accueil" && presses().length === 0 && !racine.classList.contains("est-visite") && surlignes().length === 0 && api.etat.mode === "accueil");
  verifier("Réinitialiser : vue d'ensemble de départ", vueChoisie() === "ensemble" && fenetre().every((v, i) => Math.abs(v - depart[i]) < 0.5), fenetre().join(" ") + " / " + depart.join(" "));
  verifier("Réinitialiser : barre de la visite vidée", un(".rds__barre-texte").textContent === "");
}

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".rds__entete .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".rds__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  verifier("les choix et les textes sont rangés à côté de la carte",
    !!un(".rds__cote > .rds__choix") && !!un(".rds__cote > .rds__contenu") && !!un(".rds__cadre > .rds__carte"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(un('.rds__bouton[data-produit="encens"]'));
  verifier("en plein écran, un choix ouvre toujours son panneau", panneauxVisibles().join() === "produit-encens");
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(racine.textContent));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(visible), (visible.match(/.{30},\s+et\s.{10}/) || [""])[0]);
const sansAdresses = visible.replace(/https?:\/\//g, "");
verifier("une espace insécable devant chaque deux-points", !/(?<!\u00a0):/.test(sansAdresses), (sansAdresses.match(/.{20}(?<!\u00a0):.{10}/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?!\u00a0)/.test(visible) && !/(?<!\u00a0)»/.test(visible), (visible.match(/.{10}«(?!\u00a0).{10}|.{10}(?<!\u00a0)».{10}/) || [""])[0]);
verifier("chaque produit dit d'où il vient, à quoi il sert, et un fait étonnant",
  tous(".rds__panneau[data-panneau^='produit-']").every((p) => tous(".rds__detail", p).length >= 2 && un(".rds__savais", p)));
verifier("chaque ville a un rôle, un texte et ce qu'elle est aujourd'hui",
  tous(".rds__panneau[data-panneau^='lieu-']").every((p) => un(".rds__role", p) && un(".rds__detail", p).textContent.length > 80 && /Aujourd/.test(un(".rds__auj", p).textContent)));
verifier("la source nomme Natural Earth et Pearson", /Natural Earth/.test(visible) && /Pearson/.test(visible));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
