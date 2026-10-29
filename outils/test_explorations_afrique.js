/*
 * Test de la carte des grands voyages d'exploration en Afrique (fiche 11),
 * dans un DOM simulé.
 *     node outils/test_explorations_afrique.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js, pour vérifier
 * aussi le bouton Plein écran et le repli des textes. La variable
 * TEST_COMPOSANT permet de tester une copie modifiée (mutations volontaires).
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const FICHIER = process.env.TEST_COMPOSANT || path.join(RACINE, "theme", "composants", "explorations-afrique.html");
const composant = fs.readFileSync(FICHIER, "utf8");
const NB = "\u00a0";
let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}

function monter(reduit) {
  const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>L'exploration du continent africain</h2>
${composant}
</section></article></main></body></html>`;
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: reduit && /reduce/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  const pageJs = path.join(RACINE, "theme", "page.js");
  if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
  const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
  window.eval(script);
  window.eval(script); // un second passage ne doit rien doubler
  return { window, document: window.document, racine: window.document.getElementById("explorations-afrique") };
}

const { window, document, racine } = monter(false);
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
const clic = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const bouton = (texte) => tous("button").find((b) => b.textContent.trim() === texte);
const puce = (id) => un(`.exa__bouton[data-exp="${id}"]`);
const curseur = un(".exa__curseur");
function annee(t) { curseur.value = String(t); curseur.dispatchEvent(new window.Event("input", { bubbles: true })); }
const an = () => un(".exa__an").textContent;
const D = JSON.parse(composant.match(/var D = (\{[\s\S]*?\});\n/)[1]);
const traces = () => tous(".exa__trace");
const traceDe = (id) => un(`.exa__traces g[data-v="${id}"] .exa__trace`);
const teteDe = (id) => tous(".exa__tete")[D.voyages.findIndex((v) => v.id === id)];
const visibles = () => D.voyages.filter((v) => (traceDe(v.id).getAttribute("d") || "") !== "").map((v) => v.id);
function texteVisible(base) {
  const copie = base.cloneNode(true);
  copie.querySelectorAll("style, script").forEach((n) => n.remove());
  return copie.textContent.replace(/[ \t\n\r]+/g, " ");
}

console.log("MISE EN PLACE");
verifier("le composant est présent une seule fois", tous("#explorations-afrique", document).length === 1);
verifier("la garde data-pret est posée", racine.getAttribute("data-pret") === "1");
verifier("l'entête se termine par __entete", !!un(".exa__entete") && /__entete$/.test(un(".exa__entete").className));
verifier("page.js ajoute le bouton Plein écran dans l'entête", !!un(".exa__entete .plein-ecran"));
verifier("un seul jeu de tracés malgré deux passages du script", traces().length === D.voyages.length, traces().length);
verifier("aucun titre h2 ou h3 dans le composant", tous("h2, h3").length === 0);

console.log("DONNÉES");
const noms = D.explorateurs.map((e) => e.nom).join(" | ");
verifier("au moins 8 explorateurs", D.explorateurs.length >= 8, D.explorateurs.length);
verifier("Livingstone et Stanley sont présents", /David Livingstone/.test(noms) && /Henry Morton Stanley/.test(noms));
verifier("au moins 15 voyages", D.voyages.length >= 15, D.voyages.length);
const vb = un(".exa__svg").getAttribute("viewBox").split(" ").map(Number);
let pointsOk = true, tempsOk = true, bornesOk = true, detail = "";
D.voyages.forEach((v) => {
  if (v.pts.length % 3 !== 0 || v.pts.length < 6) { pointsOk = false; detail = v.id; }
  for (let i = 0; i < v.pts.length; i += 3) {
    const x = v.pts[i], y = v.pts[i + 1], t = v.pts[i + 2];
    if (!isFinite(x) || !isFinite(y) || !isFinite(t) || x < 0 || x > vb[2] || y < 0 || y > vb[3]) { pointsOk = false; detail = v.id + " point " + i / 3; }
    if (i >= 3 && t < v.pts[i - 1] - 1e-9) { tempsOk = false; detail = v.id + " temps " + i / 3; }
  }
  if (Math.abs(v.pts[2] - v.debut) > 1e-6 || Math.abs(v.pts[v.pts.length - 1] - v.fin) > 1e-6) { bornesOk = false; detail = v.id; }
  if (v.debut < D.debut || v.fin > D.fin) { bornesOk = false; detail = v.id; }
});
verifier("tous les points sont des nombres dans la carte", pointsOk, detail);
verifier("le temps avance toujours le long de chaque tracé", tempsOk, detail);
verifier("début et fin de chaque voyage cohérents", bornesOk, detail);
verifier("chaque explorateur a ses voyages", D.explorateurs.every((e) => e.voyages.length && e.voyages.every((id) => D.voyages.some((v) => v.id === id && v.exp === e.id))));
verifier("chaque explorateur dit qui paie, pourquoi et ce que ça change", D.explorateurs.every((e) => e.paie && e.pourquoi && e.change));
verifier("chaque voyage a au moins deux étapes nommées", D.voyages.every((v) => v.etapes.length >= 2));
const tout = JSON.stringify(D);
verifier("les guides africains sont nommés (Bombay, Susi, Chuma)", /Sidi Mubarak Bombay/.test(tout) && /Susi/.test(tout) && /Chuma/.test(tout));
verifier("les noms africains des lieux sont donnés", /Mosi-oa-Tunya/.test(tout) && /Nalubaale/.test(tout) && /Mwitanzige/.test(tout));
const rencontre = (id) => D.voyages.find((v) => v.id === id).etapes.some((e) => e.date === "10" + NB + "novembre 1871" && e.lieu === "Ujiji");
verifier("la rencontre d'Ujiji est datée du 10 novembre 1871 chez Livingstone et chez Stanley", rencontre("livingstone3") && rencontre("stanley1"));

console.log("DÉPART : TOUT LE PARCOURS");
verifier("au départ, l'année affichée est 1885", an() === "1885", an());
verifier("au départ, tous les tracés sont complets", D.voyages.every((v) => traceDe(v.id).getAttribute("d").length > 20) && D.voyages.every((v, i) => traceDe(v.id).getAttribute("d").split("L").length === v.pts.length / 3));
verifier("au départ, aucune tête de voyage en cours", tous(".exa__tete").every((g) => g.style.display === "none"));
verifier("la Vue d'ensemble est active", bouton("Vue d'ensemble").getAttribute("aria-pressed") === "true");
verifier("dès le départ, le retour du corps est en pointillé", /\d/.test(traceDe("retour-corps").style.strokeDasharray || ""), traceDe("retour-corps").style.strokeDasharray);
verifier("cinq blocs d'explication", tous(".exa__bloc").length === 5, tous(".exa__bloc").length);

console.log("CURSEUR DU TEMPS");
annee(1796.3);
verifier("en 1796, seul le premier voyage de Park est en cours", visibles().join() === "park1", visibles().join());
verifier("en 1796, le tracé de Park est partiel", traceDe("park1").getAttribute("d").split("L").length < D.voyages[0].pts.length / 3);
verifier("en 1796, la tête de Park est visible et nommée", teteDe("park1").style.display !== "none" && teteDe("park1").textContent === "Park");
verifier("l'année suit le curseur", an() === "1796", an());
annee(1871.9);
const enCours = D.voyages.filter((v) => teteDe(v.id).style.display !== "none").map((v) => v.id).join();
verifier("fin 1871, Livingstone et Stanley voyagent en même temps", /livingstone3/.test(enCours) && /stanley1/.test(enCours), enCours);
verifier("l'événement de la rencontre est affiché", /Stanley retrouve Livingstone/.test(un(".exa__evenement").textContent), un(".exa__evenement").textContent);
annee(1840);
verifier("en 1840, aucun événement récent n'est affiché", un(".exa__evenement").textContent === "", un(".exa__evenement").textContent);
annee(1795);
verifier("en 1795, aucun tracé", visibles().length === 0, visibles().join());

console.log("CHOISIR UN EXPLORATEUR");
annee(1871.9);
clic(puce("livingstone"));
const svg = un(".exa__svg");
verifier("le bouton est pressé", puce("livingstone").getAttribute("aria-pressed") === "true");
verifier("la carte sait quel explorateur est choisi", svg.getAttribute("data-choisi") === "livingstone");
verifier("ses tracés sont mis en évidence", ["livingstone1", "livingstone2", "livingstone3", "retour-corps"].every((id) => traceDe(id).classList.contains("est-choisi")) && !traceDe("stanley1").classList.contains("est-choisi"));
verifier("le temps avance jusqu'à la fin de ses voyages", an() === "1874", an());
verifier("la fiche nomme l'explorateur", un(".exa__nom-exp").textContent === "David Livingstone");
const nbEtapes = D.explorateurs.find((e) => e.id === "livingstone").voyages.reduce((s, id) => s + D.voyages.find((v) => v.id === id).etapes.length, 0);
verifier("toutes ses étapes sont listées", tous(".exa__etape").length === nbEtapes, tous(".exa__etape").length + " / " + nbEtapes);
verifier("les marqueurs des étapes sont dessinés", tous(".exa__marqueur").length === nbEtapes, tous(".exa__marqueur").length);
verifier("le retour du corps est tracé en pointillé", /\d/.test(traceDe("retour-corps").style.strokeDasharray || ""), traceDe("retour-corps").style.strokeDasharray);
const deplies = () => tous(".exa__voyage-titre").filter((b) => b.getAttribute("aria-expanded") === "true").map((b) => b.parentNode.getAttribute("data-v"));
verifier("un seul voyage déplié au départ : le premier", deplies().join() === "livingstone1", deplies().join());
verifier("les étapes des voyages repliés sont cachées", tous(".exa__voyage").filter((b) => b.querySelector(".exa__etapes").hidden).length === 3);
clic(tous(".exa__voyage-titre")[2]);
verifier("déplier un autre voyage replie le premier", deplies().join() === "livingstone3", deplies().join());
clic(tous(".exa__voyage-titre")[0]);
const etape = tous(".exa__etape").find((b) => /Chitambo/.test(b.textContent) && /1er/.test(b.textContent));
clic(etape);
verifier("choisir une étape la marque comme courante", etape.getAttribute("aria-current") === "true");
verifier("choisir une étape déplie son voyage", deplies().join() === "livingstone3", deplies().join());
verifier("choisir une étape ramène le temps à sa date", an() === "1873", an());
verifier("l'étape choisie est nommée sur la carte", un(".exa__marque-nom") && un(".exa__marque-nom").textContent === "Village du chef Chitambo");
verifier("un seul marqueur actif", tous(".exa__marqueur.est-actif").length === 1);
clic(puce("stanley"));
verifier("changer d'explorateur change la fiche", un(".exa__nom-exp").textContent === "Henry Morton Stanley" && svg.getAttribute("data-choisi") === "stanley");
verifier("un seul explorateur pressé", tous(".exa__bouton[aria-pressed='true']").length === 1);
verifier("les puces portent un nom court et le nom complet en infobulle", puce("stanley").textContent === "Stanley" && puce("stanley").title === "Henry Morton Stanley");
verifier("pendant le choix, la légende du temps donne la dernière étape de l'explorateur", un(".exa__evenement").textContent !== "" && D.voyages.some((v) => v.exp === "stanley" && v.etapes.some((e) => e.lieu === un(".exa__evenement").textContent)), un(".exa__evenement").textContent);
clic(puce("stanley"));
verifier("cliquer de nouveau revient à la vue d'ensemble", !svg.hasAttribute("data-choisi") && tous(".exa__bloc").length === 5);
const cible = un('.exa__cible[data-v="caillie"]');
clic(cible);
verifier("cliquer sur un tracé choisit son explorateur", svg.getAttribute("data-choisi") === "caillie" && un(".exa__nom-exp").textContent === "René Caillié");
clic(bouton("Vue d'ensemble"));
verifier("le bouton Vue d'ensemble revient à l'ensemble", !svg.hasAttribute("data-choisi") && bouton("Vue d'ensemble").getAttribute("aria-pressed") === "true");

console.log("LECTURE");
annee(1885);
clic(un(".exa__lire"));
verifier("la lecture repart du début", an() === "1795", an());
verifier("le bouton devient Pause", un(".exa__lire").getAttribute("aria-label") === "Mettre en pause");
clic(un(".exa__lire"));
verifier("un second clic arrête la lecture", un(".exa__lire").getAttribute("aria-label") === "Lancer la lecture");
clic(puce("caillie"));
annee(1800);
clic(tous("button").find((b) => /Suivre le voyage/.test(b.textContent)));
verifier("Suivre le voyage part juste avant le voyage choisi", an() === "1827", an());
clic(un(".exa__lire"));
clic(bouton("Vue d'ensemble"));

console.log("PLEIN ÉCRAN");
const replier = un(".exa__replier");
racine.classList.add("est-plein-ecran");
clic(replier);
verifier("Masquer le texte replie le panneau", racine.classList.contains("texte-masque") && replier.textContent === "Afficher le texte");
clic(replier);
verifier("Afficher le texte le rouvre", !racine.classList.contains("texte-masque") && replier.getAttribute("aria-pressed") === "false");
racine.classList.remove("est-plein-ecran");

console.log("MOUVEMENT RÉDUIT");
{
  const m = monter(true);
  const r = m.racine, c = r.querySelector(".exa__curseur");
  const lire = r.querySelector(".exa__lire");
  lire.dispatchEvent(new m.window.MouseEvent("click", { bubbles: true }));
  verifier("sans animation, la lecture démarre en 1795", r.querySelector(".exa__an").textContent === "1795");
  verifier("sans animation, le bouton devient Pause", lire.getAttribute("aria-label") === "Mettre en pause");
  lire.dispatchEvent(new m.window.MouseEvent("click", { bubbles: true }));
  verifier("sans animation, la lecture s'arrête", lire.getAttribute("aria-label") === "Lancer la lecture" && c.value !== "");
  m.window.close();
}

console.log("TYPOGRAPHIE DES TEXTES AFFICHÉS");
const textes = [texteVisible(racine)];
D.explorateurs.forEach((e) => { clic(puce(e.id)); textes.push(texteVisible(un(".exa__vue"))); });
clic(bouton("Vue d'ensemble"));
const ensemble = textes.join(" ");
const fautes = [];
if (/[\u2013\u2014]/.test(ensemble)) fautes.push("tiret long ou demi-long");
if (/, et /.test(ensemble)) fautes.push("« , et »");
if (/[ \u00a0][;!?]/.test(ensemble)) fautes.push("espace avant ; ! ?");
if (/[^\u00a0]:(?!\/)/.test(ensemble.replace(/https?:\/\//g, ""))) fautes.push("deux-points sans insécable : " + (ensemble.match(/.{20}[^\u00a0]:.{10}/) || [""])[0]);
if (/«[^\u00a0]/.test(ensemble) || /[^\u00a0]»/.test(ensemble)) fautes.push("guillemets sans insécable");
if (/\d \d{3}\b/.test(ensemble)) fautes.push("nombre sans insécable");
verifier("typographie québécoise respectée partout", fautes.length === 0, fautes.join(" | "));

console.log("FICHE 11 CONSTRUITE");
const fiche = path.join(RACINE, "docs", "histoire", "11-expansion-monde-industriel.html");
if (fs.existsSync(fiche) && !process.env.TEST_COMPOSANT) {
  const h = fs.readFileSync(fiche, "utf8");
  verifier("la fiche construite contient le composant une fois", (h.match(/id="explorations-afrique"/g) || []).length === 1);
  const ids = (h.match(/\sid="([^"]+)"/g) || []).map((s) => s.trim().slice(4, -1));
  const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
  verifier("aucun identifiant en double dans la fiche", doublons.length === 0, doublons.join());
}

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
