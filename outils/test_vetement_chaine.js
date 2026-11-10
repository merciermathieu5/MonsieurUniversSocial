/*
 * Test de la carte « La route d'un t-shirt » dans un DOM simulé.
 *     node outils/test_vetement_chaine.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 * Le mouvement réduit est demandé : les déplacements de la carte et du t-shirt se font alors d'un coup, ce qui rend le test prévisible.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "vetement-chaine.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="geographie"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Le territoire industriel</h2>
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
const racine = document.getElementById("vetement-chaine");
const api = racine && racine.routeTshirt;
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
const svg = un(".tsh__svg");
const panneauxVisibles = () => tous(".tsh__panneau.est-visible").map((p) => p.getAttribute("data-panneau"));
const presses = () => tous('.tsh__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-produit") || b.getAttribute("data-lieu") || b.getAttribute("data-action"));
const vueChoisie = () => tous('.tsh__vue[aria-pressed="true"]').map((b) => b.getAttribute("data-vue")).join();
const fenetre = () => (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
const surlignes = () => tous(".tsh__surlignage .tsh__surligne");
const etendue = JSON.parse((script.match(/"etendue":(\[[^\]]+\])/) || [0, "null"])[1]);

// Textes visibles : le composant sans son style ni son script.
const copie = racine.cloneNode(true);
tous("style, script", copie).forEach((el) => el.remove());
const visible = copie.textContent;

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.routeTshirt === api);
const boutonsProduits = tous(".tsh__bouton[data-produit]");
const boutonsLieux = tous(".tsh__bouton[data-lieu]");
verifier("2 produits à choisir", boutonsProduits.length === 2, boutonsProduits.length);
verifier("11 lieux à choisir", boutonsLieux.length === 11, boutonsLieux.length);
verifier("un bouton pour suivre le t-shirt", tous(".tsh__bouton--visite").length === 1);
verifier("un panneau par bouton, relié par aria-controls",
  boutonsProduits.concat(boutonsLieux).every((b) => {
    const p = document.getElementById(b.getAttribute("aria-controls"));
    const cle = b.getAttribute("data-produit") ? "produit-" + b.getAttribute("data-produit") : "lieu-" + b.getAttribute("data-lieu");
    return p && p.getAttribute("data-panneau") === cle;
  }));
verifier("onze étapes à la route du t-shirt", tous(".tsh__panneau--etape").length === 11, tous(".tsh__panneau--etape").length);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("chaque <use> vise un élément existant",
  tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("la carte a une description pour les lecteurs d'écran",
  svg.getAttribute("role") === "img" && (svg.getAttribute("aria-label") || "").length > 60);
const marqueurs = tous(".tsh__lieu");
verifier("chaque lieu a son point sur la carte, et une seule fois",
  marqueurs.length === 11 && boutonsLieux.every((b) => tous(`.tsh__lieu[data-lieu="${b.getAttribute("data-lieu")}"]`).length === 1));
verifier("chaque point porte le nom de son bouton",
  boutonsLieux.every((b) => un(`.tsh__lieu[data-lieu="${b.getAttribute("data-lieu")}"] .tsh__nom`).textContent === b.textContent));
const badges = tous(".tsh__badge");
verifier("9 pastilles de grands producteurs, au moins une par produit",
  badges.length === 9 && boutonsProduits.every((b) => tous(`.tsh__badge[data-produit="${b.getAttribute("data-produit")}"]`).length >= 1), badges.length);
const routes = tous(".tsh__route");
verifier("15 tronçons de route, sur terre ou sur mer",
  routes.length === 15 && routes.every((r) => /tsh__route--(terre|mer)/.test(r.getAttribute("class"))), routes.length);
verifier("l'étendue des données est connue", Array.isArray(etendue) && etendue.length === 4);

console.log("ACCUEIL");
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("la vue d'ensemble est choisie au départ", vueChoisie() === "ensemble", vueChoisie());
verifier("aucun choix au départ", presses().length === 0 && surlignes().length === 0 && !racine.classList.contains("est-filtre"));
verifier("le t-shirt est caché hors de la visite", !racine.classList.contains("est-visite"));
const depart = fenetre();
verifier("la fenêtre de départ reste dans les données",
  depart[0] >= etendue[0] - 0.01 && depart[1] >= etendue[1] - 0.01 && depart[0] + depart[2] <= etendue[2] + 0.01 && depart[1] + depart[3] <= etendue[3] + 0.01, depart.join(" "));

console.log("PRODUITS");
boutonsProduits.forEach((b) => {
  const cle = b.getAttribute("data-produit");
  clic(b);
  const traits = surlignes();
  const miens = tous(`.tsh__badge[data-produit="${cle}"]`);
  const ok = panneauxVisibles().join() === "produit-" + cle
    && presses().join() === cle
    && racine.classList.contains("est-filtre")
    && traits.length > 0
    && traits.every((u) => u.classList.contains("tsh-p-" + cle) && u.classList.contains("tsh__surligne--flux"))
    && miens.every((x) => x.classList.contains("est-choisi"))
    && badges.filter((x) => !miens.includes(x)).every((x) => x.classList.contains("est-pale"));
  verifier(`${b.textContent} : panneau, chemin surligné et pastilles`, ok, `${panneauxVisibles()} / ${traits.length} traits`);
  const panneau = document.getElementById("tsh-produit-" + cle);
  const etapes = tous(".tsh__chemin .tsh__puce", panneau);
  verifier(`${b.textContent} : son chemin passe par des villes de la carte`,
    etapes.length >= 2 && etapes.every((p) => un(`.tsh__lieu[data-lieu="${p.getAttribute("data-lieu")}"]`)), etapes.length);
});
clic(un('.tsh__bouton[data-produit="coton"]'));
const pales = marqueurs.filter((m) => m.classList.contains("est-pale")).map((m) => m.getAttribute("data-lieu"));
verifier("le coton : les lieux hors de son chemin pâlissent", pales.includes("mtl") && pales.includes("suez") && !pales.includes("santos") && !pales.includes("ctg"), pales.join());
clic(un('.tsh__bouton[data-produit="vetements"]'));
verifier("les vêtements : le chemin court et le détour par l'Afrique", tous("#tsh-produit-vetements .tsh__chemin").length === 2 && surlignes().some((u) => u.getAttribute("data-arete") === "cap-cabot") && surlignes().some((u) => u.getAttribute("data-arete") === "bab-suez"));

console.log("LIEUX");
boutonsLieux.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  clic(b);
  const point = un(`.tsh__lieu[data-lieu="${cle}"]`);
  const lies = tous(".tsh__route.est-lie");
  const ok = panneauxVisibles().join() === "lieu-" + cle && presses().join() === cle
    && point.classList.contains("est-choisi") && surlignes().length === 0 && !racine.classList.contains("est-filtre") && lies.length >= 1;
  verifier(`${b.textContent} : panneau, point et routes reliées`, ok, `${panneauxVisibles()} / ${lies.length} routes`);
});

console.log("RENVOIS ENTRE PANNEAUX");
clic(un('.tsh__bouton[data-lieu="ctg"]'));
clic(un('#tsh-lieu-ctg .tsh__puce[data-produit="coton"]'));
verifier("depuis Chattogram, la puce du coton ouvre le coton", panneauxVisibles().join() === "produit-coton" && presses().join() === "coton");
clic(un('#tsh-produit-coton .tsh__puce[data-lieu="colombo"]'));
verifier("depuis le coton, la puce de Colombo ouvre Colombo", panneauxVisibles().join() === "lieu-colombo" && presses().join() === "colombo");
clic(un('#tsh-lieu-colombo .tsh__retour'));
verifier("le lien de retour ramène à l'accueil", panneauxVisibles().join() === "accueil" && presses().length === 0);

console.log("CARTE");
clic(un('.tsh__lieu[data-lieu="suez"] .tsh__point'));
verifier("un clic sur un point choisit le lieu", panneauxVisibles().join() === "lieu-suez" && presses().join() === "suez");
clic(un('.tsh__badge[data-produit="vetements"] .tsh__badge-fond'));
verifier("un clic sur une pastille choisit le produit", panneauxVisibles().join() === "produit-vetements" && presses().join() === "vetements");
clic(un('.tsh__vue[data-vue="bangladesh"]'));
const med = fenetre();
verifier("la vue Bangladesh rapproche beaucoup la carte", vueChoisie() === "bangladesh" && med[2] < depart[2] * 0.1, med.join(" "));
const avant = fenetre();
clic(un('.tsh__outil[data-zoom="plus"]'));
verifier("le bouton + agrandit", fenetre()[2] < avant[2] - 1 && vueChoisie() === "", fenetre().join(" "));
const milieu = fenetre();
clic(un('.tsh__outil[data-zoom="moins"]'));
verifier("le bouton − réduit", fenetre()[2] > milieu[2] + 1);
for (let i = 0; i < 12; i++) clic(un('.tsh__outil[data-zoom="moins"]'));
const loin = fenetre();
verifier("on ne recule jamais au-delà des données",
  loin[2] <= etendue[2] - etendue[0] + 0.01 && loin[3] <= etendue[3] - etendue[1] + 0.01 && loin[0] >= etendue[0] - 0.01 && loin[1] >= etendue[1] - 0.01, loin.join(" "));
for (let i = 0; i < 20; i++) clic(un('.tsh__outil[data-zoom="plus"]'));
verifier("ni ne s'approche sans limite", fenetre()[2] >= 33.9, fenetre().join(" "));
const ici = fenetre();
touche(svg, "ArrowRight");
verifier("la flèche droite déplace la carte vers l'est", fenetre()[0] > ici[0]);
clic(un('.tsh__outil[data-zoom="ensemble"]'));
verifier("la maison ramène la vue d'ensemble", vueChoisie() === "ensemble" && Math.abs(fenetre()[2] - depart[2]) < 0.5, fenetre().join(" "));

console.log("LA ROUTE DU T-SHIRT");
const etapes = tous(".tsh__panneau--etape").map((p) => p.getAttribute("data-panneau"));
const barre = un(".tsh__barre-texte");
const sac = un(".tsh__sac");
const posSac = () => (sac.getAttribute("transform").match(/translate\(([-\d.]+) ([-\d.]+)\)/) || []).slice(1).map(Number);
clic(un(".tsh__bouton--visite"));
verifier("la visite commence à la première étape",
  racine.classList.contains("est-visite") && panneauxVisibles().join() === etapes[0] && /^Étape 1 sur 11/.test(barre.textContent), barre.textContent);
verifier("le bouton de la visite est enfoncé", presses().join() === "visite");
verifier("on ne peut pas reculer à la première étape", un(".tsh__barre-prec").disabled && un(".tsh__panneau.est-visible .tsh__precedent").disabled);
let traits = surlignes().length;
let croissant = true;
for (let i = 1; i < 11; i++) {
  clic(un(".tsh__barre-suiv"));
  const n = surlignes().length;
  if (n < traits) croissant = false;
  traits = n;
  verifier(`étape ${i + 1} : ${un(".tsh__panneau.est-visible .tsh__role").textContent}`,
    panneauxVisibles().join() === etapes[i] && barre.textContent.indexOf(`Étape ${i + 1} sur 11`) === 0, panneauxVisibles().join());
  if (etapes[i] === "etape-colombo") {
    const v = un('.tsh__lieu[data-lieu="colombo"]');
    const p = posSac();
    verifier("à Colombo, le t-shirt est posé sur Colombo",
      Math.abs(p[0] - +v.getAttribute("data-x")) < 0.01 && Math.abs(p[1] - +v.getAttribute("data-y")) < 0.01, p.join(" "));
  }
}
verifier("le chemin surligné ne fait que s'allonger", croissant);
verifier("à la fin, le chemin passe par Suez et non par le détour", surlignes().some((u) => u.getAttribute("data-arete") === "bab-suez") && !surlignes().some((u) => u.getAttribute("data-arete") === "cap-cabot"));
verifier("on ne peut pas avancer à la dernière étape", un(".tsh__barre-suiv").disabled);
verifier("la dernière étape propose de terminer", !!un(".tsh__panneau.est-visible .tsh__terminer"));
clic(un(".tsh__barre-prec"));
verifier("on peut revenir en arrière", panneauxVisibles().join() === etapes[9]);
clic(un(".tsh__barre-prec"));
verifier("à l'étape de Suez, le détour par le cap est en pointillé", panneauxVisibles().join() === "etape-suez" && tous(".tsh__surligne--variante").map((u) => u.getAttribute("href")).join() === "#tsh-a-cap-colombo,#tsh-a-cap-cabot,#tsh-a-cabot-mtl");
clic(un(".tsh__barre-suiv"));
clic(un(".tsh__panneau.est-visible .tsh__suivant"));
clic(un(".tsh__panneau.est-visible .tsh__terminer"));
verifier("terminer la visite ramène l'accueil et la vue d'ensemble",
  panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && vueChoisie() === "ensemble");
clic(un(".tsh__bouton--visite"));
clic(un(".tsh__barre-fin"));
verifier("le bouton × quitte aussi la visite", panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && surlignes().length === 0);
clic(un('.tsh__panneau--accueil .tsh__appel[data-action="visite"]'));
verifier("l'appel du panneau d'accueil lance la visite", panneauxVisibles().join() === etapes[0]);
clic(un(".tsh__barre-fin"));

console.log("DISTANCES ET ARGENT");
const valeurs = (p) => tous(".tsh__jauge-val", p).map((v) => v.textContent.replace(/\s/g, " "));
const premiere = un(`[data-panneau="${etapes[0]}"]`);
verifier("au champ, aucune distance n'est encore connue", valeurs(premiere).every((v) => v === "?") && valeurs(premiere).length === 5, valeurs(premiere).join("|"));
const auPort = un('[data-panneau="etape-montreal"]');
verifier("à Montréal, les cinq distances et leur total", valeurs(auPort).every((v) => /^\d[\d ]* km$/.test(v)) && /37 400 km/.test(un(".tsh__jauge-total", auPort).textContent.replace(/\s/g, " ")), valeurs(auPort).join("|"));
const derniere = un(`[data-panneau="${etapes[10]}"]`);
verifier("au bilan, le total parcouru", /37 400/.test(un(".tsh__multiplie", derniere).textContent.replace(/\s/g, " ")));
verifier("au bilan, le partage du prix (59 % au magasin, 0,6 % aux ouvrières et aux ouvriers)", valeurs(derniere).join("|") === "59 %|12 %|12 %|8 %|4 %|0,6 %", valeurs(derniere).join("|"));
verifier("à l'étape de Suez, les deux routes et leur différence", tous('[data-panneau="etape-suez"] .tsh__raisons > li').length === 2 && /5 500 km de plus/.test(un('[data-panneau="etape-suez"] .tsh__raisons').textContent.replace(/\s/g, " ")));
verifier("chaque étape, sauf le bilan, nomme ce qui s'ajoute au prix",
  etapes.slice(0, 10).every((e) => tous(".tsh__cout", un(`[data-panneau="${e}"]`)).length >= 1));
verifier("chaque jauge est décrite pour les lecteurs d'écran",
  tous(".tsh__jauge").every((j) => j.getAttribute("role") === "img" && /(Distance|Partage)/.test(j.getAttribute("aria-label") || "")));

console.log("DÉSÉLECTION ET RÉINITIALISATION");
{
  const btR = un(".tsh__entete .reinitialiser");
  verifier("data-reinitialiser : page.js ajoute le bouton Réinitialiser avant Plein écran",
    racine.hasAttribute("data-reinitialiser") && !!btR && btR.nextElementSibling === un(".tsh__entete .plein-ecran"));
  clic(un('.tsh__outil[data-zoom="ensemble"]'));
  const v0 = fenetre();
  const bP = boutonsProduits[0];
  clic(bP);
  verifier("choisir un produit le surligne", presses().join() === bP.getAttribute("data-produit") && surlignes().length > 0);
  clic(bP);
  verifier("un second clic sur le produit le désélectionne", presses().length === 0 && panneauxVisibles().join() === "accueil" && surlignes().length === 0 && !racine.classList.contains("est-filtre") && bP.getAttribute("aria-pressed") === "false");
  verifier("et ramène la vue d'avant", Math.abs(fenetre()[2] - v0[2]) < 0.5 && vueChoisie() === "ensemble", fenetre().join(" "));
  const bL = boutonsLieux[0], cleL = bL.getAttribute("data-lieu");
  clic(bL); clic(bL);
  verifier("un second clic sur un bouton de ville la désélectionne", presses().length === 0 && panneauxVisibles().join() === "accueil" && !un(`.tsh__lieu[data-lieu="${cleL}"]`).classList.contains("est-choisi"));
  const point = un(".tsh__lieu");
  const cleP = point.getAttribute("data-lieu");
  clic(point);
  verifier("un clic sur un point de la carte le choisit", panneauxVisibles().join() === "lieu-" + cleP);
  clic(point);
  verifier("un second clic sur le même point le désélectionne", panneauxVisibles().join() === "accueil" && !point.classList.contains("est-choisi"));
  const badge = un(".tsh__badge");
  clic(badge); clic(badge);
  verifier("un second clic sur un badge de produit le désélectionne", panneauxVisibles().join() === "accueil" && !badge.classList.contains("est-choisi"));
  clic(un(".tsh__bouton--visite")); clic(un(".tsh__bouton--visite"));
  verifier("un second clic sur la visite l'arrête", panneauxVisibles().join() === "accueil" && !racine.classList.contains("est-visite") && surlignes().length === 0);
  clic(bP);
  touche(svg, "Escape");
  verifier("Échap sur la carte désélectionne", panneauxVisibles().join() === "accueil" && presses().length === 0);
  clic(un(".tsh__bouton--visite"));
  clic(un(".tsh__barre-suiv")); clic(un(".tsh__barre-suiv"));
  clic(un('.tsh__outil[data-zoom="plus"]'));
  clic(btR);
  verifier("Réinitialiser : accueil, aucun choix, visite arrêtée", panneauxVisibles().join() === "accueil" && presses().length === 0 && !racine.classList.contains("est-visite") && surlignes().length === 0 && api.etat.mode === "accueil");
  verifier("Réinitialiser : vue d'ensemble de départ", vueChoisie() === "ensemble" && fenetre().every((v, i) => Math.abs(v - depart[i]) < 0.5), fenetre().join(" ") + " / " + depart.join(" "));
  verifier("Réinitialiser : barre de la visite vidée", un(".tsh__barre-texte").textContent === "");
}

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".tsh__entete .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".tsh__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  verifier("les choix et les textes sont rangés à côté de la carte",
    !!un(".tsh__cote > .tsh__choix") && !!un(".tsh__cote > .tsh__contenu") && !!un(".tsh__cadre > .tsh__carte"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(un('.tsh__bouton[data-produit="coton"]'));
  verifier("en plein écran, un choix ouvre toujours son panneau", panneauxVisibles().join() === "produit-coton");
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
  tous(".tsh__panneau[data-panneau^='produit-']").every((p) => tous(".tsh__detail", p).length >= 2 && un(".tsh__savais", p)));
verifier("chaque lieu a un rôle, un texte et un chiffre",
  tous(".tsh__panneau[data-panneau^='lieu-']").every((p) => un(".tsh__role", p) && un(".tsh__detail", p).textContent.length > 80 && /En chiffres/.test(un(".tsh__auj", p).textContent)));
verifier("la source nomme Natural Earth, l'OMC et la Clean Clothes Campaign", /Natural Earth/.test(visible) && /OMC/.test(visible) && /Clean Clothes Campaign/.test(visible));
verifier("aucune espace avant ? ! ;", !/[ \u00a0][?!;]/.test(visible), (visible.match(/.{20}[ \u00a0][?!;]/) || [""])[0]);
{
  const fin = racine.cloneNode(true);
  tous("style, script", fin).forEach((el) => el.remove());
  verifier("aucun « undefined » ni « NaN », même après les choix", !/undefined|NaN/.test(fin.innerHTML), (fin.innerHTML.match(/[^<]{0,60}(undefined|NaN)[^>]{0,30}/) || [""])[0]);
}

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
