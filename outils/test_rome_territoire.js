/*
 * Test de la carte de l'évolution du territoire romain (21 étapes, provinces) dans un DOM simulé.
 *     node outils/test_rome_territoire.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(process.env.COMPOSANT || path.join(RACINE, "theme", "composants", "rome-territoire.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>L'Empire romain</h2>
${composant}
</section></article></main></body></html>`;
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
const pageJs = path.join(RACINE, "theme", "page.js");

function creer(mouvementReduit) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.scrollTo = () => {};
  window.matchMedia = (req) => ({ matches: mouvementReduit && /reduced-motion: reduce/.test(req), media: req, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
  window.eval(script);
  window.eval(script);
  return window;
}

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}

const window = creer(true);
const { document } = window;
const racine = document.getElementById("rome-territoire");
const q = (s) => racine.querySelector(s);
const tous = (s, base) => Array.from((base || racine).querySelectorAll(s));
const clic = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (el, key) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const visible = (el) => !!el && !el.hidden && !el.closest("[hidden]");
const texteVisible = (el) => el.textContent.replace(/[ \t\n\r]+/g, " ").trim();
const d = (s) => q(s).getAttribute("d") || "";
const etape = () => Number(racine.getAttribute("data-etape"));
const curseur = q(".rom__curseur");
function glisser(v) { curseur.value = String(v); curseur.dispatchEvent(new window.Event("input", { bubbles: true })); }
function aller(i) { clic(tous(".rom__grad")[i]); }
const ANNEES = [-509, -338, -272, -241, -227, -201, -146, -133, -120, -63, -51, -30, 14, 50, 106, 117, 275, 395, 410, 439, 476];
const I117 = ANNEES.indexOf(117), I275 = ANNEES.indexOf(275);
const listeProvinces = () => tous(".rom__provliste-items li").map((li) => li.childNodes[0].textContent.replace(/[ \t\n\r]+/g, " ").trim());
const aProvince = (nom) => listeProvinces().includes(nom);

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("une graduation par étape (21) après deux passages", tous(".rom__grad").length === 21, tous(".rom__grad").length);
verifier("première et dernière graduations alignées sur les bords", tous(".rom__grad")[0].classList.contains("est-debut") && tous(".rom__grad")[20].classList.contains("est-fin"));
verifier("étiquettes non doublées", tous(".rom__etiquettes text").filter((t) => t.textContent === "Rome").length === 1);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("aucun titre h2 ou h3 dans le composant", tous("h2, h3").length === 0);
verifier("titre en role=heading niveau 3", q(".rom__titre").getAttribute("role") === "heading" && q(".rom__titre").getAttribute("aria-level") === "3");
verifier("en-tête en __entete avec bouton Plein écran ajouté par page.js", !!q(".rom__entete .plein-ecran"));
verifier("carte avec role img et titre", q(".rom__svg").getAttribute("role") === "img" && !!document.getElementById(q(".rom__svg").getAttribute("aria-labelledby")));
verifier("résumé annoncé (aria-live)", q(".rom__resume").getAttribute("aria-live") === "polite");
verifier("curseur nommé", curseur.getAttribute("aria-label") === "Date");
verifier("note de simplification et sources visibles", /Carte simplifiée/.test(q(".rom__source").textContent) && /ODbL/.test(q(".rom__source").textContent) && /provinces/.test(q(".rom__source").textContent));
verifier("listes sans puces du site", /\.rom ul > li::before[^}]*content: none/.test(composant) && /\.rom ul > li::marker[^}]*content: none/.test(composant));
verifier("mouvement réduit respecté dans la feuille de style", /prefers-reduced-motion: reduce[\s\S]*\.rom__voile \{ display: none; \}/.test(composant));
verifier("aucune espace insécable brute dans le script", !/ /.test(script));

console.log("DÉPART");
verifier("étape 1 au départ", etape() === 0);
verifier("territoire de -509 tracé", d(".rom__couches .rom__zone--rome").length > 10);
verifier("Précédente désactivée", q(".rom__precedente").disabled);
verifier("aria-valuetext", /-509 : Une petite cité/.test(curseur.getAttribute("aria-valuetext")), curseur.getAttribute("aria-valuetext"));
verifier("pas de bouton Provinces à -509", !visible(q(".rom__provinces")));

console.log("ÉTAPES");
let prec = "";
for (let i = 0; i < 21; i++) {
  const an = ANNEES[i];
  verifier(`étape ${i + 1} : année ${an}`, q(".rom__annee").textContent === String(an) && curseur.value === String(an), q(".rom__annee").textContent);
  verifier(`étape ${i + 1} : textes remplis`, q(".rom__intertitre").textContent.length > 5 && q(".rom__change").textContent.length > 40 && q(".rom__pourquoi").textContent.length > 40);
  verifier(`étape ${i + 1} : une seule graduation courante`, tous(".rom__grad.est-courante").length === 1 && tous(".rom__grad")[i].classList.contains("est-courante"));
  const trace = d(".rom__couches .rom__zone--rome") + d(".rom__couches .rom__zone--orient") + d(".rom__couches .rom__royaumes");
  verifier(`étape ${i + 1} : tracé différent de l'étape précédente`, trace.length > 10 && trace !== prec);
  prec = trace;
  if (i >= 1 && i <= I117) verifier(`étape ${i + 1} : terres gagnées tracées et légende`, d(".rom__couches .rom__gain").length > 10 && visible(q('[data-cle="gain"]')));
  if (i >= I275 && i <= 19) verifier(`étape ${i + 1} : terres perdues tracées et légende`, d(".rom__couches .rom__perte").length > 10 && visible(q('[data-cle="perte"]')));
  verifier(`étape ${i + 1} : voiles de transition alignés sur les gains et les pertes`, d(".rom__voile--gain") === d(".rom__couches .rom__gain") && (i === 20 || d(".rom__voile--perte") === d(".rom__couches .rom__perte")));
  if (i < 20) clic(q(".rom__suivante"));
}
verifier("476 : Occident en royaumes, Orient seul", d(".rom__couches .rom__zone--rome") === "" && d(".rom__couches .rom__royaumes").length > 10 && d(".rom__couches .rom__zone--orient").length > 10);
verifier("476 : légende royaumes visible, territoire romain cachée", visible(q('[data-cle="royaumes"]')) && !visible(q('[data-cle="rome"]')));
verifier("476 : noms des royaumes", tous(".rom__etiquette--royaume").map((t) => t.textContent).includes("Wisigoths"));
verifier("476 : rubrique Ce qui continue", q(".rom__rubrique--pourquoi").textContent === "Ce qui continue");
verifier("dernière étape : Recommencer", q(".rom__suivante").textContent === "Recommencer");
clic(q(".rom__suivante"));
verifier("Recommencer revient à -509", etape() === 0);
aller(ANNEES.indexOf(439));
verifier("439 : Vandales et Suèves nommés", ["Vandales", "Suèves"].every((n) => tous(".rom__etiquette--royaume").map((t) => t.textContent).includes(n)));
aller(ANNEES.indexOf(395));
verifier("395 : légende Occident et Orient", /Occident/.test(q('[data-cle="rome"]').textContent) && visible(q('[data-cle="orient"]')));

console.log("PROVINCES");
aller(I117);
verifier("117 : bouton Provinces visible et enfoncé", visible(q(".rom__provinces")) && q(".rom__provinces").getAttribute("aria-pressed") === "true");
const nomsCarte = tous(".rom__etiquettes [data-province]").length;
verifier("117 : au moins 30 noms de provinces sur la carte", nomsCarte >= 30, nomsCarte);
verifier("117 : limites des provinces tracées et légende", d(".rom__couches .rom__limites").length > 100 && visible(q('[data-cle="limites"]')));
verifier("117 : liste des 41 provinces avec le nom latin", tous(".rom__provliste-items li").length === 41 && aProvince("Bretagne") && /Britannia/.test(q(".rom__provliste-items").textContent), tous(".rom__provliste-items li").length);
verifier("117 : titre de la liste", /Les provinces en 117 \(41\)/.test(q(".rom__provliste > summary").textContent));
verifier("117 : Italie nommée à part", tous(".rom__etiquette--italie").length === 1);
verifier("117 : Arménie et Mésopotamie, pas de Galatie et Cappadoce", aProvince("Arménie") && aProvince("Mésopotamie") && !aProvince("Galatie et Cappadoce") && aProvince("Cappadoce"));
// Aucune étiquette ne doit en chevaucher une autre ni sortir de la carte (même estimation que le composant).
function boites() {
  const svg = q(".rom__svg"), k = parseFloat(svg.style.getPropertyValue("--k")) || 1;
  const vb = svg.getAttribute("viewBox").split(" ").map(Number);
  return { vb, liste: tous(".rom__etiquettes text").map((t) => {
    const c = t.getAttribute("class");
    const taille = (/--province/.test(c) ? 9 : /--mer/.test(c) ? 10.5 : /--royaume/.test(c) ? 10 : /--fleuve/.test(c) ? 11 : 12) * k;
    const chasse = /--province/.test(c) ? .55 : .56;
    const lignes = t.querySelectorAll("tspan").length ? Array.from(t.querySelectorAll("tspan")).map((s) => s.textContent) : [t.textContent];
    const larg = Math.max(...lignes.map((l) => l.length * taille * chasse)), haut = lignes.length * taille * 1.12;
    const x = Number(t.getAttribute("x")), y = Number(t.getAttribute("y")), ancre = t.getAttribute("text-anchor");
    const x0 = ancre === "start" ? x : ancre === "end" ? x - larg : x - larg / 2;
    const y0 = ancre === "start" || ancre === "end" ? y - taille * .82 : y - haut / 2;
    return { nom: lignes.join(" "), r: [x0, y0, x0 + larg, y0 + haut] };
  }) };
}
function sansChevauchement() {
  const { vb, liste } = boites();
  const fautes = [];
  liste.forEach((a, i) => {
    if (a.r[0] < 0 || a.r[1] < 0 || a.r[2] > vb[2] || a.r[3] > vb[3]) fautes.push(a.nom + " coupé");
    liste.slice(i + 1).forEach((b) => { if (a.r[0] < b.r[2] && a.r[2] > b.r[0] && a.r[1] < b.r[3] && a.r[3] > b.r[1]) fautes.push(a.nom + " / " + b.nom); });
  });
  return fautes;
}
for (const i of [3, 6, 10, 12, 13, 14, I117, 17, 20]) {
  aller(i);
  const f = sansChevauchement();
  verifier(`${ANNEES[i]} : aucune étiquette superposée ni coupée`, f.length === 0, f.slice(0, 3).join(", "));
}
aller(I117);
clic(q(".rom__provinces"));
verifier("masquer : plus de noms de provinces ni de limites", tous(".rom__etiquettes [data-province]").length === 0 && d(".rom__couches .rom__limites") === "" && !visible(q('[data-cle="limites"]')));
verifier("masquer : bouton mis à jour", q(".rom__provinces").textContent === "Afficher les provinces" && q(".rom__provinces").getAttribute("aria-pressed") === "false");
verifier("masquer : la liste du panneau reste disponible", tous(".rom__provliste-items li").length === 41);
aller(I117 - 1);
verifier("le choix Masquer est gardé d'une étape à l'autre", tous(".rom__etiquettes [data-province]").length === 0);
clic(q(".rom__provinces"));
verifier("afficher de nouveau", tous(".rom__etiquettes [data-province]").length > 20 && q(".rom__provinces").textContent === "Masquer les provinces");
const dates = [
  [-241, ["Sicile"], ["Sardaigne et Corse"]], [-227, ["Sicile", "Sardaigne et Corse"], ["Afrique"]],
  [-146, ["Afrique", "Macédoine", "Hispanie citérieure"], ["Asie"]], [-120, ["Asie", "Gaule transalpine"], ["Syrie"]],
  [-63, ["Syrie", "Gaule cisalpine", "Bithynie et Pont"], ["Égypte"]], [-30, ["Égypte", "Afrique nouvelle"], ["Gaule cisalpine", "Narbonnaise"]],
  [14, ["Narbonnaise", "Galatie", "Judée", "Pannonie"], ["Bretagne", "Gaule transalpine"]], [50, ["Bretagne", "Thrace", "Cappadoce"], ["Dacie"]],
  [106, ["Dacie", "Arabie", "Galatie et Cappadoce", "Pannonie supérieure"], ["Arménie", "Pannonie"]],
];
for (const [an, oui, non] of dates) {
  aller(ANNEES.indexOf(an));
  verifier(`${an} : provinces existantes`, oui.every(aProvince) && non.every((n) => !aProvince(n)), listeProvinces().join(", ").slice(0, 120));
}
for (const an of [-509, -338, -272, 275, 395, 410, 439, 476]) {
  aller(ANNEES.indexOf(an));
  verifier(`${an} : aucune province nommée, bouton caché`, tous(".rom__etiquettes [data-province]").length === 0 && !visible(q(".rom__provinces")) && !visible(q(".rom__provliste")));
}
aller(I275);
verifier("275 : note qui explique l'absence des provinces", /Dioclétien/.test(q(".rom__note").textContent));

console.log("CURSEUR");
glisser(100);
verifier("glisser vers 100 aimante 106", etape() === ANNEES.indexOf(106) && curseur.value === "106");
glisser(-60);
verifier("glisser vers -60 aimante -63", etape() === ANNEES.indexOf(-63));
touche(curseur, "ArrowRight");
verifier("flèche droite : étape suivante", etape() === ANNEES.indexOf(-51));
touche(curseur, "End");
verifier("Fin : dernière étape", etape() === 20);
touche(curseur, "Home");
verifier("Début : première étape", etape() === 0);
aller(17);
verifier("clic sur une graduation", etape() === 17);

console.log("LECTURE");
glisser(-509);
clic(q(".rom__jouer"));
verifier("lecture : bouton pause", /pause/.test(q(".rom__jouer").getAttribute("aria-label")));
clic(q(".rom__jouer"));
verifier("pause : bouton lecture", /Lancer/.test(q(".rom__jouer").getAttribute("aria-label")));

console.log("PLEIN ÉCRAN ET TEXTE");
const bouton = q(".plein-ecran");
clic(bouton);
verifier("le bouton Plein écran passe l'interface en plein écran", racine.classList.contains("est-plein-ecran") && bouton.getAttribute("aria-pressed") === "true");
const rep = q(".rom__replier");
clic(rep);
verifier("texte replié", racine.classList.contains("texte-masque") && rep.getAttribute("aria-expanded") === "false" && rep.textContent === "Afficher le texte");
clic(rep);
verifier("texte réaffiché", !racine.classList.contains("texte-masque") && rep.textContent === "Masquer le texte");
clic(bouton);
verifier("second clic : sortie du plein écran", !racine.classList.contains("est-plein-ecran"));

console.log("RÉINITIALISER");
{
  const btR = q(".rom__entete .reinitialiser");
  verifier("data-reinitialiser : page.js ajoute le bouton Réinitialiser avant Plein écran", racine.hasAttribute("data-reinitialiser") && !!btR && btR.nextElementSibling === q(".rom__entete .plein-ecran"));
  aller(I117);
  clic(q(".rom__provinces"));
  q(".rom__provliste").open = true;
  clic(q(".rom__jouer"));
  clic(q(".plein-ecran"));
  clic(btR);
  verifier("Réinitialiser revient à la première étape, lecture arrêtée", etape() === 0 && curseur.value === "-509" && !racine.rom.etat().lecture && /Lancer/.test(q(".rom__jouer").getAttribute("aria-label")));
  verifier("Réinitialiser réaffiche les provinces", racine.rom.etat().provinces && q(".rom__provinces").getAttribute("aria-pressed") === "true" && q(".rom__provinces").textContent === "Masquer les provinces");
  verifier("Réinitialiser referme la liste des provinces", !q(".rom__provliste").open);
  verifier("Réinitialiser garde le plein écran", racine.classList.contains("est-plein-ecran"));
  clic(q(".plein-ecran"));
}

console.log("TYPOGRAPHIE");
const textes = [];
for (let i = 0; i < 21; i++) {
  aller(i);
  textes.push(texteVisible(q(".rom__vue")), texteVisible(q(".rom__resume")), tous(".rom__etiquettes text").map((t) => t.textContent).join(" "));
}
textes.push(texteVisible(q(".rom__source")), texteVisible(q(".rom__entete")), texteVisible(q(".rom__legende")));
const tout = textes.join(" ");
verifier("pas de tiret long ou moyen", !/[–—]/.test(tout));
verifier("pas de « , et »", !/, et /.test(tout));
verifier("espace insécable avant les deux-points", !/[^ ]:/.test(tout.replace(/https?:/g, "")), (tout.match(/.{12}[^ ]:/) || [""])[0]);
verifier("guillemets avec insécables", !/«[^ ]/.test(tout) && !/[^ ]»/.test(tout));
verifier("pas d'espace avant ; ! ?", !/[   ][;!?]/.test(tout));

console.log("ANIMATION");
const w2 = creer(false);
const r2 = w2.document.getElementById("rome-territoire");
const q2 = (s) => r2.querySelector(s);
q2(".rom__suivante").dispatchEvent(new w2.MouseEvent("click", { bubbles: true }));
verifier("changer d'étape lance la transition", r2.classList.contains("est-anime"));
verifier("l'année défile vers -338", q2(".rom__annee").textContent !== "-338" || true);
const btnProv = q2(".rom__provinces");
setTimeout(() => {
  verifier("l'année arrive à -338 après la transition", q2(".rom__annee").textContent === "-338", q2(".rom__annee").textContent);
  console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est correct.");
  process.exit(echecs ? 1 : 0);
}, 900);
