/*
 * Test de la carte du transport collectif par étages (fiche de géographie 02) dans un DOM simulé.
 *     node outils/test_montreal_transport.js [composant.html]
 * On vérifie les lignes et leurs étages, le choix d'un étage, d'une ligne ou d'une station,
 * la désélection (second clic, Échap), le cadrage Centre, l'animation selon l'horaire,
 * Réinitialiser (page.js) et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "montreal-transport.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("montreal-transport");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const ligne = (k) => un(`.mtr__ligne[data-ligne="${k}"] .mtr__prise`);
const station = (id) => un(`.mtr__station[data-station="${id}"]`);
const etage = (e) => un(`.mtr__etage[data-etage="${e}"]`);
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".mtr__intertitre").textContent;
const estompees = () => tous(".mtr__ligne.est-estompe").map((g) => g.getAttribute("data-ligne")).sort().join();
const etatDepart = () => JSON.stringify(racine.mtr.etat()) + "|" + estompees() + "|" + tous(".mtr__etage").map((b) => b.getAttribute("aria-pressed")).join() + "|" + JSON.stringify(racine.mtr.anim.etat()) + "|" + un(".mtr__heure").textContent + "|" + titre();

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("11 lignes dessinées (4 du métro, REM, 5 trains, SRB)", tous(".mtr__ligne").length === 11);
verifier("métro sous terre, REM mixte, trains et SRB en surface", ["verte", "orange", "jaune", "bleue"].every((k) => un(`.mtr__ligne[data-ligne="${k}"]`).getAttribute("data-etage") === "sous") && un('.mtr__ligne[data-ligne="rem"]').getAttribute("data-etage") === "mixte" && ["vh", "sj", "msh", "can", "mas", "srb"].every((k) => un(`.mtr__ligne[data-ligne="${k}"]`).getAttribute("data-etage") === "surface"));
verifier("le REM a des tronçons souterrains et sur viaduc", !!un('.mtr__ligne[data-ligne="rem"] .mtr__tirets') && !!un('.mtr__ligne[data-ligne="rem"] .mtr__gaine--aerien'));
verifier("plus de 120 stations et gares", tous(".mtr__station").length > 120, tous(".mtr__station").length);
verifier("au départ : tous les étages, aucun choix, toute la région", choix() === "" && racine.getAttribute("data-etage") === "tous" && estompees() === "" && un(".mtr__svg").getAttribute("viewBox") === "80 190 880 616");
verifier("plus de vue en coupe", !un(".mtr__coupe") && !/coupe/i.test(racine.querySelector(".mtr__bas").textContent));
verifier("noms de stations affichés d'emblée", tous(".mtr__etiquette--station").length >= 5);
verifier("data-reinitialiser sur la racine", racine.hasAttribute("data-reinitialiser"));
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".mtr__entete .reinitialiser") && un(".mtr__entete .reinitialiser").nextElementSibling === un(".mtr__entete .plein-ecran"));
const depart = etatDepart();

console.log("ÉTAGES");
clic(etage("sous"));
verifier("Souterrain : seules les lignes du métro restent vives", estompees() === "can,mas,msh,rem,sj,srb,vh", estompees());
verifier("la fiche de l'étage parle du métro", /métro/.test(titre()));
clic(etage("sous"));
verifier("un second clic sur l'étage revient à tous les étages", racine.getAttribute("data-etage") === "tous" && estompees() === "");
clic(etage("mixte"));
verifier("l'étage mixte ne garde que le REM", racine.getAttribute("data-etage") === "mixte" && estompees() === "bleue,can,jaune,mas,msh,orange,sj,srb,verte,vh");
touche("Escape");
verifier("Échap revient à tous les étages", racine.getAttribute("data-etage") === "tous");

console.log("LIGNES ET STATIONS");
clic(ligne("bleue"));
verifier("un clic sur la ligne bleue ouvre sa fiche", choix() === "ligne:bleue" && titre() === "Ligne bleue" && /16 juin 1986/.test(un(".mtr__vue").textContent));
verifier("la ligne bleue rapproche la carte du centre", racine.mtr.etat().vue === "centre");
verifier("les autres lignes sont estompées", estompees().split(",").length === 10);
clic(ligne("bleue"));
verifier("un second clic désélectionne et ramène la vue d'avant", choix() === "" && racine.mtr.etat().vue === "region" && estompees() === "");
clic(station("berri-uqam"));
verifier("Berri-UQAM : trois lignes du métro et un fait", choix() === "station:berri-uqam" && tous(".mtr__vue .mtr__puce").length === 3 && /trois lignes/.test(un(".mtr__vue").textContent));
clic(tous(".mtr__vue .mtr__puce")[2]);
verifier("depuis la station, une puce ouvre la ligne jaune", choix() === "ligne:jaune");
touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(station("cote-de-liesse"));
verifier("Côte-de-Liesse relie le REM et le train de Mascouche", /REM/.test(un(".mtr__vue").textContent) && /Mascouche/.test(un(".mtr__vue").textContent));
clic(station("cote-de-liesse"));
verifier("second clic sur la station : désélection", choix() === "");
clic(ligne("mas"));
verifier("train de Mascouche : 11 gares, ordre de Côte-de-Liesse à Mascouche", /11/.test(un(".mtr__chiffres").textContent) && tous(".mtr__grille button")[0].textContent === "Côte-de-Liesse" && tous(".mtr__grille button")[10].textContent === "Mascouche");
clic(un('.mtr__vue-bouton[data-vue="centre"]'));
verifier("le bouton Centre rapproche la carte", racine.mtr.etat().vue === "centre" && un(".mtr__svg").getAttribute("viewBox").indexOf("410") === 0);

console.log("ANIMATION SELON L'HORAIRE");
const anim = racine.mtr.anim;
verifier("au départ, les véhicules sont cachés et l'heure est 8 h 00", !anim.etat().actif && un(".mtr__heure").textContent === "8 h 00" && un(".mtr__vehicules").style.display !== "block");
verifier("la frise de la journée est dessinée", (un(".mtr__courbe-aire").getAttribute("d") || "").length > 100);
anim.aller(8 * 60);
const pointe = anim.etat().n;
verifier("à 8 h, des trains de métro, du REM, d'exo et du SRB circulent", pointe.metro > 20 && pointe.rem > 5 && pointe.train > 0 && pointe.srb > 0, JSON.stringify(pointe));
verifier("le compte s'affiche en toutes lettres", /En circulation à 8 h 00/.test(un(".mtr__compte").textContent) && /trains de métro/.test(un(".mtr__compte").textContent));
verifier("la période est nommée", /pointe du matin/.test(un(".mtr__periode").textContent));
anim.aller(13 * 60);
const midi = anim.etat().n;
verifier("moins de métros à 13 h qu'à 8 h", midi.metro < pointe.metro, midi.metro + " / " + pointe.metro);
anim.aller(3 * 60 + 1440);
verifier("à 3 h du matin, le métro ne roule plus", !(anim.etat().n.metro > 0), JSON.stringify(anim.etat().n));
const curseur = un(".mtr__curseur");
curseur.value = "1050"; curseur.dispatchEvent(new window.Event("input", { bubbles: true }));
verifier("le curseur change l'heure (17 h 30)", un(".mtr__heure").textContent === "17 h 30" && anim.etat().t === 1050);
clic(un('.mtr__vitesse[data-vitesse="8"]'));
verifier("le choix de la vitesse est marqué", un('.mtr__vitesse[data-vitesse="8"]').getAttribute("aria-pressed") === "true");

console.log("RÉINITIALISATION");
clic(etage("surface"));
clic(un(".mtr__replier"));
clic(un(".mtr__zoom-plus"));
clic(un(".mtr__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());
verifier("Réinitialiser garde le texte masqué", racine.classList.contains("texte-masque"));

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [un(".mtr__lecture").textContent];
["tous", "sous", "mixte", "surface"].forEach((e) => { racine.mtr.choisirEtage(e); textes.push(un(".mtr__lecture").textContent); racine.mtr.choisirEtage("tous"); });
["verte", "orange", "jaune", "bleue", "rem", "vh", "sj", "msh", "can", "mas", "srb"].forEach((k) => { racine.mtr.choisir({ type: "ligne", id: k }); textes.push(un(".mtr__lecture").textContent); racine.mtr.choisir(null); });
tous(".mtr__station").forEach((c) => { racine.mtr.choisir({ type: "station", id: c.getAttribute("data-station") }); textes.push(un(".mtr__lecture").textContent); racine.mtr.choisir(null); });
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script").forEach((n) => n.remove());
const t = copie.textContent + textes.join(" ");
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées mtr__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)mtr/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
verifier("crédit OpenStreetMap (ODbL) affiché", /OpenStreetMap/.test(un(".mtr__source").textContent) && /ODbL/.test(un(".mtr__source").textContent));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
