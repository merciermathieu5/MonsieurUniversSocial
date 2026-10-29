/*
 * Test de la carte des villes de l'OVPM (fiche de géographie 03) dans un DOM simulé.
 *     node outils/test_ovpm_carte.js [composant.html]
 * On vérifie le choix d'une ville, la désélection par un second clic (avec retour à la vue
 * d'avant), le bouton Réinitialiser ajouté par page.js et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "ovpm-carte.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><section class="texte">${composant}</section></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("ovpm-carte");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const ville = (c) => un(`.ovm__ville[data-ville="${c}"]`), point = (c, carte) => un(`.ovm__svg[data-carte="${carte}"] .ovm__point[data-ville="${c}"]`);
const visible = () => tous(".ovm__panneau.est-visible").map((p) => p.getAttribute("data-ville"));
const vue = () => un(".ovm__vue[aria-pressed=\"true\"]").getAttribute("data-vue");
const presses = () => tous(".ovm__ville[aria-pressed=\"true\"]").map((b) => b.getAttribute("data-ville"));
const etatDepart = () => JSON.stringify({ v: visible(), vue: vue(), p: presses(), c: tous(".ovm__point.est-choisi").map((g) => g.getAttribute("data-ville")) });

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
const depart = etatDepart();
verifier("au départ : Québec choisie, carte du monde", visible().join() === "quebec" && vue() === "monde" && presses().join() === "quebec");
verifier("data-reinitialiser sur la racine", racine.hasAttribute("data-reinitialiser"));
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".ovm__entete .reinitialiser") && un(".ovm__entete .reinitialiser").nextElementSibling === un(".ovm__entete .plein-ecran"));

console.log("CHOIX ET DÉSÉLECTION");
clic(ville("quebec"));
verifier("un second clic sur la ville choisie la désélectionne (accueil, aucun bouton enfoncé, aucun halo)", visible().join() === "" && presses().length === 0 && !un(".ovm__point.est-choisi"));
verifier("le panneau d'accueil invite à choisir une ville", /Choisis une ville/.test(un(".ovm__panneau--accueil").textContent));
clic(ville("cordoue"));
verifier("choisir Cordoue dans la liste ouvre la carte de l'Europe", visible().join() === "cordoue" && vue() === "europe" && presses().join() === "cordoue");
clic(point("varsovie", "europe"));
verifier("un clic sur un point de la carte choisit la ville", visible().join() === "varsovie" && presses().join() === "varsovie");
clic(point("varsovie", "europe"));
verifier("un second clic sur le point désélectionne et ramène la vue d'avant la sélection (le monde)", visible().join() === "" && vue() === "monde" && presses().length === 0);
clic(ville("kotor"));
clic(un('.ovm__vue[data-vue="monde"]'));
clic(ville("kotor"));
verifier("après un changement de vue manuel, la désélection garde la vue choisie", visible().join() === "" && vue() === "monde");

console.log("RÉINITIALISATION");
clic(ville("bakou"));
clic(un(".ovm__replier"));
clic(un(".ovm__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());
verifier("Réinitialiser garde le texte masqué", racine.classList.contains("texte-masque"));
clic(un(".ovm__replier"));
clic(ville("quebec"));
clic(un(".ovm__entete .reinitialiser"));
verifier("Réinitialiser après une désélection ramène aussi Québec", etatDepart() === depart);

console.log("TYPOGRAPHIE");
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
const t = copie.textContent;
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[  ][;!?]/.test(t));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
