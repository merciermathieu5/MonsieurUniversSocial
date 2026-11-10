/*
 * Test du comparateur « Conserver, restaurer, reconstituer : avant et après »
 * dans un DOM simulé.
 *     node outils/test_patrimoine_avant_apres.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi qu'il ne gêne pas les raccourcis de la page.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "patrimoine-avant-apres.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="geographie"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Conserver, restaurer, reconstituer</h2>
${composant}
<h2>Entre continuité et changement</h2><p>Suite.</p>
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const NBSP = "\u00a0";
const racine = document.getElementById("patrimoine-avant-apres");
const $ = (cle) => racine.querySelector(`[data-pav="${cle}"]`);
const scene = $("scene"), avant = $("avant"), apres = $("apres"), curseur = $("curseur");
const boutons = () => Array.from(racine.querySelectorAll(".pav__vue"));
const choix = () => Array.from(racine.querySelectorAll(".pav__choix"));
const unChoix = (cle) => racine.querySelector(`.pav__choix[data-choix="${cle}"]`);
const enfonces = (liste) => liste.filter((b) => b.getAttribute("aria-pressed") === "true");
const position = () => scene.style.getPropertyValue("--pav-pos");
const nom = (img) => path.basename(img.getAttribute("src"));
const creditsVisibles = () => Array.from(racine.querySelectorAll(".pav__credits")).filter((c) => !c.hidden).map((c) => c.getAttribute("data-credits"));
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function touche(el, key) { el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })); }
function regler(v) {
  curseur.value = String(v);
  curseur.dispatchEvent(new window.Event("input", { bubbles: true }));
}
// jsdom ne connaît pas PointerEvent : un MouseEvent du même nom suffit aux écouteurs.
function pointeur(type, x, genre, bouton) {
  const e = new window.MouseEvent(type, { bubbles: true, clientX: x, button: bouton || 0 });
  Object.defineProperty(e, "pointerType", { value: genre || "mouse" });
  Object.defineProperty(e, "pointerId", { value: 1 });
  scene.dispatchEvent(e);
}
scene.getBoundingClientRect = () => ({ left: 100, top: 0, width: 400, height: 300, right: 500, bottom: 300 });

console.log("MISE EN PLACE");
verifier("composant initialisé une seule fois", racine.dataset.pret === "1" && boutons().length === 4, boutons().length);
verifier("quatre lieux nommés", boutons().map((b) => b.textContent).join(" | ") === "Porte Kent | Maison des Jésuites | Place Royale | Porte Prescott",
  boutons().map((b) => b.textContent).join(" | "));
verifier("le premier lieu est choisi", enfonces(boutons()).length === 1 && enfonces(boutons())[0] === boutons()[0]);
verifier("images de la porte Kent", nom(avant) === "porte-kent-1890.jpg" && nom(apres) === "porte-kent-2010.jpg");
verifier("séparation au milieu", position() === "50%" && curseur.value === "50", position());
verifier("la date ancienne à gauche, la récente à droite",
  $("repere-avant").textContent === "Vers 1890" && $("repere-avant").classList.contains("pav__repere--avant")
  && $("repere-apres").textContent === "2010");
verifier("c'est l'image ancienne qu'on découpe", avant.classList.contains("pav__image--avant") && composant.includes(".pav__image--avant { clip-path"));
verifier("seuls les crédits de la porte Kent sont montrés", creditsVisibles().join() === "kent", creditsVisibles().join());
const fichiers = ["porte-kent-1890", "porte-kent-2010", "jesuites-1924", "jesuites-2019", "place-royale-1900", "place-royale-2011", "porte-prescott-1860", "porte-prescott-2016"];
verifier("crédit de chaque image tiré du registre", fichiers.every((f) => composant.includes(`{{credit:${f}.jpg}}`)));
const registre = fs.readFileSync(path.join(RACINE, "medias", "sources.yml"), "utf8");
verifier("chaque image est inscrite au registre avec sa licence et son fichier Commons",
  fichiers.every((f) => new RegExp(`^${f}\\.jpg:\\n(  .*\\n)*?  commons: .+\\n(  .*\\n)*?  licence: \\S`, "m").test(registre)));
verifier("images chargées à la demande", avant.getAttribute("loading") === "lazy" && apres.getAttribute("loading") === "lazy");
verifier("aucun verdict au départ", enfonces(choix()).length === 0 && $("retour").textContent === "");
verifier("bilan à zéro", $("bilan").textContent === `Verdicts donnés${NBSP}: 0 sur 4`, $("bilan").textContent);
verifier("sources au pied du composant", !!racine.querySelector(".pav__pied .pav__sources li a[href*='erudit']"));
const ids = Array.from(document.querySelectorAll("[id]")).map((n) => n.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);

console.log("CURSEUR AU CLAVIER");
regler(30);
verifier("la valeur du curseur déplace la séparation", position() === "30%", position());
verifier("le partage est dit au lecteur d'écran", curseur.getAttribute("aria-valuetext") === `Vers 1890 sur 30${NBSP}% de l'image, 2010 sur 70${NBSP}%`, curseur.getAttribute("aria-valuetext"));
regler(5);
verifier("l'étiquette ancienne s'efface quand il n'en reste presque rien", scene.classList.contains("est-a-gauche") && !scene.classList.contains("est-a-droite"));
regler(95);
verifier("l'étiquette récente s'efface de même", scene.classList.contains("est-a-droite") && !scene.classList.contains("est-a-gauche"));
regler(50);
verifier("au milieu, les deux étiquettes sont là", !scene.classList.contains("est-a-droite") && !scene.classList.contains("est-a-gauche"));

console.log("SOURIS ET DOIGT");
pointeur("pointerdown", 200);
verifier("un clic place la séparation sous le pointeur", position() === "25%", position());
pointeur("pointermove", 300);
verifier("glisser la déplace", position() === "50%", position());
pointeur("pointermove", 9999);
verifier("elle reste dans le cadre", position() === "100%", position());
pointeur("pointerup", 9999);
pointeur("pointermove", 150);
verifier("relâcher arrête le glissement", position() === "100%", position());
pointeur("pointerdown", 400, "touch");
verifier("au doigt, un simple contact ne déplace rien tout de suite", position() === "100%", position());
pointeur("pointercancel", 400, "touch");
pointeur("pointermove", 200, "touch");
verifier("un défilement de la page annule le glissement", position() === "100%", position());
pointeur("pointerdown", 400, "touch");
pointeur("pointermove", 380, "touch");
verifier("au doigt, glisser déplace la séparation", position() === "70%", position());
pointeur("pointerup", 380, "touch");
pointeur("pointerdown", 150, "mouse", 2);
verifier("le clic droit ne déplace rien", position() === "70%", position());

console.log("LIEUX");
clic(boutons()[1]);
verifier("changer de lieu change les deux images", nom(avant) === "jesuites-1924.jpg" && nom(apres) === "jesuites-2019.jpg");
verifier("un seul lieu enfoncé", enfonces(boutons()).length === 1 && enfonces(boutons())[0] === boutons()[1]);
verifier("la légende et le lieu suivent", /Sillery/.test($("legende").textContent) && /Sillery/.test($("lieu").textContent));
verifier("les dates suivent", $("repere-avant").textContent === "1924" && $("repere-apres").textContent === "2019");
verifier("les crédits suivent", creditsVisibles().join() === "jesuites", creditsVisibles().join());
verifier("la séparation revient au milieu", position() === "50%" && curseur.value === "50");
clic(boutons()[2]);
verifier("le cadre prend les proportions de la paire", scene.style.getPropertyValue("--pav-ratio") === "720 / 1107", scene.style.getPropertyValue("--pav-ratio"));
verifier("textes de remplacement à jour", /vers 1900/.test(avant.alt) && /2011/.test(apres.alt), avant.alt);
clic(boutons()[3]);
verifier("la porte Prescott prévient que les vues diffèrent", /pas prises du même endroit/.test($("note").textContent));
clic(boutons()[0]);
verifier("les autres lieux n'ont pas cette note", $("note").textContent === "");
const manquantes = [];
boutons().forEach((b) => {
  clic(b);
  [avant, apres].forEach((img) => {
    if (!fs.existsSync(path.join(RACINE, "medias", "03-ville-patrimoniale", nom(img)))) manquantes.push(nom(img));
  });
});
verifier("les huit images sont dans medias/03-ville-patrimoniale", manquantes.length === 0, manquantes.join(", "));

console.log("VERDICTS");
clic(boutons()[0]);
clic(unChoix("conserver"));
verifier("choisir un verdict l'enfonce", enfonces(choix()).length === 1 && enfonces(choix())[0] === unChoix("conserver"));
verifier("la porte Kent : conserver est juste", $("retour").classList.contains("est-juste") && /^Oui\./.test($("retour").textContent), $("retour").className);
verifier("le bilan compte le verdict", $("bilan").textContent === `Verdicts donnés${NBSP}: 1 sur 4`);
verifier("le lieu tranché est marqué", boutons()[0].classList.contains("est-tranche"));
clic(unChoix("reconstituer"));
verifier("changer d'avis remplace le verdict", enfonces(choix()).length === 1 && $("retour").classList.contains("est-faux"));
clic(unChoix("reconstituer"));
verifier("un deuxième clic retire le verdict", enfonces(choix()).length === 0 && $("retour").textContent === "" && !boutons()[0].classList.contains("est-tranche"));
clic(unChoix("restaurer"));
touche(unChoix("restaurer"), "Escape");
verifier("Échap retire le verdict", enfonces(choix()).length === 0 && $("retour").textContent === "");
clic(boutons()[1]);
clic(unChoix("restaurer"));
verifier("la maison des Jésuites : restaurer est juste", $("retour").classList.contains("est-juste"));
clic(boutons()[2]);
verifier("le verdict est propre à chaque lieu", enfonces(choix()).length === 0);
clic(unChoix("reconstituer"));
verifier("la place Royale : reconstituer est juste en partie", $("retour").classList.contains("est-juste") && /en partie/.test($("retour").textContent));
clic(boutons()[3]);
clic(unChoix("reconstituer"));
verifier("la porte Prescott : reconstituer est discutable", $("retour").classList.contains("est-debat") && /discutable/.test($("retour").textContent));
clic(boutons()[1]);
verifier("revenir à un lieu retrouve son verdict", enfonces(choix())[0] === unChoix("restaurer"));
verifier("trois verdicts comptés", $("bilan").textContent === `Verdicts donnés${NBSP}: 3 sur 4`, $("bilan").textContent);
let retoursComplets = true;
boutons().forEach((b) => {
  clic(b);
  ["conserver", "restaurer", "reconstituer"].forEach((c) => {
    const avantClic = unChoix(c).getAttribute("aria-pressed") === "true";
    if (!avantClic) clic(unChoix(c));
    if (!$("retour").textContent || !/^est-(juste|faux|debat)$/.test(Array.from($("retour").classList).find((k) => k.startsWith("est-")) || "")) retoursComplets = false;
  });
});
verifier("chaque lieu a un retour pour chacun des trois verdicts", retoursComplets);
verifier("quatre verdicts comptés", $("bilan").textContent === `Verdicts donnés${NBSP}: 4 sur 4`, $("bilan").textContent);

console.log("IMAGE ABSENTE");
clic(boutons()[1]);
avant.dispatchEvent(new window.Event("error"));
verifier("une image manquante affiche le repli", scene.classList.contains("est-absent"));
pointeur("pointerdown", 150);
verifier("le repli ne réagit pas au pointeur", position() === "50%", position());
pointeur("pointerup", 150);
clic(boutons()[0]);
verifier("changer de lieu retire le repli", !scene.classList.contains("est-absent"));

console.log("TEXTE MASQUÉ");
clic($("replier"));
verifier("le bouton masque le texte", racine.classList.contains("texte-masque") && $("replier").getAttribute("aria-expanded") === "false");
clic($("replier"));
verifier("et le réaffiche", !racine.classList.contains("texte-masque") && $("replier").textContent === "Masquer le texte");
verifier("le texte replié comprend le panneau et le pied", !!racine.querySelector(".pav__panneau.pav__repliable") && !!racine.querySelector(".pav__pied.pav__repliable"));

console.log("CLAVIER ET PAGE");
let vu = false;
document.addEventListener("keydown", () => { vu = true; });
touche(boutons()[1], " ");
verifier("Espace sur un bouton ne remonte pas au diaporama", vu === false);
touche(boutons()[1], "Enter");
verifier("Entrée non plus", vu === false);
touche(boutons()[1], "ArrowRight");
verifier("les flèches restent au diaporama", vu === true);
vu = false;
clic(boutons()[2]);
clic(unChoix("conserver"));
clic(unChoix("conserver"));
touche(unChoix("conserver"), "Escape");
verifier("Échap sans verdict remonte normalement", vu === true);

console.log("RÉINITIALISATION");
const entete = racine.querySelector(".pav__entete");
verifier("data-reinitialiser sur la racine et bouton Réinitialiser ajouté par page.js avant Plein écran",
  racine.hasAttribute("data-reinitialiser") && !!entete.querySelector(".reinitialiser") && entete.querySelector(".reinitialiser").nextElementSibling === entete.querySelector(".plein-ecran"));
scene.classList.remove("est-absent");
clic(boutons()[2]);
regler(17);
clic(entete.querySelector(".reinitialiser"));
verifier("Réinitialiser revient au premier lieu, séparation au milieu",
  enfonces(boutons()).length === 1 && enfonces(boutons())[0] === boutons()[0] && curseur.value === "50" && position() === "50%" && nom(avant) === "porte-kent-1890.jpg");
verifier("Réinitialiser efface tous les verdicts", enfonces(choix()).length === 0 && $("bilan").textContent === `Verdicts donnés${NBSP}: 0 sur 4`
  && boutons().every((b) => !b.classList.contains("est-tranche")));

console.log("TYPOGRAPHIE");
const html_ = composant.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<script>[\s\S]*?<\/script>/, "")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, NBSP).replace(/&amp;/g, "&");
const chaines = (script.match(/"(?:[^"\\\n]|\\.)*"/g) || []).map((s) => s.slice(1, -1).replace(/\\u00a0/g, NBSP));
const textes = [html_].concat(chaines);
const fautif = (re) => textes.map((s) => (s.match(re) || [null])[0]).filter(Boolean);
verifier("aucun tiret cadratin ni demi-cadratin", !/[–—]/.test(composant));
const ESPACE_FAUTIVE = /.{0,15}\S [:»].{0,5}|« .{0,10}|.{0,15}\S[ \u00a0][;!?].{0,5}/;
verifier("insécable devant : et dans les guillemets, rien devant ; ! ?", fautif(ESPACE_FAUTIVE).length === 0, fautif(ESPACE_FAUTIVE).join(" | "));
verifier("aucune virgule devant et", fautif(/.{0,15}, et .{0,5}/).length === 0, fautif(/.{0,15}, et .{0,5}/).join(" | "));
verifier("aucune espace insécable brute dans le script", !/\u00a0/.test(script));
verifier("aucun titre de niveau 2 ou 3", !/<h[23][ >]/.test(composant));
verifier("variante pour le thème sombre", composant.includes('html[data-sombre="on"] .pav .pav__entete'));
verifier("mouvement réduit respecté", composant.includes("prefers-reduced-motion"));

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est vert.");
process.exit(echecs ? 1 : 0);
