/*
 * Test du comparateur Tenochtitlan 1518 / Mexico aujourd'hui dans un DOM simulé.
 *     node outils/test_tenochtitlan.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi qu'il ne gêne pas les raccourcis de la page.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "tenochtitlan-mexico.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les peuples autochtones</h2>
${composant}
<h2>Des activités pour t'exercer</h2><p>Suite.</p>
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
const racine = document.getElementById("tenochtitlan-mexico");
const $ = (cle) => racine.querySelector(`[data-tnm="${cle}"]`);
const scene = $("scene"), avant = $("avant"), apres = $("apres"), curseur = $("curseur");
const boutons = () => Array.from(racine.querySelectorAll(".tnm__vue"));
const enfonces = () => boutons().filter((b) => b.getAttribute("aria-pressed") === "true");
const position = () => scene.style.getPropertyValue("--tnm-pos");
const nom = (img) => path.basename(img.getAttribute("src"));
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function regler(v) {
  curseur.value = String(v);
  curseur.dispatchEvent(new window.Event("input", { bubbles: true }));
}
// jsdom ne connaît pas PointerEvent : un MouseEvent du même nom suffit aux écouteurs.
function pointeur(type, x, genre) {
  const e = new window.MouseEvent(type, { bubbles: true, clientX: x, button: 0 });
  Object.defineProperty(e, "pointerType", { value: genre || "mouse" });
  Object.defineProperty(e, "pointerId", { value: 1 });
  scene.dispatchEvent(e);
}
scene.getBoundingClientRect = () => ({ left: 100, top: 0, width: 400, height: 200, right: 500, bottom: 200 });

console.log("MISE EN PLACE");
verifier("composant initialisé une seule fois", racine.dataset.pret === "1" && boutons().length === 4, boutons().length);
verifier("quatre points de vue nommés", boutons().map((b) => b.textContent).join(" | ") === "Vers le nord | Vers l'ouest | Toute l'île | Du Cerro de la Estrella");
verifier("la première vue est choisie", enfonces().length === 1 && enfonces()[0] === boutons()[0]);
verifier("images de la vue vers le nord", nom(avant) === "tenochtitlan-nord-1518.jpg" && nom(apres) === "tenochtitlan-nord-aujourdhui.jpg");
verifier("séparation au milieu", position() === "50%" && curseur.value === "50", position());
verifier("1518 à gauche, aujourd'hui à droite",
  $("repere-avant").textContent === "1518" && $("repere-avant").classList.contains("tnm__repere--avant")
  && $("repere-apres").textContent === "Aujourd'hui");
verifier("c'est l'image de 1518 qu'on découpe", avant.classList.contains("tnm__image--avant") && composant.includes(".tnm__image--avant { clip-path"));
verifier("crédit de chaque image tiré du registre",
  composant.includes("{{credit:tenochtitlan-nord-1518.jpg}}") && composant.includes("{{credit:tenochtitlan-nord-aujourdhui.jpg}}"));
verifier("images chargées à la demande", avant.getAttribute("loading") === "lazy" && apres.getAttribute("loading") === "lazy");
const ids = Array.from(document.querySelectorAll("[id]")).map((n) => n.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);

console.log("CURSEUR AU CLAVIER");
regler(30);
verifier("la valeur du curseur déplace la séparation", position() === "30%", position());
verifier("le partage est dit au lecteur d'écran", curseur.getAttribute("aria-valuetext") === "1518 sur 30 % de l'image, aujourd'hui sur 70 %", curseur.getAttribute("aria-valuetext"));
regler(5);
verifier("l'étiquette 1518 s'efface quand il n'en reste presque rien", scene.classList.contains("est-a-gauche") && !scene.classList.contains("est-a-droite"));
regler(95);
verifier("l'étiquette d'aujourd'hui s'efface de même", scene.classList.contains("est-a-droite") && !scene.classList.contains("est-a-gauche"));
regler(50);
verifier("au milieu, les deux étiquettes sont là", !scene.classList.contains("est-a-droite") && !scene.classList.contains("est-a-gauche"));

console.log("SOURIS ET DOIGT");
pointeur("pointerdown", 200);
verifier("un clic place la séparation sous le pointeur", position() === "25%", position());
verifier("le curseur suit", curseur.value === "25", curseur.value);
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
pointeur("pointerdown", 300, "touch");
pointeur("pointerup", 300, "touch");
verifier("au doigt, toucher l'image y place la séparation", position() === "50%", position());
const droit = new window.MouseEvent("pointerdown", { bubbles: true, clientX: 150, button: 2 });
Object.defineProperty(droit, "pointerType", { value: "mouse" });
scene.dispatchEvent(droit);
verifier("le clic droit ne déplace rien", position() === "50%", position());

console.log("POINTS DE VUE");
regler(80);
clic(boutons()[2]);
verifier("changer de vue change les deux images", nom(avant) === "tenochtitlan-ile-1518.jpg" && nom(apres) === "tenochtitlan-ile-aujourdhui.jpg");
verifier("un seul bouton enfoncé", enfonces().length === 1 && enfonces()[0] === boutons()[2]);
verifier("la légende suit la vue", $("legende").textContent === "Une vue d'ensemble de l'île", $("legende").textContent);
verifier("la séparation revient au milieu", position() === "50%" && curseur.value === "50");
clic(boutons()[3]);
verifier("le cadre prend les proportions de la vue", scene.style.getPropertyValue("--tnm-ratio") === "1920 / 984", scene.style.getPropertyValue("--tnm-ratio"));
verifier("textes de remplacement à jour",
  avant.alt === "Reconstitution de Tenochtitlan en 1518, vue depuis le Cerro de la Estrella"
  && apres.alt === "Photographie aérienne de Mexico aujourd'hui, vue depuis le Cerro de la Estrella", avant.alt);
const avantSrc = avant.getAttribute("src");
clic(boutons()[3]);
verifier("rechoisir la même vue ne recharge pas les images", avant.getAttribute("src") === avantSrc);
const manquantes = [];
boutons().forEach((b) => {
  clic(b);
  [avant, apres].forEach((img) => {
    if (!fs.existsSync(path.join(RACINE, "medias", "08-expansion-europeenne", nom(img)))) manquantes.push(nom(img));
  });
});
verifier("les huit images sont dans medias/08-expansion-europeenne", manquantes.length === 0, manquantes.join(", "));

console.log("IMAGE ABSENTE");
clic(boutons()[1]);
avant.dispatchEvent(new window.Event("error"));
verifier("une image manquante affiche le repli", scene.classList.contains("est-absent"));
pointeur("pointerdown", 150);
verifier("le repli ne réagit pas au pointeur", position() === "50%", position());
pointeur("pointerup", 150);
clic(boutons()[0]);
verifier("changer de vue retire le repli", !scene.classList.contains("est-absent"));

console.log("CLAVIER ET PAGE");
let vu = false;
document.addEventListener("keydown", () => { vu = true; });
boutons()[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
verifier("Espace sur un bouton ne remonte pas au diaporama", vu === false);
boutons()[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
verifier("Entrée non plus", vu === false);
boutons()[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
verifier("les flèches restent au diaporama", vu === true);
vu = false;
document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
verifier("Espace ailleurs remonte normalement", vu === true);

console.log("RÉINITIALISATION");
verifier("data-reinitialiser sur la racine et bouton Réinitialiser ajouté par page.js avant Plein écran",
  racine.hasAttribute("data-reinitialiser") && !!racine.querySelector(".tnm__entete .reinitialiser") && racine.querySelector(".tnm__entete .reinitialiser").nextElementSibling === racine.querySelector(".tnm__entete .plein-ecran"));
scene.classList.remove("est-absent");
clic(boutons()[2]);
regler(17);
clic(racine.querySelector(".tnm__entete .reinitialiser"));
verifier("Réinitialiser revient au premier point de vue, séparation au milieu",
  enfonces().length === 1 && enfonces()[0] === boutons()[0] && curseur.value === "50" && position() === "50%" && /nord-1518/.test(nom(avant)), curseur.value + " " + position() + " " + nom(avant));

console.log("DONNÉES");
verifier("aucun tiret cadratin ni demi-cadratin", !/[–—]/.test(composant));
verifier("aucun titre de niveau 2 ou 3", !/<h[23][ >]/.test(composant));
verifier("aucune liste à puces", !/<[uo]l[ >]/.test(composant));
verifier("variante pour le thème sombre", composant.includes('html[data-sombre="on"] .tnm .tnm__entete'));

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est vert.");
process.exit(echecs ? 1 : 0);
