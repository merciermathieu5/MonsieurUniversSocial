/*
 * Test de la mousson mois par mois au Bangladesh (fiche de géographie 11) dans un DOM simulé.
 *     node outils/test_bangladesh_mousson.js [composant.html]
 */
/* Partie commune des tests du lot : DOM simulé, page.js, outils. ID et PFX sont remplacés. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "bangladesh-mousson.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("bangladesh-mousson");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".bgm__intertitre").textContent;
const api = racine.bgm;
const etatDepart = () => JSON.stringify(api.etat()) + "|" + tous(".bgm__couche, .bgm__segment").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();
function pincer() {
  const carte = un(".bgm__carte");
  const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
  const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
  const avant = un(".bgm__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = undefined;
  const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
  toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
  toucher("touchend", []);
  window.requestAnimationFrame = raf;
  verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un(".bgm__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un(".bgm__svg").getAttribute("viewBox"));
}
function typographie(textes) {
  console.log("TYPOGRAPHIE ET STRUCTURE");
  const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
  const t = copie.textContent + textes.join(" ");
  verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
  verifier("aucune virgule devant « et »", !/, et /.test(t));
  verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t), (t.match(/.{20}[   ][;!?]/) || [])[0]);
  verifier("espace insécable devant les deux-points", !/ :/.test(t), (t.match(/.{20} :/) || [])[0]);
  const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
  verifier("aucun id en double", new Set(ids).size === ids.length);
  verifier("classes préfixées bgm__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)bgm/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
  verifier("sources citées", un(".bgm__source").textContent.length > 80);
}
function fin() { console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme."); process.exit(echecs ? 1 : 0); }

const nbsp = (s) => s.replace(/[  ]/g, " ");
const vue = () => nbsp(un(".bgm__vue").textContent);
console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("data-reinitialiser et bouton Réinitialiser de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".bgm__entete .reinitialiser"));
verifier("quatre fleuves, quatre lieux, 12 mois", tous(".bgm__fleuve-groupe").length === 4 && tous(".bgm__lieu").length === 4 && tous(".bgm__mois-fond").length === 12);
verifier("au départ : juillet, mousson, 493 mm, vents du sud-ouest", racine.getAttribute("data-mois") === "6" && /Juillet/.test(titre()) && /493 mm/.test(vue()) && /La mousson/.test(vue()) && tous(".bgm__vent").length === 6);
verifier("juillet : aus récolté, aman repiqué", /Aus : récolte/.test(vue()) && /Aman : semis ou repiquage/.test(vue()));
const depart = etatDepart();
console.log("MOIS");
const largeur = () => parseFloat(un('.bgm__fleuve-groupe[data-fleuve="brahmapoutre"] .bgm__fleuve').style.strokeWidth);
const lJuillet = largeur();
clic(un('.bgm__mois-fond[data-mois="1"]'));
verifier("février : saison sèche, débit le plus bas, fleuves plus minces", /La saison sèche/.test(vue()) && /4 160 m³\/s/.test(vue()) && /le plus bas/.test(vue()) && largeur() < lJuillet);
verifier("février : vents de la terre vers la mer", tous(".bgm__vent").length === 6);
verifier("février : boro repiqué", /Boro : semis ou repiquage/.test(vue()));
clic(un(".bgm__pas--plus"));
verifier("le bouton suivant mène à mars, sans flèches de vent", racine.getAttribute("data-mois") === "2" && tous(".bgm__vent").length === 0);
const c = un(".bgm__mois"); c.value = "3"; c.dispatchEvent(new window.Event("input", { bubbles: true }));
verifier("le curseur mène à avril : crues éclair, boro récolté", /Avril/.test(titre()) && /crues éclair/.test(vue()) && /Boro : récolte/.test(vue()));
clic(un(".bgm__pas--moins")); clic(un(".bgm__pas--moins")); clic(un(".bgm__pas--moins")); clic(un(".bgm__pas--moins"));
verifier("le bouton précédent fait le tour de l'année (décembre)", racine.getAttribute("data-mois") === "11");
console.log("FICHES");
clic(tous(".bgm__vue .bgm__choisir").find((b) => /Boro/.test(b.textContent)));
verifier("la fiche du boro : 55 %, irrigation", choix() === "riz:boro" && /55 %/.test(vue()) && /irrigation/.test(vue()));
clic(tous(".bgm__vue .bgm__retour").find((b) => /récolte/.test(b.textContent)));
verifier("« voir le mois de la récolte » mène à avril", racine.getAttribute("data-mois") === "3" && choix() === "riz:boro");
touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(un('.bgm__bande-nom[data-riz="aman"]'));
verifier("le nom « Aman » du graphique ouvre sa fiche", choix() === "riz:aman" && /35 %/.test(vue()));
clic(un('.bgm__bande-nom[data-riz="aman"]'));
verifier("un second clic la ferme", choix() === "");
clic(un('.bgm__bande-nom[data-riz="crue"]'));
verifier("les grandes crues : 1998 ~68 %", choix() === "crues:crue" && /~68 %/.test(vue()) && tous(".bgm__jauge-barre").length === 7);
clic(un('.bgm__lieu[data-lieu="bahadurabad"]'));
verifier("Bahadurabad : presque 12 fois plus", choix() === "lieu:bahadurabad" && /12 fois/.test(vue()));
clic(un('.bgm__lieu[data-lieu="bahadurabad"]'));
verifier("second clic sur Bahadurabad : désélection", choix() === "");
clic(un(".bgm__colline"));
verifier("les collines du Meghalaya", choix() === "lieu:meghalaya" && /arrosés/.test(vue()));
clic(un('.bgm__fleuve-groupe[data-fleuve="brahmapoutre"] .bgm__fleuve-prise'));
verifier("le Brahmapoutre : Jamuna", choix() === "fleuve:brahmapoutre" && /Jamuna/.test(vue()) && un('.bgm__fleuve-groupe[data-fleuve="brahmapoutre"]').classList.contains("est-choisi"));
console.log("COUCHES ET ZOOM");
clic(un('.bgm__mois-fond[data-mois="7"]'));
clic(un('.bgm__couche[data-couche="vents"]'));
verifier("masquer les vents", tous(".bgm__vent").length === 0);
pincer();
console.log("RÉINITIALISATION");
clic(un(".bgm__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());
const textes = [];
const lire = () => textes.push(un(".bgm__lecture").textContent);
for (let m = 0; m < 12; m++) { api.mois(m); lire(); }
["boro", "aus", "aman"].forEach((r) => { api.choisir({ type: "riz", id: r }); lire(); api.choisir(null); });
api.choisir({ type: "crues", id: "crue" }); lire(); api.choisir(null);
["dacca", "bahadurabad", "haors", "khulna", "meghalaya"].forEach((l) => { api.choisir({ type: "lieu", id: l }); lire(); api.choisir(null); });
["brahmapoutre", "gange", "meghna", "tista"].forEach((f) => { api.choisir({ type: "fleuve", id: f }); lire(); api.choisir(null); });
textes.push(tous(".bgm__graphe title").map((t) => t.textContent).join(" "));
typographie(textes);
fin();
