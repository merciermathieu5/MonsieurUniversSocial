/*
 * Test de la carte du Sahel et de la Grande Muraille verte (fiche de géographie 11) dans un DOM simulé.
 *     node outils/test_sahel_muraille.js [composant.html]
 * On vérifie les onze pays fondateurs, les fiches de pays et de thèmes (bilan, argent, désertification),
 * la couche du tracé de 2007, la désélection (second clic, Échap), le zoom à deux doigts,
 * Réinitialiser (page.js) et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "sahel-muraille.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("sahel-muraille");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".smv__intertitre").textContent;
const vue = () => un(".smv__vue").textContent;
const pays = (id) => un(`.smv__pays[data-pays="${id}"]`);
const theme = (id) => un(`.smv__theme[data-theme="${id}"]`);
const etatDepart = () => JSON.stringify(racine.smv.etat()) + "|" + tous(".smv__puce").map((b) => b.getAttribute("aria-pressed")).join() + "|" + titre();
const D = racine.smv.donnees;

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("onze pays fondateurs colorés", tous(".smv__pays").length === 11);
verifier("les onze noms de la fiche sont là", ["Sénégal", "Mauritanie", "Mali", "Burkina Faso", "Niger", "Nigeria", "Tchad", "Soudan", "Érythrée", "Éthiopie", "Djibouti"].every((n) => D.pays.some((p) => p.n === n)));
verifier("au départ : vue d'ensemble, tracé de 2007 affiché", choix() === "" && /Grande Muraille verte/.test(titre()) && un('.smv__couche[data-couche="trace"]').getAttribute("aria-pressed") === "true" && !!un(".smv__trace"));
verifier("la vue d'ensemble donne 15 km et 7 775 km", /15 km/.test(vue()) && /7 775 km/.test(vue()), vue().slice(0, 300));
verifier("la vue d'ensemble liste les onze pays", tous(".smv__vue .smv__choisir").length === 11 + 3);
verifier("Dakar et Djibouti marqués aux extrémités du tracé", tous(".smv__ville").length === 2);
verifier("data-reinitialiser et boutons de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".smv__entete .reinitialiser") && !!un(".smv__entete .plein-ecran"));
const depart = etatDepart();

console.log("PAYS");
clic(pays("SEN"));
verifier("clic sur le Sénégal : sa fiche et ses chiffres", choix() === "pays:SEN" && titre() === "Sénégal" && /850 000 ha/.test(vue()) && /2020/.test(vue()));
verifier("les autres pays sont estompés", tous(".smv__pays.est-estompe").length === 10 && pays("SEN").classList.contains("est-choisi"));
clic(pays("SEN"));
verifier("un second clic désélectionne", choix() === "" && tous(".smv__pays.est-estompe").length === 0);
clic(pays("NER"));
verifier("Niger : régénération naturelle, plus de 5 millions d'ha", /régénération naturelle assistée/.test(vue()) && /5 millions/.test(vue()) && /2009/.test(vue()));
clic(pays("MLI"));
verifier("Mali : pas de chiffre inventé", choix() === "pays:MLI" && /ne publie pas de résultat/.test(vue()) && !un(".smv__vue .smv__chiffres"));
touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(tous(".smv__vue .smv__choisir").find((b) => /Éthiopie/.test(b.textContent)));
verifier("depuis la liste, on ouvre l'Éthiopie", choix() === "pays:ETH" && /218 405/.test(vue()));

console.log("THÈMES ET COUCHE");
clic(theme("bilan"));
verifier("Objectifs et bilan : 100 millions d'ha, 4 % atteints en 2020", choix() === "theme:bilan" && /100 millions d'hectares/.test(vue()) && /4 %/.test(vue()) && tous(".smv__vue .smv__jauge").length === 3);
verifier("la jauge de 4 millions fait 4 % de celle de l'objectif", parseFloat(tous(".smv__vue .smv__jauge > span")[1].style.width) === 4);
verifier("le bouton du thème est enfoncé", theme("bilan").getAttribute("aria-pressed") === "true");
clic(theme("bilan"));
verifier("second clic sur le thème : désélection", choix() === "");
clic(theme("argent"));
verifier("L'argent : 19,7 milliards promis, 12 % versés", /19,7 milliards/.test(vue()) && /12 %/.test(vue()));
clic(theme("desert"));
verifier("La désertification : définition de 1994", /zones arides, semi-arides et subhumides sèches/.test(vue()));
clic(un('.smv__couche[data-couche="trace"]'));
verifier("on peut masquer le tracé de 2007", un(".smv__trace-groupe").style.display === "none" && tous(".smv__ville").length === 0);
clic(un('.smv__couche[data-couche="trace"]'));
verifier("et le réafficher", un(".smv__trace-groupe").style.display === "" && tous(".smv__ville").length === 2);

console.log("ZOOM ET RÉINITIALISATION");
const carte = un(".smv__carte");
const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
const raf = window.requestAnimationFrame; window.requestAnimationFrame = undefined;
const d1 = toucher("touchstart", [doigt(300, 200, 1), doigt(340, 200, 2)]);
toucher("touchmove", [doigt(260, 200, 1), doigt(380, 200, 2)]);
toucher("touchend", []);
window.requestAnimationFrame = raf;
verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && carte.classList.contains("est-zoomee"));
clic(pays("TCD")); clic(un('.smv__couche[data-couche="trace"]'));
clic(un(".smv__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart && !carte.classList.contains("est-zoomee"), etatDepart());

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [];
D.pays.forEach((p) => { racine.smv.choisir({ type: "pays", id: p.id }); textes.push(un(".smv__lecture").textContent); racine.smv.choisir(null); });
["bilan", "argent", "desert"].forEach((t) => { racine.smv.choisir({ type: "theme", id: t }); textes.push(un(".smv__lecture").textContent); racine.smv.choisir(null); });
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
const t = copie.textContent + textes.join(" ");
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t), (t.match(/.{30}, et .{10}/) || [""])[0]);
verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
verifier("aucun « undefined » ni « NaN »", !/undefined|NaN/.test(t));
const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées smv__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)smv/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
verifier("sources citées (CNULCD, Natural Earth)", /CNULCD/.test(un(".smv__source").textContent) && /Natural Earth/.test(un(".smv__source").textContent));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
