/*
 * Test de la carte du partage de l'Afrique dans un DOM simulé.
 *     node outils/test_partage_afrique.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js, pour vérifier
 * aussi le bouton Plein écran et le repli du texte.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "partage-afrique.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La conférence de Berlin</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
// Mouvement réduit simulé : vrai par défaut (mises à jour instantanées), faux dans la partie FLUIDITÉ.
let reduitTest = true;
window.matchMedia = (q) => ({ matches: /reduce/.test(q) && reduitTest, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
// Mise en page simulée de la ligne d'événement : 42 caractères par ligne de 20 px, plus 21 px de marges.
const LIGNE = 20, MARGES = 21, CAR = 42;
const hauteurSimulee = (n) => {
  const br = n.querySelectorAll("br").length;
  const lignes = br ? br + 1 : Math.max(1, Math.ceil(n.textContent.length / CAR));
  return lignes * LIGNE + MARGES;
};
const offsetHeightOrigine = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, "offsetHeight");
Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", { configurable: true, get() {
  return /paf__evenement/.test(this.className) ? hauteurSimulee(this) : (offsetHeightOrigine ? offsetHeightOrigine.get.call(this) : 0);
} });
const rectOrigine = window.Element.prototype.getBoundingClientRect;
window.Element.prototype.getBoundingClientRect = function () {
  if (/paf__evenement/.test(this.getAttribute && this.getAttribute("class") || "")) { return { x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 100, width: 300, height: 100 }; }
  return rectOrigine.call(this);
};
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
const racine = document.getElementById("partage-afrique");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel) => racine.querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function annee(a) { const c = un(".paf__curseur"); c.value = String(a); c.dispatchEvent(new window.Event("input", { bubbles: true })); }
const p = (id) => un(`.paf__morceau[data-id="${id}"]`).getAttribute("data-p");
const pointVu = (id) => un(`.paf__point[data-id="${id}"]`).getAttribute("display") !== "none";
const ongletActif = () => (tous('.paf__onglet[aria-selected="true"]').map((o) => o.getAttribute("data-onglet")).join());
const D = JSON.parse(script.slice(script.indexOf("var D = ") + 8, script.indexOf(";\n  var MIN")));

(async () => {
  console.log("MISE EN PLACE");
  verifier("composant présent", !!racine);
  verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
  verifier("huit graduations, sans doublon", tous(".paf__grad").length === 8, tous(".paf__grad").length);
  const nbTerr = D.territoires.length, nbPoints = D.points.length;
  verifier(`${nbTerr} territoires dessinés`, tous(".paf__morceau").length === nbTerr, tous(".paf__morceau").length);
  verifier(`${nbPoints} comptoirs et postes`, tous(".paf__point").length === nbPoints, tous(".paf__point").length);
  verifier("un bouton de liste par territoire et par poste, sans doublon",
    tous(".paf__groupes .paf__puce").length === nbTerr + nbPoints, tous(".paf__groupes .paf__puce").length);
  const ids = tous("[id]", document).map((el) => el.id);
  verifier("aucun identifiant en double", new Set(ids).size === ids.length);
  verifier("chaque motif utilisé existe", ["fr", "gb", "de", "be", "pt", "it", "es", "ot"].every((q) => document.getElementById("paf-" + q) && document.getElementById("pafl-" + q)));
  verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
  verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
  verifier("en-tête reconnu par page.js : bouton Plein écran posé", !!un(".paf__entete .plein-ecran"));
  verifier("la carte a un nom accessible", (un(".paf__svg").getAttribute("aria-label") || "").length > 40);

  console.log("ARIA");
  const onglets = tous('[role="tab"]');
  verifier("trois onglets dans une liste d'onglets", onglets.length === 3 && !!un('[role="tablist"]'));
  verifier("chaque onglet contrôle un panneau qui le nomme", onglets.every((o) => {
    const pan = document.getElementById(o.getAttribute("aria-controls"));
    return pan && pan.getAttribute("role") === "tabpanel" && pan.getAttribute("aria-labelledby") === o.id;
  }));
  verifier("un seul onglet sélectionné au départ, Le récit", ongletActif() === "recit");
  verifier("tabindex itinérant", onglets.filter((o) => o.getAttribute("tabindex") !== "-1").length === 1);
  onglets[0].focus();
  onglets[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  verifier("flèche droite : onglet suivant sélectionné et focalisé", ongletActif() === "territoire" && document.activeElement === onglets[1]);
  onglets[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  verifier("Fin : dernier onglet", ongletActif() === "frontieres");
  clic(onglets[0]);
  verifier("les boutons de mode indiquent leur état", tous(".paf__mode").every((b) => b.hasAttribute("aria-pressed")));
  verifier("le curseur du temps a un nom", un(".paf__curseur").getAttribute("aria-label") === "Année");
  verifier("la ligne d'événement est annoncée", un(".paf__evenement").getAttribute("aria-live") === "polite");

  console.log("CURSEUR DU TEMPS");
  verifier("départ en 1880", un(".paf__annee").textContent === "1880" && un(".paf__curseur").value === "1880");
  verifier("1880 : nord de l'Algérie français, Cap britannique", p("algerie-nord") === "fr" && p("cap") === "gb");
  verifier("1880 : Libye, Égypte, Soudan et Tunisie ottomans", ["libye", "egypte", "soudan", "tunisie"].every((i) => p(i) === "ot"));
  verifier("1880 : Transvaal annexé, Congo non soumis", p("transvaal") === "gb" && p("rdc") === "na");
  verifier("1880 : Luanda et Walvis Bay visibles, Léopoldville non", pointVu("luanda") && pointVu("walvis-bay") && !pointVu("leopoldville"));
  annee(1881);
  verifier("1881 : Tunisie française, Transvaal autonome", p("tunisie") === "fr" && p("transvaal") === "na");
  verifier("1881 : Léopoldville apparaît", pointVu("leopoldville"));
  annee(1884);
  verifier("1884 : Togo, Cameroun et Sud-Ouest africain allemands", ["togo", "cameroun", "namibie"].every((i) => p(i) === "de"));
  verifier("1884 : la ligne d'événement nomme l'Allemagne et le Togo", /Allemagne : .*Togo/.test(un(".paf__evenement").textContent), un(".paf__evenement").textContent);
  annee(1885);
  verifier("1885 : Congo de Léopold II, Afrique orientale allemande, Soudan mahdiste",
    p("rdc") === "be" && p("tanzanie") === "de" && p("soudan") === "na");
  verifier("1885 : l'étiquette État mahdiste apparaît", un('.paf__etiquette[data-id="soudan"]').getAttribute("display") !== "none");
  verifier("1885 : Léopoldville disparaît dans l'État du Congo", !pointVu("leopoldville"));
  annee(1886);
  verifier("1886 : Luanda disparaît, l'Angola est colorié", !pointVu("luanda") && p("angola") === "pt");
  annee(1914);
  const libres = tous(".paf__morceau").filter((m) => m.getAttribute("data-p") === "na").map((m) => m.getAttribute("data-id")).sort();
  verifier("1914 : seuls l'Éthiopie et le Liberia restent non soumis", libres.join() === "ethiopie,liberia", libres.join());
  verifier("1914 : Libye italienne, Maroc français, Congo belge", p("libye") === "it" && p("maroc") === "fr" && p("rdc") === "be");
  verifier("1914 : le bouton de liste du Congo porte son nouveau nom", un('.paf__groupes .paf__puce[data-id="rdc"]').textContent === "Congo belge");
  verifier("le curseur reste borné", (annee(1950), un(".paf__annee").textContent === "1914"));

  console.log("RÉCIT");
  annee(1880);
  clic(un(".paf__pilote .paf__bouton"));
  verifier("le récit est revenu à l'étape 1 avec le curseur", /Avant la course/.test(un('[data-paf="recit"]').textContent));
  verifier("Précédente désactivée à la première étape", un(".paf__pilote .paf__bouton").disabled === true);
  clic(un(".paf__pilote .paf__bouton--plein"));
  verifier("Suivante : étape 2, année 1882", un(".paf__annee").textContent === "1882" && /Tunisie et l'Égypte/.test(un('[data-paf="recit"]').textContent));
  verifier("le pilote indique l'étape", /Étape 2 sur 11/.test(un(".paf__pilote").textContent));
  annee(1897);
  verifier("le récit suit le curseur : 1897 montre Adoua", /Adoua/.test(un('[data-paf="recit"] .paf__intertitre').textContent));
  for (let i = 0; i < 15 && !/Recommencer/.test(un(".paf__pilote").textContent); i++) clic(un(".paf__pilote .paf__bouton--plein"));
  verifier("la dernière étape montre 1914 et propose Recommencer", un(".paf__annee").textContent === "1914" && /Recommencer/.test(un(".paf__pilote").textContent));
  clic(un(".paf__pilote .paf__bouton--plein"));
  verifier("Recommencer ramène à 1880", un(".paf__annee").textContent === "1880");
  for (let i = 0; i < 4; i++) clic(un(".paf__pilote .paf__bouton--plein"));
  const voir = tous('[data-paf="recit"] .paf__bouton').find((b) => /lignes droites/.test(b.textContent));
  verifier("l'étape 1890 propose de voir les lignes droites", !!voir);
  clic(voir);
  verifier("le bouton passe en mode lignes droites et ouvre Les frontières", racine.getAttribute("data-mode") === "droites" && ongletActif() === "frontieres");

  console.log("LIGNES DROITES");
  verifier("légende des lignes droites visible, l'autre cachée", un('[data-paf="legende-droites"]').hidden === false && un('[data-paf="legende-puissances"]').hidden === true);
  const puces = tous('[data-paf="frontieres"] .paf__puce');
  verifier("quatre exemples", puces.length === 4);
  const paires = tous(".paf__droites path").map((d) => d.getAttribute("data-paire"));
  verifier("chaque exemple désigne des frontières rectilignes existantes", D.frontieres.exemples.every((e) => e.paires.every((x) => paires.indexOf(x) >= 0)));
  clic(puces[1]);
  verifier("Namibie et Botswana mis en vedette", un('.paf__droites path[data-paire="BWA-NAM"]').classList.contains("est-vedette") && un(".paf__droites").classList.contains("a-vedette"));
  verifier("le texte de l'exemple s'affiche", /20e méridien/.test(un(".paf__exemple").textContent) && !un(".paf__exemple").hidden);
  clic(tous('[data-paf="frontieres"] .paf__puce')[1]);
  verifier("un second clic retire la vedette", tous(".paf__droites path.est-vedette").length === 0);
  clic(un('.paf__mode[data-mode="puissances"]'));
  verifier("retour au mode des puissances", racine.getAttribute("data-mode") === "puissances" && un('[data-paf="legende-puissances"]').hidden === false);

  console.log("TERRITOIRES");
  annee(1890);
  clic(un('.paf__morceau[data-id="rdc"]'));
  verifier("un clic sur la carte ouvre Le territoire", ongletActif() === "territoire");
  verifier("nom de l'époque : État indépendant du Congo", un('[data-paf="territoire"] .paf__intertitre').textContent === "État indépendant du Congo");
  verifier("le statut nomme Léopold II", /Léopold II/.test(un('[data-paf="territoire"] .paf__badge').textContent));
  const per = tous('[data-paf="territoire"] .paf__periodes li').map((li) => li.textContent);
  verifier("périodes : non soumis, Léopold II, puis Belgique", per.length === 3 && /Léopold II/.test(per[1]) && /Belgique/.test(per[2]), per.join(" | "));
  verifier("le territoire choisi est entouré", un(".paf__halo").getAttribute("d") === un('.paf__morceau[data-id="rdc"]').getAttribute("d"));
  verifier("le bouton de liste indique le choix", un('.paf__groupes .paf__puce[data-id="rdc"]').getAttribute("aria-pressed") === "true");
  annee(1910);
  verifier("le panneau suit l'année : Congo belge", un('[data-paf="territoire"] .paf__intertitre').textContent === "Congo belge");
  clic(un('.paf__groupes .paf__puce[data-id="ethiopie"]'));
  verifier("Éthiopie : indépendante, Adoua citée", /État indépendant/.test(un('[data-paf="territoire"] .paf__badge').textContent) && /Adoua/.test(un('[data-paf="territoire"]').textContent));
  clic(un('.paf__groupes .paf__puce[data-id="walvis-bay"]'));
  verifier("un poste se choisit dans la liste", /Walvis Bay/.test(un('[data-paf="territoire"] .paf__intertitre').textContent) && un('.paf__point[data-id="walvis-bay"]').classList.contains("est-choisi"));
  verifier("le pilote propose de revenir au récit", /Revenir au récit/.test(un(".paf__pilote").textContent));
  clic(un(".paf__pilote .paf__bouton"));
  verifier("retour au récit", ongletActif() === "recit");

  console.log("DÉSÉLECTION ET RÉINITIALISATION");
  {
    const reinit = un(".paf__entete .reinitialiser");
    verifier("la carte demande le bouton Réinitialiser (data-reinitialiser) et page.js le pose avant Plein écran",
      racine.hasAttribute("data-reinitialiser") && !!reinit && reinit.nextElementSibling === un(".paf__entete .plein-ecran"));
    const aucunChoix = () => tous('.paf__groupes .paf__puce[aria-pressed="true"]').length === 0 && tous(".paf__point.est-choisi").length === 0;
    clic(un('.paf__groupes .paf__puce[data-id="walvis-bay"]'));
    verifier("un second clic sur le poste choisi dans la liste le désélectionne", aucunChoix() && ongletActif() === "recit");
    clic(un('.paf__morceau[data-id="rdc"]'));
    verifier("choisir un territoire ouvre Le territoire", ongletActif() === "territoire");
    clic(un('.paf__morceau[data-id="rdc"]'));
    verifier("un second clic sur le territoire de la carte le désélectionne et rouvre le récit", aucunChoix() && ongletActif() === "recit" && !(un(".paf__halo").getAttribute("d") || "").length, un(".paf__halo").getAttribute("d"));
    clic(un('.paf__groupes .paf__puce[data-id="ethiopie"]'));
    racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    verifier("Échap désélectionne", aucunChoix() && ongletActif() === "recit");
    annee(1905);
    clic(un('.paf__mode[data-mode="droites"]'));
    clic(tous('[data-paf="frontieres"] .paf__puce')[0]);
    clic(un('.paf__morceau[data-id="rdc"]'));
    un(".paf__liste").open = true;
    clic(reinit);
    verifier("Réinitialiser : 1880, étape 1, les puissances, récit ouvert",
      un(".paf__annee").textContent === "1880" && un(".paf__curseur").value === "1880" && racine.getAttribute("data-mode") === "puissances" && ongletActif() === "recit" && /Étape 1 sur/.test(un(".paf__pilote").textContent), un(".paf__annee").textContent);
    verifier("Réinitialiser : aucun territoire, aucun exemple, liste refermée",
      aucunChoix() && !un(".paf__halo").getAttribute("d") && tous(".paf__droite.est-vedette").length === 0 && !un(".paf__liste").open);
    annee(1910); // la suite du test part de 1910
  }

  console.log("LECTURE AUTOMATIQUE");
  const jouer = un(".paf__jouer");
  clic(jouer);
  verifier("Jouer : le bouton devient Arrêter", jouer.getAttribute("aria-label") === "Arrêter le défilement");
  await new Promise((r) => setTimeout(r, 1000));
  verifier("le temps avance seul", +un(".paf__annee").textContent > 1910, un(".paf__annee").textContent);
  clic(jouer);
  verifier("Arrêter : le bouton redevient Jouer", jouer.getAttribute("aria-label") === "Faire défiler les années");

  console.log("STABILITÉ DE LA MISE EN PAGE");
  const ev = un(".paf__evenement");
  const longueurs = [];
  for (let x = 1880; x <= 1914; x++) { annee(x); longueurs.push(hauteurSimulee(ev)); }
  const plafond = 5 * LIGNE + MARGES;
  const attendu = Math.min(Math.max(...longueurs), plafond) + "px";
  verifier("la ligne d'événement réserve la hauteur du plus long texte, plafonnée à cinq lignes", ev.style.height === attendu, ev.style.height + " au lieu de " + attendu);
  const hauteurs = new Set();
  for (let x = 1880; x <= 1914; x++) { annee(x); hauteurs.add(ev.style.height); }
  verifier("même hauteur à toutes les années : la carte ne bouge plus", hauteurs.size === 1, [...hauteurs].join(", "));
  verifier("le surplus défile dans la ligne, sans déborder", /overflow-y: auto/.test(composant.match(/\.paf \.paf__evenement \{[^}]*\}/)[0]) && /flex: none/.test(composant.match(/\.paf \.paf__evenement \{[^}]*\}/)[0]));
  verifier("plein écran : les deux légendes partagent la même place", /\.paf\.est-plein-ecran \.paf__legendes > \.paf__legende\[hidden\] \{ display: flex; visibility: hidden; \}/.test(composant) && !!un(".paf__legendes [data-paf=\"legende-droites\"]"));
  verifier("téléphone en plein écran : la carte ne déborde plus sur le curseur", /@container paf \(max-width: 40rem\) \{[^@]*\.paf\.est-plein-ecran \.paf__carte \{ display: grid; grid-template-rows: auto minmax\(0, 1fr\); \}/.test(composant));
  verifier("mouvement réduit : aucun liséré, compteur instantané", (annee(1883), clic(un(".paf__pilote .paf__bouton--plein")), un(".paf__eclats").childNodes.length === 0 && un(".paf__annee").textContent === un(".paf__curseur").value));

  console.log("FLUIDITÉ");
  reduitTest = false;
  annee(1880);
  await new Promise((r) => setTimeout(r, 50));
  const vus = new Set();
  const suivre = setInterval(() => vus.add(un(".paf__annee").textContent), 8);
  clic(un(".paf__pilote .paf__bouton--plein"));
  verifier("Suivante : la carte passe tout de suite à 1882", p("tunisie") === "fr" && p("egypte") === "gb" && un(".paf__curseur").getAttribute("aria-valuetext") === "1882");
  verifier("les territoires gagnés s'entourent d'un liséré doré", un(".paf__eclats").querySelectorAll(".paf__eclat").length >= 2, un(".paf__eclats").childNodes.length);
  verifier("la ligne d'événement se fond", un(".paf__evenement").classList.contains("est-change"));
  await new Promise((r) => setTimeout(r, 1100));
  clearInterval(suivre);
  verifier("le compteur défile de 1880 à 1882 (1881 affiché en chemin)", vus.has("1881") && un(".paf__annee").textContent === "1882", [...vus].join(" "));
  verifier("le curseur arrive pile sur 1882, au pas d'un an", un(".paf__curseur").value === "1882" && un(".paf__curseur").step === "1");
  await new Promise((r) => setTimeout(r, 1200));
  verifier("les lisérés s'effacent ensuite du dessin", un(".paf__eclats").childNodes.length === 0, un(".paf__eclats").childNodes.length);
  annee(1883);
  verifier("faire glisser le curseur soi-même : aucune animation du compteur", un(".paf__annee").textContent === "1883");
  annee(1890);
  verifier("faire glisser le curseur : pas de liséré qui allumerait toute la carte", un(".paf__eclats").childNodes.length === 0, un(".paf__eclats").childNodes.length);
  annee(1883);
  const jouer2 = un(".paf__jouer");
  clic(jouer2);
  await new Promise((r) => setTimeout(r, 650));
  verifier("Jouer : la première année vient vite (moins d'une seconde)", un(".paf__annee").textContent === "1884" || un(".paf__curseur").getAttribute("aria-valuetext") === "1884", un(".paf__curseur").getAttribute("aria-valuetext"));
  await new Promise((r) => setTimeout(r, 1300));
  verifier("la lecture s'attarde sur 1884, année du récit (environ 2 s)", un(".paf__curseur").getAttribute("aria-valuetext") === "1884", un(".paf__curseur").getAttribute("aria-valuetext"));
  clic(jouer2);
  reduitTest = true;

  console.log("PLEIN ÉCRAN");
  clic(un(".paf__entete .plein-ecran"));
  verifier("le bouton met l'interface en plein écran (simulé sans API)", racine.classList.contains("est-plein-ecran"));
  const replier = un(".paf__replier");
  clic(replier);
  verifier("Masquer le texte : classe texte-masque et état annoncé", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && replier.textContent === "Afficher le texte");
  clic(replier);
  verifier("Afficher le texte : retour", !racine.classList.contains("texte-masque") && replier.textContent === "Masquer le texte");
  clic(replier);
  clic(un(".paf__entete .plein-ecran"));
  await new Promise((r) => setTimeout(r, 0));
  verifier("en quittant le plein écran, le texte réapparaît", !racine.classList.contains("est-plein-ecran") && !racine.classList.contains("texte-masque"));

  console.log("TYPOGRAPHIE");
  const textes = [];
  // Tous les textes affichables : ceux du DOM après plusieurs états, puis ceux des données.
  annee(1885); clic(un('.paf__mode[data-mode="droites"]'));
  textes.push(racine.textContent);
  D.territoires.forEach((t) => textes.push(t.nom, t.auj, ...t.texte, ...((t.noms || []).map((n) => n[2]))));
  D.points.forEach((q) => textes.push(q.nom, q.texte));
  D.recit.forEach((e) => textes.push(e.titre, ...e.texte, e.note || ""));
  Object.values(D.notes).forEach((n) => textes.push(n));
  D.frontieres.exemples.forEach((e) => textes.push(e.nom, e.texte));
  textes.push(...D.frontieres.texte, D.frontieres.note);
  const tout = textes.join("\n");
  const visible = racine.textContent.replace(/[\s\S]*?<\/style>/, "");
  const sansCode = Array.from(racine.querySelectorAll("*")).filter((n) => !/^(SCRIPT|STYLE)$/.test(n.tagName))
    .map((n) => Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join("")).join("\n");
  verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(tout + sansCode));
  verifier("aucune construction « , et »", !/, et /.test(tout + sansCode), (tout + sansCode).match(/.{20}, et .{10}/));
  verifier("aucune espace avant ; ! ? dans le texte affiché", !/[   ][;!?]/.test(sansCode), (sansCode.match(/.{15}[   ][;!?]/) || [])[0]);
  verifier("espace insécable avant le deux-points affiché", !/ :/.test(sansCode), (sansCode.match(/.{15} :/) || [])[0]);
  verifier("espaces insécables dans les guillemets affichés", !/« | »/.test(sansCode));
  void visible;

  console.log(echecs ? `\n${echecs} échec(s).` : "\nTous les contrôles sont passés.");
  process.exit(echecs ? 1 : 0);
})();
