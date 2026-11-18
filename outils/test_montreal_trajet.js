/*
 * Test de l'onglet « Mon trajet en métro » de la carte du transport (fiche de géographie 02) dans un DOM simulé.
 *     node outils/test_montreal_trajet.js [composant.html]
 * On vérifie les onglets, le plan schématique (4 lignes, 68 stations, 4 correspondances), le choix du départ
 * (liste et clic sur le plan), la direction et le nombre de stations, l'arrêt aux correspondances,
 * le changement de ligne, le journal, le défi et Réinitialiser.
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
const racine = window.document.getElementById("montreal-transport");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const T = racine.mtr.trajet;
T.delai = 0;
const etat = () => T.etat();
const cmd = () => un(".mtrj__commandes").textContent;
const bouton = (s) => un(".mtrj__commandes " + s);
const dir = (l, s) => un(`.mtrj__dir[data-ligne="${l}"][data-sens="${s}"]`);

console.log("ONGLETS");
const onglets = tous(".mtr__onglet");
verifier("deux onglets, le réseau ouvert au départ", onglets.length === 2 && racine.getAttribute("data-onglet") === "reseau" && onglets[0].getAttribute("aria-selected") === "true");
clic(onglets[1]);
verifier("l'onglet Mon trajet s'ouvre et change le titre", racine.getAttribute("data-onglet") === "trajet" && /Mon trajet/.test(un(".mtr__titre").textContent) && onglets[1].getAttribute("aria-selected") === "true");
clic(onglets[0]);
verifier("retour au réseau : titre d'origine", racine.getAttribute("data-onglet") === "reseau" && /par étages/.test(un(".mtr__titre").textContent));
clic(onglets[1]);

console.log("PLAN SCHÉMATIQUE");
verifier("4 lignes du métro", tous(".mtrj__ligne").length === 4);
verifier("68 stations", tous(".mtrj__station").length === 68, tous(".mtrj__station").length);
verifier("4 stations de correspondance", tous(".mtrj__station--corresp").map((g) => g.getAttribute("data-station")).sort().join() === "berri-uqam,jean-talon,lionel-groulx,snowdon");
verifier("68 noms de station affichés", tous(".mtrj__nom").length === 68);

console.log("DÉPART");
verifier("au départ : choisir une station (liste de 68 stations)", etat().phase === "depart" && tous(".mtrj__liste option").length === 69);
const liste = un(".mtrj__liste");
liste.value = "vendome"; liste.dispatchEvent(new window.Event("change", { bubbles: true }));
verifier("la liste fixe le départ à Vendôme", etat().pos === "vendome" && etat().phase === "choix");
verifier("Vendôme : deux directions sur la ligne orange", tous(".mtrj__dir").length === 2 && !!dir("orange", "1") && !!dir("orange", "-1"));
clic(bouton(".mtrj__changer"));
clic(un('.mtrj__station[data-station="berri-uqam"]'));
verifier("un clic sur le plan fixe le départ à Berri-UQAM", etat().pos === "berri-uqam");
verifier("Berri-UQAM : 5 directions (verte, orange, jaune vers Longueuil)", tous(".mtrj__dir").length === 5);
clic(un('.mtrj__station[data-station="vendome"]'));
verifier("avant de partir, on peut encore changer de départ par le plan", etat().pos === "vendome");

console.log("DIRECTION ET NOMBRE DE STATIONS");
clic(dir("orange", "1"));
verifier("direction Montmorency choisie", etat().choix === "orange+" && dir("orange", "1").getAttribute("aria-pressed") === "true");
for (let i = 0; i < 40; i++) clic(bouton(".mtrj__plus"));
verifier("le nombre s'arrête au terminus (22 stations jusqu'à Montmorency)", etat().n === 22 && bouton(".mtrj__plus").disabled);
for (let i = 0; i < 17; i++) clic(bouton(".mtrj__moins"));
verifier("on revient à 5 stations", etat().n === 5);
clic(bouton(".mtrj__partir"));
verifier("arrêt à Lionel-Groulx, station de correspondance", etat().phase === "pause" && etat().pos === "lionel-groulx" && etat().reste === 3 && /ligne verte/.test(cmd()));
verifier("le plan n'accepte plus de nouveau départ", (clic(un('.mtrj__station[data-station="snowdon"]')), etat().depart === "vendome"));
clic(bouton(".mtrj__rester"));
verifier("rester dans le train : arrivée à Bonaventure après 5 stations", etat().phase === "choix" && etat().pos === "bonaventure" && etat().bilan.stations === 5);
verifier("le journal décrit l'étape", /Ligne orange, direction Montmorency\s:\s5 stations, de Vendôme à Bonaventure/.test(un(".mtrj__journal").textContent));

console.log("CHANGER DE LIGNE");
T.recommencer();
T.choisirDepart("vendome"); T.choisirDirection("orange", 1); T.regler(5); T.partir();
clic(bouton(".mtrj__descendre"));
verifier("descendre à Lionel-Groulx : nouvelles directions offertes", etat().phase === "choix" && etat().pos === "lionel-groulx" && tous(".mtrj__dir").length === 4);
clic(dir("verte", "1")); T.regler(7); clic(bouton(".mtrj__partir"));
verifier("ligne verte vers Honoré-Beaugrand, 7 stations : Berri-UQAM", etat().pos === "berri-uqam" && etat().phase === "choix");
verifier("bilan : 9 stations, 1 correspondance", etat().bilan.stations === 9 && etat().bilan.corresp === 1);
verifier("le journal note l'arrêt et la correspondance", /2 stations sur les 5 prévues/.test(un(".mtrj__journal").textContent) && /Correspondance à Lionel-Groulx/.test(un(".mtrj__journal").textContent));
clic(bouton(".mtrj__terminer"));
verifier("Terminer le trajet affiche le bilan", etat().phase === "fin" && /De Vendôme à Berri-UQAM/.test(cmd()));

console.log("DÉFI");
T.defi("angrignon", "saint-michel");
verifier("défi d'Angrignon à Saint-Michel : trajet le plus court de 22 stations", etat().defi.min === 22 && /Défi/.test(cmd()) && !!un(".mtrj__repere--but"));
T.choisirDirection("verte", 1); T.regler(7); T.partir();
verifier("arrivée à Lionel-Groulx après 7 stations", etat().phase === "choix" && etat().pos === "lionel-groulx");
 T.choisirDirection("orange", -1); T.regler(4); T.partir();
verifier("Snowdon atteint", etat().pos === "snowdon");
T.choisirDirection("bleue", 1); T.regler(11); T.partir();
verifier("passage à Jean-Talon", etat().phase === "pause"); T.rester();
verifier("défi réussi par le plus court chemin", etat().phase === "fin" && etat().defi.reussi && etat().bilan.stations === 22, JSON.stringify(etat()));
verifier("le bilan compare au trajet le plus court", /plus court compte 22 stations/.test(cmd()));

console.log("RÉINITIALISATION ET TYPOGRAPHIE");
racine.dispatchEvent(new window.CustomEvent("reinitialiser"));
verifier("Réinitialiser ramène au choix du départ", etat().phase === "depart" && etat().etapes === 0 && !un(".mtrj__repere"));
T.choisirDepart("vendome"); T.choisirDirection("orange", 1); T.regler(5); T.partir(); T.rester();
const copie = racine.cloneNode(true);
copie.querySelectorAll("style, script").forEach((n) => n.remove());
const t = copie.textContent;
verifier("aucun tiret cadratin ou demi-cadratin", !/[\u2013\u2014]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
verifier("aucune espace avant ; ! ?", !/[ \u00a0][;!?]/.test(t));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
