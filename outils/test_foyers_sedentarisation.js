/*
 * Test de la carte des premiers foyers d'agriculture dans un DOM simulé.
 *     node outils/test_foyers_sedentarisation.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js, pour vérifier
 * aussi le bouton Plein écran et le repli des textes. Le mouvement réduit est
 * simulé : chaque cadrage est alors immédiat, donc vérifiable.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "foyers-sedentarisation.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les premiers foyers de sédentarisation</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
// jsdom ne mesure pas les textes SVG : une boîte simple, centrée sur la
// position de l'étiquette, suffit pour vérifier qu'une étiquette coupée par le
// bord de la carte est cachée.
window.SVGElement.prototype.getBBox = function () {
  const x = +this.getAttribute("x") || 0, y = +this.getAttribute("y") || 0;
  if (this.hasAttribute("data-essai-large")) { return { x: -5000, y: y - 10, width: 10000, height: 12 }; }
  return { x: x - 20, y: y - 10, width: 40, height: 12 };
};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
// Un second passage du script ne doit rien doubler.
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const racine = document.getElementById("foyers-sedentarisation");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function texteVisible(base) {
  const copie = base.cloneNode(true);
  copie.querySelectorAll("style, script").forEach((n) => n.remove());
  return copie.textContent.replace(/[ \t\n\r]+/g, " ");
}
const svg = un(".fsd__svg");
const foyers = tous(".fsd__foyer");
const cles = foyers.map((g) => g.getAttribute("data-foyer"));
const boutons = tous(".fsd__bouton");
const panneauxVisibles = () => tous(".fsd__panneau.est-visible").map((p) => p.getAttribute("data-foyer")).join();
const presse = () => boutons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-foyer")).join();
const vue = () => svg.getAttribute("viewBox").split(" ").map(Number);
const proche = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.15);
const cadre = (cle) => un(`.fsd__bouton[data-foyer="${cle}"]`).getAttribute("data-cadre").split(" ").map(Number);
const plein = svg.getAttribute("data-cadre").split(" ").map(Number);
const curseur = un(".fsd__temps-curseur");
const sortie = un(".fsd__temps-sortie");
function dater(v) { curseur.value = String(v); curseur.dispatchEvent(new window.Event("input", { bubbles: true })); }
const futurs = () => foyers.filter((g) => g.classList.contains("est-futur")).map((g) => g.getAttribute("data-foyer")).sort().join();

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("sept foyers sur la carte", foyers.length === 7, foyers.length);
verifier("huit boutons : la vue d'ensemble et les sept foyers", boutons.length === 8 && boutons[0].getAttribute("data-foyer") === "accueil", boutons.length);
verifier("huit panneaux", tous(".fsd__panneau").length === 8, tous(".fsd__panneau").length);
verifier("chaque bouton est relié à son panneau",
  boutons.every((b) => { const p = document.getElementById(b.getAttribute("aria-controls")); return p && p.getAttribute("data-foyer") === b.getAttribute("data-foyer"); }));
verifier("chaque foyer a un bouton, une étiquette et une date de début",
  cles.every((c) => un(`.fsd__bouton[data-foyer="${c}"]`) && un(`.fsd__etiq[data-foyer="${c}"]`) && !isNaN(+un(`.fsd__foyer[data-foyer="${c}"]`).getAttribute("data-debut"))));
verifier("les boutons suivent l'ordre des dates, du plus ancien au plus récent",
  cles.every((c, i) => i === 0 || +foyers[i - 1].getAttribute("data-debut") <= +foyers[i].getAttribute("data-debut")) &&
  boutons.slice(1).map((b) => b.getAttribute("data-foyer")).join() === cles.join());
verifier("chaque bouton de foyer a un cadre de gros plan", boutons.slice(1).every((b) => cadre(b.getAttribute("data-foyer")).length === 4));
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("la pointe des flèches vise un marqueur existant",
  tous(".fsd__fleche-trait").length >= 5 && tous(".fsd__fleche-trait").every((p) => document.getElementById(p.getAttribute("marker-end").replace(/^url\(#|\)$/g, ""))));
verifier("la carte a un nom accessible", /Croissant fertile/.test(svg.getAttribute("aria-label")) && svg.getAttribute("role") === "img");
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);

console.log("ÉTAT DE DÉPART");
verifier("la vue d'ensemble s'affiche", panneauxVisibles() === "accueil" && presse() === "accueil", panneauxVisibles());
verifier("la carte montre le monde entier", proche(vue(), plein), vue().join(" "));
verifier("aucun foyer n'est choisi ni pâli", tous(".est-choisi, .est-pale").length === 0);
verifier("le curseur du temps est au bout : 7 foyers sur 7", curseur.value === "-1000" && /7 foyers sur 7/.test(sortie.textContent) && futurs() === "", sortie.textContent);
verifier("le bouton Vue d'ensemble de la carte est caché", !racine.classList.contains("est-zoom"));

console.log("CHOIX D'UN FOYER");
boutons.slice(1).forEach((b) => {
  const c = b.getAttribute("data-foyer");
  clic(b);
  const g = un(`.fsd__foyer[data-foyer="${c}"]`);
  const fleches = tous(`.fsd__fleche[data-foyer="${c}"]`);
  verifier(`${b.textContent} : panneau, zone choisie, gros plan`,
    panneauxVisibles() === c && presse() === c && g.classList.contains("est-choisi") &&
    foyers.filter((x) => x !== g).every((x) => x.classList.contains("est-pale")) &&
    un(`.fsd__etiq[data-foyer="${c}"]`).classList.contains("est-choisi") && proche(vue(), cadre(c)) && racine.classList.contains("est-zoom"),
    `${panneauxVisibles()} · ${vue().join(" ")}`);
  verifier(`${b.textContent} : seules ses flèches de diffusion sont montrées`,
    tous(".fsd__fleche.est-visible").length === fleches.length && fleches.every((f) => f.classList.contains("est-visible")));
});
clic(un('.fsd__foyer[data-foyer="andes"] path'));
verifier("un clic sur une zone de la carte choisit le foyer", panneauxVisibles() === "andes" && proche(vue(), cadre("andes")));
clic(un('.fsd__etiq[data-foyer="chine"] tspan'));
verifier("un clic sur une étiquette choisit le foyer", panneauxVisibles() === "chine");
clic(un(".fsd__retour"));
verifier("le bouton Vue d'ensemble de la carte revient au monde entier",
  panneauxVisibles() === "accueil" && proche(vue(), plein) && tous(".est-choisi, .est-pale").length === 0 && !racine.classList.contains("est-zoom"));
clic(un('.fsd__frise-ligne[data-foyer="ng"]'));
verifier("une ligne de la frise ouvre la fiche du foyer", panneauxVisibles() === "ng" && presse() === "ng");
clic(boutons[0]);
verifier("le bouton Vue d'ensemble revient à l'accueil", panneauxVisibles() === "accueil" && proche(vue(), plein));

console.log("ÉTIQUETTES");
const etiqs = tous(".fsd__etiq, .fsd__fleche-nom");
const paire = /^-?\d+(\.\d+)? -?\d+(\.\d+)?$/;
verifier("chaque étiquette et chaque nom de flèche est ancré sur sa zone ou sa flèche",
  etiqs.length === 12 && etiqs.every((el) => paire.test(el.getAttribute("data-ancre") || "") && paire.test(el.getAttribute("data-decal") || "")), etiqs.length);
const pos = (el) => [+el.getAttribute("x"), +el.getAttribute("y")];
const ancre = (el) => el.getAttribute("data-ancre").split(" ").map(Number);
const decal = (el) => el.getAttribute("data-decal").split(" ").map(Number);
// Dans jsdom, la carte mesure 1000 de large : l'échelle est la largeur visible sur 1000.
const echelle = () => { const v = vue(); return Math.max(v[2] / 1000, v[3] / (1000 * plein[3] / plein[2])); };
const placee = (el) => { const a = ancre(el), d = decal(el), q = pos(el), k = echelle(); return Math.abs(q[0] - (a[0] + d[0] * k)) < 0.11 && Math.abs(q[1] - (a[1] + d[1] * k)) < 0.11; };
verifier("vue d'ensemble : les étiquettes sont à leur place de départ", etiqs.every(placee) && Math.abs(echelle() - 1) < 0.001);
clic(un('.fsd__bouton[data-foyer="ng"]'));
const eNg = un('.fsd__etiq[data-foyer="ng"]');
verifier("gros plan : chaque étiquette se rapproche de sa zone et garde sa distance à l'écran",
  etiqs.every(placee) && echelle() < 0.3 && Math.abs(pos(eNg)[1] - ancre(eNg)[1]) < Math.abs(decal(eNg)[1]) * 0.3, `${pos(eNg)} · échelle ${echelle().toFixed(3)}`);
verifier("les lignes d'une étiquette suivent son déplacement", tous("tspan", eNg).length === 2 && tous("tspan", eNg).every((s) => s.getAttribute("x") === eNg.getAttribute("x")));
clic(un('.fsd__bouton[data-foyer="croissant"]'));
const rognee = (c) => un(`.fsd__etiq[data-foyer="${c}"]`).classList.contains("est-rogne");
verifier("gros plan : une étiquette pâle coupée par le bord est cachée, une étiquette qui tient reste",
  rognee("meso") && rognee("chine") && !rognee("afrique") && !rognee("croissant"), ["meso", "chine", "afrique", "croissant"].map((c) => c + " " + rognee(c)).join(", "));
const eCr = un('.fsd__etiq[data-foyer="croissant"]'), eAf = un('.fsd__etiq[data-foyer="afrique"]');
eCr.setAttribute("data-essai-large", "");
eAf.setAttribute("data-essai-large", "");
// (un second clic désélectionnerait : on repasse par la vue d'ensemble)
clic(boutons[0]);
clic(un('.fsd__bouton[data-foyer="croissant"]'));
verifier("l'étiquette du foyer choisi n'est jamais cachée, même trop large pour le cadre", !eCr.classList.contains("est-rogne") && eAf.classList.contains("est-rogne"));
eCr.removeAttribute("data-essai-large");
eAf.removeAttribute("data-essai-large");
clic(un('.fsd__bouton[data-foyer="croissant"]'));
verifier("le nom de la flèche vers la France reste visible dans le gros plan", !tous('.fsd__fleche[data-foyer="croissant"] .fsd__fleche-nom').some((el) => el.classList.contains("est-rogne")));
clic(boutons[0]);
verifier("vue d'ensemble : aucune étiquette cachée", tous(".est-rogne").length === 0 && etiqs.every(placee));

console.log("CONTENU DES FICHES");
const panneaux = tous(".fsd__panneau:not(.fsd__panneau--accueil)");
verifier("chaque fiche donne les plantes, les animaux et ses sources",
  panneaux.every((p) => tous(".fsd__donnee-nom", p).map((n) => n.textContent).join() === "Plantes,Animaux" && /^Sources\u00a0: /.test(un(".fsd__sources-foyer", p).textContent)));
verifier("chaque fiche dit ce qu'il en reste aujourd'hui", panneaux.every((p) => /^Aujourd'hui\./.test(un(".fsd__auj", p).textContent)));
verifier("« Aujourd'hui. » n'est pas répété dans la phrase qui suit",
  panneaux.every((p) => !/aujourd'hui/i.test(un(".fsd__auj", p).textContent.replace(/^Aujourd'hui\./, ""))));
verifier("chaque fiche explique le foyer en plus de 150 caractères", panneaux.every((p) => un(".fsd__detail", p).textContent.length > 150));
panneaux.forEach((p) => {
  const c = p.getAttribute("data-foyer");
  const debut = un(`.fsd__foyer[data-foyer="${c}"]`).getAttribute("data-debut");
  const badge = un(".fsd__debut", p).textContent;
  const ligne = un(`.fsd__frise-ligne[data-foyer="${c}"] .fsd__frise-date`).textContent;
  verifier(`${c} : la date de la fiche, de la carte et de la frise concordent`, badge.startsWith("Vers " + debut) && ligne === "Vers " + debut, `${badge} / ${ligne} / ${debut}`);
});
const ng = un('.fsd__foyer[data-foyer="ng"]');
verifier("la Nouvelle-Guinée a un début possible plus ancien, en pointillé sur la frise",
  +ng.getAttribute("data-possible") < +ng.getAttribute("data-debut") && !!un('.fsd__frise-ligne[data-foyer="ng"] .fsd__frise-incertain') && /peut-être dès/.test(un("#fsd-ng .fsd__debut").textContent));
verifier("le Croissant fertile est le plus ancien et la fiche le dit",
  Math.min(...foyers.map((g) => +g.getAttribute("data-debut"))) === +un('.fsd__foyer[data-foyer="croissant"]').getAttribute("data-debut") && /plus ancien/.test(un("#fsd-croissant .fsd__role").textContent));
verifier("la ville de Québec est repérée sur la carte", /Québec/.test(un(".fsd__ville-nom").textContent));

console.log("CURSEUR DU TEMPS");
dater(-10000);
verifier("-10 000 : aucun foyer encore", /aucun foyer encore/.test(sortie.textContent) && futurs() === cles.slice().sort().join(), sortie.textContent);
verifier("l'année s'écrit avec une espace insécable", /Vers -10\u00a0000\u00a0:/.test(sortie.textContent), JSON.stringify(sortie.textContent));
verifier("le curseur annonce son texte aux lecteurs d'écran", curseur.getAttribute("aria-valuetext") === sortie.textContent);
dater(-9500);
verifier("-9500 : seul le Croissant fertile", /1 foyer sur 7/.test(sortie.textContent) && !un('.fsd__foyer[data-foyer="croissant"]').classList.contains("est-futur") && futurs().split(",").length === 6, sortie.textContent);
dater(-7000);
verifier("-7000 : quatre foyers, la Nouvelle-Guinée seulement possible",
  /4 foyers sur 7/.test(sortie.textContent) && ng.classList.contains("est-possible") && !ng.classList.contains("est-futur") && futurs() === "afrique,ena", `${sortie.textContent} · ${futurs()}`);
verifier("les boutons et les lignes de la frise suivent le curseur",
  un('.fsd__bouton[data-foyer="afrique"]').classList.contains("est-futur") && !un('.fsd__bouton[data-foyer="chine"]').classList.contains("est-futur") &&
  un('.fsd__frise-ligne[data-foyer="ena"]').classList.contains("est-futur"));
verifier("le repère de la frise se place à la date du curseur", un(".fsd__frise").style.getPropertyValue("--pos") === "33.33%", un(".fsd__frise").style.getPropertyValue("--pos"));
dater(-5000);
verifier("-5000 : cinq foyers, la Nouvelle-Guinée comprise", /5 foyers sur 7/.test(sortie.textContent) && !ng.classList.contains("est-possible") && futurs() === "afrique,ena");
clic(un('.fsd__bouton[data-foyer="ena"]'));
verifier("un foyer encore à venir reste choisi, en pointillé", un('.fsd__foyer[data-foyer="ena"]').classList.contains("est-futur") && un('.fsd__foyer[data-foyer="ena"]').classList.contains("est-choisi"));
dater(-1000);
verifier("-1000 : les sept foyers", /7 foyers sur 7/.test(sortie.textContent) && futurs() === "" && tous(".est-possible").length === 0);
clic(boutons[0]);

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".fsd__entete .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".fsd__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  verifier("les choix et les textes sont rangés à côté de la carte", !!un(".fsd__cote > .fsd__choix") && !!un(".fsd__cote > .fsd__contenu") && !!un(".fsd__carte > .fsd__svg"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(un('.fsd__foyer[data-foyer="meso"] path'));
  verifier("textes repliés, la carte reste utilisable", panneauxVisibles() === "meso" && proche(vue(), cadre("meso")));
  clic(un(".fsd__retour"));
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("DÉSÉLECTION ET RÉINITIALISATION");
verifier("data-reinitialiser sur la racine et bouton Réinitialiser ajouté par page.js avant Plein écran",
  racine.hasAttribute("data-reinitialiser") && !!un(".fsd__entete .reinitialiser") && un(".fsd__entete .reinitialiser").nextElementSibling === un(".fsd__entete .plein-ecran"));
clic(boutons[0]);
const curseurDepart = curseur.getAttribute("value");
const etatDepart = () => JSON.stringify({ p: panneauxVisibles(), b: presse(), v: vue().map((x) => x.toFixed(1)), c: curseur.value, s: sortie.textContent, f: futurs(), z: racine.classList.contains("est-zoom"), m: tous(".est-choisi, .est-pale").length });
// état du chargement : curseur à sa valeur d'origine
dater(+curseurDepart);
const depart = etatDepart();
clic(un('.fsd__bouton[data-foyer="chine"]'));
clic(un('.fsd__bouton[data-foyer="chine"]'));
verifier("un second clic sur le bouton du foyer choisi le désélectionne (vue d'ensemble)", panneauxVisibles() === "accueil" && presse() === "accueil" && proche(vue(), plein) && tous(".est-choisi, .est-pale").length === 0 && !racine.classList.contains("est-zoom"));
clic(un('.fsd__foyer[data-foyer="meso"] path'));
clic(un('.fsd__foyer[data-foyer="meso"] path'));
verifier("un second clic sur la zone choisie la désélectionne", panneauxVisibles() === "accueil" && proche(vue(), plein));
clic(un('.fsd__etiq[data-foyer="andes"] tspan'));
clic(un('.fsd__etiq[data-foyer="andes"] tspan'));
verifier("un second clic sur l'étiquette choisie la désélectionne", panneauxVisibles() === "accueil");
clic(un('.fsd__frise-ligne[data-foyer="ng"]'));
clic(un('.fsd__frise-ligne[data-foyer="ng"]'));
verifier("un second clic sur la ligne de la frise désélectionne", panneauxVisibles() === "accueil");
dater(-4000);
clic(un('.fsd__bouton[data-foyer="afrique"]'));
clic(un(".fsd__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état du chargement (vue d'ensemble, curseur d'origine, aucune surbrillance)", etatDepart() === depart, etatDepart());
console.log("TEXTES");
let tout = "";
boutons.forEach((b) => { clic(b); tout += " " + texteVisible(racine); });
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(tout));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(tout), (tout.match(/.{30},\s+et\s.{10}/) || [""])[0]);
verifier("une espace insécable devant chaque deux-points", !/(?<!\u00a0):/.test(tout), (tout.match(/.{20}(?<!\u00a0):.{10}/) || [""])[0]);
verifier("aucune espace devant ? ! ;", !/[ \u00a0 ][?!;]/.test(tout), (tout.match(/.{20}[ \u00a0 ][?!;]/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?!\u00a0)/.test(tout) && !/(?<!\u00a0)»/.test(tout));
verifier("aucun nombre coupé par une espace ordinaire", !/\d \d{3}\b/.test(tout), (tout.match(/.{15}\d \d{3}\b.{5}/) || [""])[0]);
verifier("la source du fond de carte est nommée", /Natural Earth/.test(tout) && /approximatives/.test(tout));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
