/*
 * Test de la réseau d'Hydro-Québec (fiche de géographie 07) dans un DOM simulé.
 *     node outils/test_hydro_quebec_reseau.js [composant.html]
 * On vérifie les 31 centrales, les deux études de cas, les lignes à 735 kV, la désélection (second clic, Échap),
 * les couches, le zoom à deux doigts, Réinitialiser (page.js) et la typographie.
 */
const ID = "hydro-quebec-reseau", P = "hqr";
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
verifier("31 centrales dessinées", tous(".hqr__centrale").length === 31, tous(".hqr__centrale").length);
verifier("lignes à 735 kV et ligne à courant continu tracées", tous(".hqr__ligne").length === 2 && un(".hqr__ligne").getAttribute("d").length > 1000 && !!un(".hqr__ligne--cc"));
verifier("rivières aménagées et fond commun du Nord québécois", un(".hqr__amenagee").getAttribute("d").length > 500 && !!un(".hqr__terre--qc") && tous(".hqr__lac").length > 50);
verifier("au départ : aucun choix, accueil avec les deux études de cas", choix() === "" && /grandes centrales/.test(titre()) && tous(".hqr__vue .hqr__choisir").filter((b) => /Étude de cas/.test(b.textContent)).length === 2);
verifier("puissances des deux études : 17 418 MW et 12 896 MW", /17 418 MW/.test(vue()) && /12 896 MW/.test(vue()));
const D = racine.hqr.D, somme = (f) => D.centrales.filter(f).reduce((s, c) => s + c.mw, 0);
verifier("complexe de la Romaine : 1 550 MW (fiche)", somme((c) => c.ens === "romaine") === 1550);
verifier("Manic-5 et Manic-5-PA : 2 660 MW (fiche)", somme((c) => /^manic-5/.test(c.id)) === 2660);
verifier("Robert-Bourassa et La Grande-2-A : 7 722 MW (fiche)", somme((c) => c.id === "robert-bourassa" || c.id === "la-grande-2-a") === 7722);
verifier("noms affichés (villes, centrales, eaux)", tous(".hqr__etiquette--ville").length >= 2 && tous(".hqr__etiquette--centrale").length >= 3 && !!un(".hqr__etiquette--eau"));
verifier("data-reinitialiser sur la racine", racine.hasAttribute("data-reinitialiser"));
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".hqr__entete .reinitialiser") && un(".hqr__entete .reinitialiser").nextElementSibling === un(".hqr__entete .plein-ecran"));
const depart = etatDepart(), vbDepart = un(".hqr__svg").getAttribute("viewBox");

console.log("CHOIX ET DÉSÉLECTION");
const centrale = (id) => un(`.hqr__centrale[data-centrale="${id}"]`);
clic(centrale("robert-bourassa"));
verifier("un clic sur Robert-Bourassa ouvre sa fiche", choix() === "centrale:robert-bourassa" && titre() === "Robert-Bourassa" && /5 616 MW/.test(vue()) && /1979 à 1981/.test(vue()));
verifier("la centrale choisie est entourée et nommée", un(".hqr__anneau").getAttribute("data-centrale") === "robert-bourassa" && !!un(".hqr__etiquette--choisie"));
verifier("sa fiche dit qu'elle est la plus puissante du Canada", /plus puissante centrale hydroélectrique du Canada/.test(vue()));
clic(centrale("robert-bourassa"));
verifier("un second clic désélectionne", choix() === "" && /grandes centrales/.test(titre()));
clic(centrale("manic-5"));
touche("Escape");
verifier("Échap désélectionne", choix() === "");

