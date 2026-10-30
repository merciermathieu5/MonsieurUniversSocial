/*
 * Test de la carte du territoire de la région métropolitaine (fiche de géographie 02) dans un DOM simulé.
 *     node outils/test_montreal_territoire.js [composant.html]
 * On vérifie les 82 municipalités et les cinq secteurs, le choix d'un secteur ou d'une ville,
 * la désélection (second clic, Échap), les couches, Réinitialiser (page.js) et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "montreal-territoire.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("montreal-territoire");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const ville = (id) => un(`.mtt__ville[data-ville="${id}"]`);
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".mtt__intertitre").textContent;
const etatDepart = () => JSON.stringify(racine.mtt.etat()) + "|" + tous(".mtt__couche").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("82 municipalités dessinées", tous(".mtt__ville").length === 82, tous(".mtt__ville").length);
const parSecteur = {};
tous(".mtt__ville").forEach((p) => { parSecteur[p.getAttribute("data-secteur")] = (parSecteur[p.getAttribute("data-secteur")] || 0) + 1; });
verifier("répartition 16 / 1 / 5 / 20 / 40", JSON.stringify(parSecteur) === JSON.stringify({ montreal: 16, laval: 1, longueuil: 5, nord: 20, sud: 40 }) || ["montreal", "laval", "longueuil", "nord", "sud"].map((k) => parSecteur[k]).join() === "16,1,5,20,40", JSON.stringify(parSecteur));
verifier("cours d'eau dessinés", tous(".mtt__eau-forme").length > 10);
verifier("au départ : aucun choix, fiche d'accueil avec les cinq secteurs", choix() === "" && /82 municipalités/.test(titre()) && tous(".mtt__vue .mtt__choisir").length === 5);
verifier("noms affichés d'emblée (secteurs, villes, cours d'eau)", !!un(".mtt__etiquette--secteur") && tous(".mtt__etiquette--ville").length >= 10 && !!un(".mtt__etiquette--eau"));
verifier("Montréal nommée sur la carte", tous(".mtt__etiquette--ville").some((t) => t.textContent === "Montréal"));
verifier("population totale 4 305 249", /4 305 249/.test(un(".mtt__vue").textContent));
verifier("data-reinitialiser sur la racine", racine.hasAttribute("data-reinitialiser"));
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".mtt__entete .reinitialiser") && un(".mtt__entete .reinitialiser").nextElementSibling === un(".mtt__entete .plein-ecran"));
const depart = etatDepart();

console.log("CHOIX ET DÉSÉLECTION");
clic(ville("terrebonne"));
verifier("un clic sur Terrebonne ouvre sa fiche", choix() === "ville:terrebonne" && titre() === "Terrebonne" && /126 199/.test(un(".mtt__vue").textContent));
verifier("la ville choisie est entourée", un(".mtt__choix").getAttribute("d") === ville("terrebonne").getAttribute("d"));
clic(ville("terrebonne"));
verifier("un second clic désélectionne (retour à l'accueil)", choix() === "" && /82 municipalités/.test(titre()) && un(".mtt__choix").getAttribute("d") === "");
clic(tous(".mtt__vue .mtt__choisir")[1]);
verifier("le bouton Laval de l'accueil ouvre la fiche du secteur", choix() === "secteur:laval" && /459 650/.test(un(".mtt__vue").textContent));
verifier("les autres secteurs sont estompés", tous(".mtt__ville.est-estompe").length === 81);
clic(tous(".mtt__vue .mtt__choisir")[0]);
verifier("depuis la fiche du secteur, on ouvre la ville de Laval", choix() === "ville:laval");
touche("Escape");
verifier("Échap désélectionne", choix() === "" && tous(".mtt__ville.est-estompe").length === 0);
const etiqSud = un('.mtt__etiquette--secteur[data-secteur="sud"]');
if (etiqSud) { clic(etiqSud); verifier("le nom d'un secteur sur la carte ouvre sa fiche", choix() === "secteur:sud" && /40/.test(un(".mtt__chiffres").textContent)); clic(un('.mtt__etiquette--secteur[data-secteur="sud"]')); verifier("un second clic sur le nom désélectionne", choix() === ""); }
else verifier("nom de la couronne sud présent", false);
clic(ville("brossard"));
clic(tous(".mtt__vue .mtt__retour")[0]);
verifier("le bouton Voir le secteur passe de la ville à son secteur", choix() === "secteur:longueuil");

console.log("COUCHES");
clic(un('.mtt__couche[data-couche="villes"]'));
verifier("masquer les villes : la ville devient son secteur, plus de noms de villes", !racine.classList.contains("avec-villes") && tous(".mtt__etiquette--ville").length === 0);
clic(ville("mirabel"));
verifier("sans les villes, un clic choisit le secteur", choix() === "secteur:nord");
clic(un('.mtt__couche[data-couche="ponts"]'));
verifier("la couche des ponts affiche 13 ponts", tous(".mtt__pont").length === 13);
clic(un('.mtt__couche[data-couche="eau"]'));
verifier("masquer les cours d'eau retire leurs noms", tous(".mtt__etiquette--eau").length === 0 && !racine.classList.contains("avec-eau"));
clic(un(".mtt__zoom-plus"));
verifier("le bouton + rapproche la carte", un(".mtt__svg").getAttribute("viewBox") !== "0 0 1000 892" && !un(".mtt__recentrer").hidden);

console.log("RÉINITIALISATION");
clic(un(".mtt__replier"));
clic(un(".mtt__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());
verifier("Réinitialiser garde le texte masqué", racine.classList.contains("texte-masque"));
verifier("Réinitialiser ramène la carte entière", un(".mtt__svg").getAttribute("viewBox") === "0 0 1000 892" && un(".mtt__recentrer").hidden);

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [];
const vu = new Set();
function parcourir() { textes.push(racine.querySelector(".mtt__lecture").textContent); }
parcourir();
["montreal", "laval", "longueuil", "nord", "sud"].forEach((k) => { racine.mtt.choisir({ type: "secteur", id: k }); parcourir(); racine.mtt.choisir(null); });
["montreal", "l-ile-dorval", "terrebonne", "westmount"].forEach((k) => { racine.mtt.choisir({ type: "ville", id: k }); parcourir(); racine.mtt.choisir(null); });
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
const t = copie.textContent + textes.join(" ");
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées mtt__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)mtt/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
verifier("crédit OpenStreetMap (ODbL) affiché", /OpenStreetMap/.test(un(".mtt__source").textContent) && /ODbL/.test(un(".mtt__source").textContent));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
