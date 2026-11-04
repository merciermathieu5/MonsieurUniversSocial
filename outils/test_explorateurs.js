/*
 * Test de la carte des explorateurs des Grandes découvertes et de leurs voyages
 * (fiche 08), dans un DOM simulé.
 *     node outils/test_explorateurs.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js, pour vérifier
 * aussi les boutons Plein écran et Réinitialiser. La variable TEST_COMPOSANT
 * permet de tester une copie modifiée (mutations volontaires).
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const FICHIER = process.env.TEST_COMPOSANT || path.join(RACINE, "theme", "composants", "explorateurs.html");
const composant = fs.readFileSync(FICHIER, "utf8");
let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}

function monter(reduit) {
  const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les explorateurs et leurs découvertes</h2>
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
  return { window, document: window.document, racine: window.document.getElementById("explorateurs") };
}

const { window, document, racine } = monter(true);
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
const clic = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (el, key) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
const bouton = (texte, base) => tous("button", base).find((b) => b.textContent.trim() === texte);
const puce = (id) => un(`.xpl__puce[data-exp="${id}"]`);
const curseur = un(".xpl__curseur");
function temps(t) { curseur.value = String(t); curseur.dispatchEvent(new window.Event("input", { bubbles: true })); }
const D = JSON.parse(composant.match(/var D = (\{[\s\S]*?\});\n/)[1]);
const voyage = (id) => D.voyages.find((v) => v.id === id);
const trait = (id) => un(`.xpl__voyage[data-v="${id}"] .xpl__trace:not(.xpl__trace--retour)`);
const groupe = (id) => un(`.xpl__voyage[data-v="${id}"]`);
const dessines = () => D.voyages.filter((v) => groupe(v.id).style.display !== "none" && (trait(v.id).getAttribute("d") || "") !== "").map((v) => v.id);
const vue = () => un(".xpl__vue");
const evenement = () => un(".xpl__evenement").textContent;
const viewBox = () => un(".xpl__svg").getAttribute("viewBox").split(/\s+/).map(Number);
function texteVisible(base) {
  const copie = base.cloneNode(true);
  copie.querySelectorAll("style, script").forEach((n) => n.remove());
  return copie.textContent.replace(/[ \t\n\r]+/g, " ");
}

console.log("MISE EN PLACE");
verifier("le composant est présent une seule fois", tous("#explorateurs", document).length === 1);
verifier("la garde data-pret est posée", racine.getAttribute("data-pret") === "1");
verifier("l'entête se termine par __entete", !!un(".xpl__entete") && /__entete$/.test(un(".xpl__entete").className));
verifier("page.js ajoute Plein écran et Réinitialiser", !!un(".xpl__entete .plein-ecran") && !!un(".xpl__entete .reinitialiser"));
verifier("un seul jeu de tracés malgré deux passages du script", tous(".xpl__voyage").length === D.voyages.length, tous(".xpl__voyage").length);
verifier("une seule frise malgré deux passages du script", tous(".xpl__frise-nom").length === D.explorateurs.length, tous(".xpl__frise-nom").length);
verifier("aucun titre h2 ou h3 dans le composant", tous("h2, h3").length === 0);
verifier("chaque portrait a son repli en cas d'absence", tous("[data-xpl-portrait]").length === D.explorateurs.length && tous("[data-xpl-portrait]").every((i) => typeof i.onerror === "function"));

console.log("DONNÉES");
const ORDRE = ["dias", "colomb", "gama", "cabot", "cabral", "magellan", "cartier"];
verifier("les sept explorateurs, dans l'ordre de la fiche de notes", D.explorateurs.map((e) => e.id).join() === ORDRE.join(), D.explorateurs.map((e) => e.id).join());
verifier("chaque explorateur a sa fiche complète", D.explorateurs.every((e) => e.nom && e.court && e.vie && e.infos.length === 3 && e.texte.length && e.indice && e.savais && D.couronnes[e.couronne]));
verifier("la fiche donne l'origine, l'expédition et le financement", D.explorateurs.every((e) => /^Origine$/.test(e.infos[0][0]) && /^Expéditions?$/.test(e.infos[1][0]) && /^Financement$/.test(e.infos[2][0])));
verifier("un seul voyage principal par explorateur", D.explorateurs.every((e) => D.voyages.filter((v) => v.exp === e.id && v.principal).length === 1));
verifier("chaque voyage a au moins trois escales datées et décrites", D.voyages.every((v) => v.escales.length >= 3 && v.escales.every((e) => e.nom && e.date && e.texte && e.texte.length > 40)), D.voyages.filter((v) => !v.escales.every((e) => e.texte && e.texte.length > 40)).map((v) => v.id).join());
verifier("les escales se suivent dans le temps", D.voyages.every((v) => v.escales.every((e, i) => i === 0 || e.t >= v.escales[i - 1].t)));
const fini = (pts) => pts.every((n) => Number.isFinite(n));
verifier("les tracés ne contiennent que des nombres", D.voyages.every((v) => fini(v.aller) && fini(v.retour) && v.aller.length % 3 === 0 && v.retour.length % 3 === 0));
const croissant = (pts) => { for (let i = 5; i < pts.length; i += 3) { if (pts[i] < pts[i - 3]) return false; } return true; };
verifier("le temps avance le long de chaque tracé", D.voyages.every((v) => croissant(v.aller) && croissant(v.retour)));
const dans = (x, y) => x >= -1 && x <= D.carte.largeur + 1 && y >= -1 && y <= D.carte.hauteur + 1;
verifier("tous les points sont sur la carte", D.voyages.every((v) => { for (let i = 0; i < v.aller.length; i += 3) { if (!dans(v.aller[i], v.aller[i + 1])) return false; } return v.escales.every((e) => dans(e.x, e.y)); }));
verifier("le retour part de la dernière escale de l'aller", D.voyages.every((v) => !v.retour.length || (v.retour[0] === v.aller[v.aller.length - 3] && v.retour[1] === v.aller[v.aller.length - 2])));
verifier("chaque voyage a un cadre valide", D.voyages.every((v) => v.cadre.length === 4 && v.cadre[2] > 0 && v.cadre[3] > 0));
verifier("chaque voyage principal a son nom sur la carte", D.voyages.every((v) => !v.principal || (v.nomCarte && v.etiquettes.length)));
verifier("le tour du monde franchit le bord de la carte", D.voyages.some((v) => v.exp === "magellan" && v.allerSauts.length >= 1));
const tousTextes = JSON.stringify(D);
verifier("plus aucun texte de brouillon", !/Brouillon|À vérifier|TODO/i.test(tousTextes));

console.log("VUE D'ENSEMBLE");
verifier("la vue d'ensemble est choisie au départ", puce("dias").getAttribute("aria-pressed") === "false" && un(".xpl__puce--outil").getAttribute("aria-pressed") === "true");
verifier("la carte montre le monde entier", viewBox()[2] >= D.carte.largeur - 1, viewBox().join(" "));
const principaux = D.voyages.filter((v) => v.principal).map((v) => v.id).sort().join();
verifier("les voyages principaux sont tracés, les autres non", dessines().sort().join() === principaux, dessines().join());
verifier("aucun tracé invalide", !/NaN|Infinity|undefined/.test(un(".xpl__traces").innerHTML));
verifier("la frise est visible, avec une barre par voyage", !un(".xpl__frise").hidden && tous(".xpl__frise-barre").length === D.voyages.length, tous(".xpl__frise-barre").length);
verifier("les onglets sont cachés", un(".xpl__onglets").hidden);
verifier("le panneau présente la vue d'ensemble", /Vue d'ensemble/.test(vue().textContent) && vue().textContent.includes(D.textes.titre));
verifier("le curseur est au bout du temps", Number(curseur.value) >= Math.round(D.fin) - 1);
verifier("noms des océans et des continents posés sur la carte", tous(".xpl__toponyme").length >= 5, tous(".xpl__toponyme").length);
const dias = voyage("dias");
temps(dias.escales[2].t + 3);
verifier("en 1488, seul le voyage de Dias est tracé", dessines().join() === "dias", dessines().join());
verifier("un navire en tête du voyage en cours", tous(".xpl__navire").length === 1);
temps(dias.escales[dias.escales.length - 1].t - 5);
verifier("la vue d'ensemble ne trace que l'aller", tous(".xpl__trace--retour").every((p) => (p.getAttribute("d") || "") === "") && tous(".xpl__navire").length === 0);
temps(D.fin);
verifier("au bout du temps, plus aucun navire", tous(".xpl__navire").length === 0);

console.log("UN EXPLORATEUR");
const vbMonde = viewBox();
clic(puce("gama"));
verifier("la puce de Gama est pressée", puce("gama").getAttribute("aria-pressed") === "true");
verifier("la carte se resserre sur son voyage", viewBox()[2] < vbMonde[2] * 0.75, viewBox().join(" "));
verifier("la fiche nomme l'explorateur et son royaume", /Vasco de Gama/.test(vue().textContent) && /Au service du Portugal/.test(vue().textContent));
verifier("la fiche garde l'origine et le financement", /Origine/.test(vue().textContent) && /Financement/.test(vue().textContent));
verifier("la fiche garde tous les textes d'origine", D.explorateurs.find((e) => e.id === "gama").texte.every((t) => vue().textContent.includes(t.slice(0, 40))));
verifier("le savais-tu de la fiche de notes", /Le savais-tu\?/.test(vue().textContent));
verifier("les onglets apparaissent, la fiche est ouverte", !un(".xpl__onglets").hidden && un("#xpl-onglet-fiche").getAttribute("aria-selected") === "true");
verifier("la frise se cache", un(".xpl__frise").hidden);
verifier("seuls les voyages de Gama sont tracés", dessines().every((id) => voyage(id).exp === "gama") && dessines().length >= 1, dessines().join());
const gama = voyage(D.explorateurs.find((e) => e.id === "gama").principal);
clic(un("#xpl-onglet-voyage"));
verifier("l'onglet du voyage liste ses escales", tous(".xpl__escale-bouton").length === gama.escales.length, tous(".xpl__escale-bouton").length);
verifier("le retour est séparé de l'aller", !gama.escales.some((e) => e.retour) || /Le retour/.test(vue().textContent));
clic(tous(".xpl__escale-bouton")[2]);
verifier("l'escale choisie est marquée", tous(".xpl__escale-bouton")[2].getAttribute("aria-current") === "true");
verifier("le curseur va à la date de l'escale", Math.abs(Number(curseur.value) - gama.escales[2].t) <= 1, curseur.value + " / " + gama.escales[2].t);
verifier("la légende du temps nomme l'escale", evenement().includes(gama.escales[2].court || gama.escales[2].nom), evenement());
verifier("une pastille active sur la carte", tous(".xpl__escale.est-active").length === 1);
verifier("le pilote indique l'escale", /Escale 3 \/ /.test(un(".xpl__pilote").textContent), un(".xpl__pilote").textContent);
clic(bouton("Suivante", un(".xpl__pilote")));
verifier("Suivante passe à l'escale d'après", tous(".xpl__escale-bouton")[3].getAttribute("aria-current") === "true");
clic(bouton("Précédente", un(".xpl__pilote")));
verifier("Précédente revient", tous(".xpl__escale-bouton")[2].getAttribute("aria-current") === "true");
temps(gama.escales[1].t + 1);
verifier("glisser le temps change l'escale active", tous(".xpl__escale-bouton")[1].getAttribute("aria-current") === "true");
touche(un("#xpl-onglet-voyage"), "ArrowLeft");
verifier("les flèches passent d'un onglet à l'autre", un("#xpl-onglet-fiche").getAttribute("aria-selected") === "true");

console.log("PLUSIEURS VOYAGES");
clic(puce("colomb"));
const colomb = D.explorateurs.find((e) => e.id === "colomb");
clic(un("#xpl-onglet-voyage"));
verifier("Colomb : un bouton par voyage", tous(".xpl__voyage-puce").length === colomb.voyages.length, tous(".xpl__voyage-puce").length);
verifier("l'onglet s'appelle « Ses voyages »", un("#xpl-onglet-voyage").textContent === "Ses voyages");
const avant = tous(".xpl__escale-lieu").map((n) => n.textContent).join("|");
clic(tous(".xpl__voyage-puce")[1]);
verifier("changer de voyage change les escales", tous(".xpl__escale-lieu").map((n) => n.textContent).join("|") !== avant && tous(".xpl__voyage-puce")[1].getAttribute("aria-pressed") === "true");
verifier("le voyage choisi est en trait plein, les autres plus pâles", groupe(colomb.voyages[1]).getAttribute("class") === "xpl__voyage" && /est-autre/.test(groupe(colomb.voyages[0]).getAttribute("class")));
clic(un(".xpl__cible[data-v=\"" + colomb.voyages[2] + "\"]"));
verifier("cliquer sur un autre trajet de Colomb ouvre ce voyage", tous(".xpl__voyage-puce")[2].getAttribute("aria-pressed") === "true");
touche(un(".xpl__vue"), "Escape");
verifier("Échap ramène à la vue d'ensemble", un(".xpl__puce--outil").getAttribute("aria-pressed") === "true" && un(".xpl__onglets").hidden);
clic(un(".xpl__frise-barre"));
verifier("une barre de la frise ouvre le voyage", puce("dias").getAttribute("aria-pressed") === "true");
clic(un(".xpl__puce--outil"));

console.log("PARCOURS GUIDÉ");
let pas = 0, textes = [];
clic(bouton("Commencer", un(".xpl__pilote")));
verifier("Commencer ouvre la fiche de Dias", puce("dias").getAttribute("aria-pressed") === "true" && /Bartolomeu Dias/.test(vue().textContent));
const attendu = D.explorateurs.reduce((s, e) => s + 1 + e.voyages.reduce((t, id) => t + voyage(id).escales.length, 0), 0);
while (pas < 400) {
  textes.push(texteVisible(vue()));
  const p = un(".xpl__pilote"), dernier = p.querySelectorAll("button")[1];
  if (dernier.textContent === "Relever le défi") break;
  clic(dernier);
  pas++;
}
verifier("le parcours passe par chaque fiche et chaque escale", pas + 1 === attendu, (pas + 1) + " / " + attendu);
verifier("le parcours finit sur le défi", bouton("Relever le défi", un(".xpl__pilote")) !== undefined);
verifier("aucun tracé invalide pendant le parcours", !/NaN|Infinity|undefined/.test(un(".xpl__traces").innerHTML + un(".xpl__escales-carte").innerHTML));

console.log("DÉFI");
clic(bouton("Relever le défi", un(".xpl__pilote")));
verifier("le défi pose un indice et propose sept noms", /Qui suis-je\?/.test(vue().textContent) && tous(".xpl__reponses button").length === 7);
const visibles = () => tous(".xpl__voyage").filter((g) => g.style.display !== "none");
verifier("la carte montre un seul trajet, sans couleur", visibles().length === 1 && visibles()[0].getAttribute("data-exp") === "mystere");
verifier("le temps est caché pendant le défi", un(".xpl__temps").hidden);
verifier("Question suivante attend une réponse", bouton("Question suivante", un(".xpl__pilote")).disabled);
let justes = 0;
for (let q = 0; q < 7; q++) {
  const idMystere = D.voyages.find((v) => v.id === visibles()[0].getAttribute("data-v")).exp;
  const bonne = un(`.xpl__reponses button[data-exp="${idMystere}"]`);
  clic(bonne);
  if (/^Juste/.test(un(".xpl__verdict").textContent)) justes++;
  if (q === 0) {
    verifier("après la réponse, le trajet prend sa couleur", visibles()[0].getAttribute("data-exp") === idMystere);
    verifier("après la réponse, le nom du trajet apparaît", tous(".xpl__etiquette").length === 1);
  }
  clic(un(".xpl__pilote").querySelectorAll("button")[1]);
}
verifier("sept bonnes réponses reconnues", justes === 7, justes);
verifier("le bilan affiche 7 sur 7", /7 sur 7/.test(vue().textContent));
clic(bouton("Recommencer", un(".xpl__pilote")));
clic(tous(".xpl__reponses button").find((b) => b.getAttribute("data-exp") !== D.voyages.find((v) => v.id === visibles()[0].getAttribute("data-v")).exp));
verifier("une mauvaise réponse donne la bonne", /^Non, c'était /.test(un(".xpl__verdict").textContent) && tous(".est-juste").length === 1 && tous(".est-faux").length === 1);

console.log("RÉINITIALISER ET PLEIN ÉCRAN");
racine.dispatchEvent(new window.CustomEvent("reinitialiser"));
verifier("Réinitialiser revient à la vue d'ensemble", un(".xpl__puce--outil").getAttribute("aria-pressed") === "true" && !un(".xpl__frise").hidden);
verifier("Réinitialiser remet le temps au bout", Number(curseur.value) >= Math.round(D.fin) - 1);
racine.classList.add("est-plein-ecran");
clic(un(".xpl__replier"));
verifier("Masquer le texte en plein écran", racine.classList.contains("texte-masque") && un(".xpl__replier").textContent === "Afficher le texte");
racine.classList.remove("est-plein-ecran");
setTimeout(() => {
  verifier("quitter le plein écran réaffiche le texte", !racine.classList.contains("texte-masque"));

  console.log("TYPOGRAPHIE");
  ORDRE.forEach((id) => { clic(puce(id)); textes.push(texteVisible(vue())); clic(un("#xpl-onglet-voyage")); textes.push(texteVisible(vue())); });
  clic(un(".xpl__puce--outil")); textes.push(texteVisible(vue()));
  const ensemble = textes.join(" ") + " " + texteVisible(un(".xpl__source"));
  const fautes = [];
  if (/[–—]/.test(ensemble)) fautes.push("tiret long ou demi-long");
  if (/, et /.test(ensemble)) fautes.push("« , et »");
  if (/[  ][;!?]/.test(ensemble)) fautes.push("espace avant ; ! ?");
  if (/[^ ]:(?!\/)/.test(ensemble.replace(/https?:\/\//g, ""))) fautes.push("deux-points sans insécable : " + (ensemble.match(/.{20}[^ ]:.{10}/) || [""])[0]);
  if (/«[^ ]/.test(ensemble) || /[^ ]»/.test(ensemble)) fautes.push("guillemets sans insécable");
  if (/\d \d{3}\b/.test(ensemble)) fautes.push("nombre sans insécable");
  verifier("typographie québécoise respectée partout", fautes.length === 0, fautes.join(" | "));

  console.log("SANS ANIMATION");
  const r = monter(true);
  const b = r.racine.querySelector(".xpl__lire");
  r.racine.querySelector('.xpl__puce[data-exp="cartier"]').dispatchEvent(new r.window.MouseEvent("click", { bubbles: true }));
  b.dispatchEvent(new r.window.MouseEvent("click", { bubbles: true }));
  verifier("la lecture démarre au départ du voyage", /Mettre en pause/.test(b.getAttribute("aria-label")) && r.racine.querySelector(".xpl__escale-bouton[aria-current='true']") !== null);
  b.dispatchEvent(new r.window.MouseEvent("click", { bubbles: true }));
  verifier("la lecture s'arrête", /Suivre le voyage/.test(b.getAttribute("aria-label")));

  console.log("FICHE 08 CONSTRUITE");
  const fiche = path.join(RACINE, "docs", "histoire", "08-expansion-europeenne.html");
  if (fs.existsSync(fiche) && !process.env.TEST_COMPOSANT) {
    const h = fs.readFileSync(fiche, "utf8");
    verifier("la fiche construite contient le composant une fois", (h.match(/id="explorateurs"/g) || []).length === 1);
    const ids = (h.match(/\sid="([^"]+)"/g) || []).map((s) => s.trim().slice(4, -1));
    const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
    verifier("aucun identifiant en double dans la fiche", doublons.length === 0, doublons.join());
  }
  console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
  process.exit(echecs ? 1 : 0);
}, 50);