console.log("ÉTUDES DE CAS");
clic(boutonVue(/Étude de cas : Baie-James/));
verifier("le bouton Baie-James ouvre l'étude de cas et rapproche la carte", choix() === "etude:baie-james" && un(".hqr__svg").getAttribute("viewBox") !== vbDepart && !un(".hqr__recentrer").hidden);
verifier("11 centrales listées, les autres estompées", tous(".hqr__vue .hqr__liste .hqr__choisir").length === 11 && tous(".hqr__centrale.est-estompe").length === 20, tous(".hqr__centrale.est-estompe").length);
verifier("l'étude de cas donne puissance totale et première mise en service", /17 418 MW/.test(vue()) && /1979/.test(vue()));
clic(tous(".hqr__vue .hqr__liste .hqr__choisir").find((b) => /La Grande-4/.test(b.textContent)));
verifier("depuis l'étude, on ouvre La Grande-4", choix() === "centrale:la-grande-4" && /2 779 MW/.test(vue()));
clic(boutonVue(/Voir l'étude de cas Baie-James/));
verifier("le bouton Voir l'étude de cas revient à l'étude", choix() === "etude:baie-james");
clic(boutonVue(/Voir l'étude de cas Côte-Nord/));
verifier("on passe à la Côte-Nord : 17 centrales, 12 896 MW", choix() === "etude:cote-nord" && tous(".hqr__vue .hqr__liste .hqr__choisir").length === 17 && /12 896 MW/.test(vue()));
clic(boutonVue(/Tout le Québec/));
verifier("Tout le Québec revient à l'accueil et à la carte entière", choix() === "" && un(".hqr__svg").getAttribute("viewBox") === vbDepart);

console.log("LIGNES ET COUCHES");
clic(un('.hqr__ligne-prise[data-ligne="735"]'));
verifier("un clic sur une ligne ouvre la fiche des lignes à 735 kV", choix() === "ligne:735" && /29 novembre 1965/.test(vue()) && /34 900 km/.test(vue()) && racine.classList.contains("est-ligne-choisie"));
clic(un('.hqr__couche[data-couche="lignes"]'));
verifier("masquer les lignes ferme leur fiche", choix() === "" && !racine.classList.contains("avec-lignes"));
clic(un('.hqr__ligne-prise[data-ligne="735"]'));
verifier("sans la couche, un clic sur une ligne ne fait rien", choix() === "");
clic(centrale("churchill-falls"));
verifier("Churchill Falls : centrale du Labrador, contrat jusqu'en 2041 et entente de 2026", /Labrador/.test(vue()) && /2041/.test(vue()) && /2077/.test(vue()));
clic(un('.hqr__couche[data-couche="centrales"]'));
verifier("masquer les centrales ferme la fiche de la centrale", choix() === "" && !racine.classList.contains("avec-centrales"));
clic(un('.hqr__couche[data-couche="villes"]'));
verifier("masquer les villes retire leurs noms", tous(".hqr__etiquette--ville").length === 0);
clic(un(".hqr__zoom-plus"));
verifier("le bouton + rapproche la carte", un(".hqr__svg").getAttribute("viewBox") !== vbDepart && !un(".hqr__recentrer").hidden);

console.log("RÉINITIALISATION");
clic(un(".hqr__replier"));
clic(un(".hqr__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());
verifier("Réinitialiser garde le texte masqué", racine.classList.contains("texte-masque"));
pincer();
clic(un(".hqr__entete .reinitialiser"));
verifier("Réinitialiser ramène la carte entière", un(".hqr__svg").getAttribute("viewBox") === vbDepart && un(".hqr__recentrer").hidden);

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [un(".hqr__lecture").textContent];
D.centrales.forEach((c) => { racine.hqr.choisir({ type: "centrale", id: c.id }); textes.push(un(".hqr__lecture").textContent); racine.hqr.choisir(null); });
D.etudes.forEach((e) => { racine.hqr.M.ouvrirEtude(e.id); textes.push(un(".hqr__lecture").textContent); racine.hqr.choisir(null); });
racine.hqr.choisir({ type: "ligne", id: "735" }); textes.push(un(".hqr__lecture").textContent); racine.hqr.choisir(null);
typographie(textes, [/Hydro-Québec/, /OpenStreetMap/, /ODbL/, /Natural Earth/]);
fin();
