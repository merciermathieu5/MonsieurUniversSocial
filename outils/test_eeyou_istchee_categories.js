/*
 * Test de la carte des terres de catégories I, II et III d'Eeyou Istchee (fiche de géographie 12) dans un DOM simulé.
 *     node outils/test_eeyou_istchee_categories.js [composant.html]
 * On vérifie les terres des 9 communautés cries, les trois catégories, les superficies, la désélection,
 * les couches, le zoom à deux doigts, Réinitialiser et la typographie.
 */
const ID = "eeyou-istchee-categories", P = "eey";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", ID + ".html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById(ID);
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un("." + P + "__intertitre").textContent.replace(/\u00a0/g, " ");
const vue = () => un("." + P + "__vue").textContent.replace(/\u00a0/g, " ");
const boutonVue = (re) => tous("." + P + "__vue button").find((b) => re.test(b.textContent.replace(/\u00a0/g, " ")));
const etatDepart = () => JSON.stringify(racine[P].etat()) + "|" + tous("." + P + "__couche").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();
function pincer() {
  const carte = un("." + P + "__carte");
  const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
  const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
  const avant = un("." + P + "__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = undefined;
  const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
  toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
  toucher("touchend", []);
  window.requestAnimationFrame = raf;
  verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un("." + P + "__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un("." + P + "__svg").getAttribute("viewBox"));
}
function typographie(textes, credit) {
  const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
  const t = copie.textContent + textes.join(" ") + tous("." + P + "__etiquettes text").map((n) => n.textContent).join(" ");
  verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
  verifier("aucune virgule devant « et »", !/, et /.test(t), (t.match(/.{30}, et .{10}/) || [])[0]);
  verifier("aucune espace ordinaire avant ; ! ?", !/ [;!?]/.test(t), (t.match(/.{20} [;!?]/) || [])[0]);
  verifier("espace insécable devant les deux-points", !/ :/.test(t), (t.match(/.{20} :/) || [])[0]);
  verifier("aucune espace insécable brute dans le script", !/ /.test(script));
  const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
  verifier("aucun id en double", new Set(ids).size === ids.length);
  verifier("classes préfixées " + P + "__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || new RegExp("(^|\\s)" + P).test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
  verifier("sources citées au pied du composant", credit.every((re) => re.test(un("." + P + "__source").textContent)));
}
function fin() { console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme."); process.exit(echecs ? 1 : 0); }
console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
const D = racine.eey.D;
verifier("9 communautés cries de la Convention", tous(".eey__village").length === 9);
verifier("terres de catégories I et II dessinées pour chaque communauté", ["I", "II"].every((k) => new Set(tous(`.eey__cat--${k}`).map((t) => t.getAttribute("data-com"))).size === 9));
verifier("catégorie III, Eeyou Istchee, 49e et 55e parallèles tracés", un(".eey__c3").getAttribute("d").length > 200 && un(".eey__eeyou").getAttribute("d").length > 200 && un(".eey__p49").getAttribute("d") !== "" && un(".eey__p55").getAttribute("d") !== "");
verifier("superficies calculées proches du guide (I : 5 500, II : 70 000 km²)", Math.abs(D.aI - 5500) <= 300 && Math.abs(D.aII - 70000) <= 3000, D.aI + " " + D.aII);
verifier("Eeyou Istchee : plus de 400 000 km²", D.aEeyou > 400000 && /plus de 400 000 km²/.test(vue()));
verifier("au départ : accueil, trois catégories et neuf communautés", choix() === "" && /Trois catégories/.test(titre()) && tous(".eey__vue .eey__liste .eey__choisir").length === 12);
verifier("vue de départ rapprochée sur Eeyou Istchee", un(".eey__svg").getAttribute("viewBox").split(" ").map(Number)[2] < 700);
verifier("terres inuites et naskapies masquées au départ", !racine.classList.contains("avec-autres"));
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".eey__entete .reinitialiser") && un(".eey__entete .reinitialiser").nextElementSibling === un(".eey__entete .plein-ecran"));
const depart = etatDepart(), vbDepart = un(".eey__svg").getAttribute("viewBox");

console.log("CATÉGORIES");
clic(boutonVue(/^Catégorie I(?!I)/));
verifier("la catégorie I : usage exclusif des Cris, IA et IB", choix() === "cat:I" && /usage exclusif des Cris/.test(vue()) && /IA/.test(vue()) && /IB/.test(vue()));
verifier("les autres catégories sont estompées", tous(".eey__cat--II.est-estompe").length === tous(".eey__cat--II").length && un(".eey__c3").classList.contains("est-estompe"));
clic(boutonVue(/Voir la catégorie II/));
verifier("la catégorie II : droit exclusif de chasse, pêche et piégeage ; remplacement ou indemnité", choix() === "cat:II" && /droit exclusif de chasser, de pêcher et de piéger/.test(vue()) && /remplacer/.test(vue()));
clic(un(".eey__c3"));
verifier("un clic sur la zone hachurée ouvre la catégorie III", choix() === "cat:III" && /49e et le 55e parallèle/.test(vue()));
clic(un(".eey__c3"));
verifier("un second clic désélectionne", choix() === "");

console.log("COMMUNAUTÉS");
clic(un('.eey__village[data-com="mistissini"]'));
verifier("un clic sur Mistissini ouvre sa fiche (superficies, population)", choix() === "com:mistissini" && titre() === "Mistissini" && /4 521/.test(vue()) && /km²/.test(vue()));
verifier("ses terres sont mises en valeur, les autres estompées", tous('.eey__cat.est-choisie').every((t) => t.getAttribute("data-com") === "mistissini") && tous(".eey__cat.est-choisie").length >= 2 && tous(".eey__cat.est-estompe").length === tous(".eey__cat").length - tous(".eey__cat.est-choisie").length);
touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(un('.eey__cat--II[data-com="chisasibi"]'));
verifier("un clic sur une terre ouvre la fiche de sa communauté", choix() === "com:chisasibi");
clic(boutonVue(/Ce que permet la catégorie I$/));
verifier("depuis la communauté, on ouvre la catégorie I", choix() === "cat:I");
racine.eey.choisir(null);

console.log("COUCHES");
clic(un('.eey__couche[data-couche="autres"]'));
verifier("les terres inuites et naskapies s'affichent", racine.classList.contains("avec-autres"));
clic(un(".eey__autre"));
verifier("un clic sur une terre inuite ouvre leur fiche", choix() === "autres:nord" && /Nord-Est québécois/.test(vue()));
clic(un('.eey__couche[data-couche="autres"]'));
verifier("les masquer ferme leur fiche", choix() === "");
clic(un('.eey__couche[data-couche="cat3"]'));
verifier("masquer la catégorie III", !racine.classList.contains("avec-cat3"));
clic(un(".eey__zoom-moins"));
verifier("le bouton − éloigne la carte", un(".eey__svg").getAttribute("viewBox") !== vbDepart);

console.log("RÉINITIALISATION");
clic(un(".eey__replier"));
clic(un(".eey__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());
pincer();
clic(un(".eey__entete .reinitialiser"));
verifier("Réinitialiser ramène la vue de départ", un(".eey__svg").getAttribute("viewBox") === vbDepart && un(".eey__recentrer").hidden);

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [un(".eey__lecture").textContent];
["I", "II", "III"].forEach((k) => { racine.eey.choisir({ type: "cat", id: k }); textes.push(un(".eey__lecture").textContent); racine.eey.choisir(null); });
D.com.forEach((c) => { racine.eey.choisir({ type: "com", id: c.id }); textes.push(un(".eey__lecture").textContent); racine.eey.choisir(null); });
racine.eey.choisir({ type: "autres", id: "nord" }); textes.push(un(".eey__lecture").textContent); racine.eey.choisir(null);
typographie(textes, [/Nation crie/, /MERN/, /Natural Earth/]);
fin();
