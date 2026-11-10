/*
 * Test de la carte des onze nations du Québec (fiche de géographie 12) dans un DOM simulé.
 *     node outils/test_nations_quebec.js [composant.html]
 * On vérifie les 11 nations et les 55 communautés, la communauté la plus proche de l'école (Cacouna),
 * le déplacement du point, la désélection, les couches, le zoom à deux doigts, Réinitialiser et la typographie.
 */
const ID = "nations-quebec", P = "nat";
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
const D = racine.nat.D;
verifier("11 nations, 55 communautés (57 points avec les seconds sites)", D.nations.length === 11 && D.communautes.length === 55 && tous(".nat__communaute").length === 57, tous(".nat__communaute").length);
const parNation = {}; D.communautes.forEach((c) => { parNation[c.nat] = (parNation[c.nat] || 0) + 1; });
verifier("41 communautés des Premières Nations et 14 villages inuits", 55 - parNation.inuit === 41 && parNation.inuit === 14);
verifier("total des nations + 425 sans affiliation = 131 050", D.nations.reduce((s, n) => s + n.tot, 0) + 425 === 131050);
verifier("trois familles de langues : 8 algonquiennes, 2 iroquoiennes, 1 inuite", ["alg", "iro", "inu"].map((f) => D.nations.filter((n) => n.fam === f).length).join() === "8,2,1");
verifier("aucun territoire tracé (seulement des points)", tous(".nat__terres path").length === 11 && !un(".nat__territoire"));
verifier("au départ : accueil avec les onze nations", choix() === "" && /Onze nations, 55 communautés/.test(titre()) && tous(".nat__vue .nat__liste .nat__choisir").length === 11);
verifier("la communauté la plus proche de l'école est Cacouna (Wolastoqiyik)", /plus proche de l'École secondaire de Rivière-du-Loup est Cacouna et Kataskomiq, de la nation Wolastoqiyik, à 11 km/.test(vue()), vue().slice(0, 400));
verifier("la note de prudence sur les limites est présente", /pas des frontières/.test(vue()) && /revendications/.test(vue()));
verifier("noms des nations sur la carte", tous(".nat__etiquette--nation").length >= 6 && !!un('.nat__etiquette--nation[data-nation="inuit"]'));
verifier("l'école est marquée et reliée à la communauté la plus proche", un(".nat__ecole-marque").getAttribute("d") !== "" && un(".nat__lien").getAttribute("d") !== "");
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".nat__entete .reinitialiser") && un(".nat__entete .reinitialiser").nextElementSibling === un(".nat__entete .plein-ecran"));
const depart = etatDepart(), vbDepart = un(".nat__svg").getAttribute("viewBox");

console.log("CHOIX ET DÉSÉLECTION");
const point = (id) => un(`.nat__communaute[data-com="${id}"]`);
clic(point("kahnawake"));
verifier("un clic sur Kahnawake ouvre sa fiche", choix() === "com:kahnawake" && titre() === "Kahnawake" && /11 898/.test(vue()) && /8 131/.test(vue()));
clic(point("kahnawake"));
verifier("un second clic désélectionne", choix() === "");
clic(point("wendake")); touche("Escape");
verifier("Échap désélectionne", choix() === "");
clic(un('.nat__etiquette--nation[data-nation="inuit"]'));
verifier("un clic sur le nom INUIT ouvre la fiche de la nation", choix() === "nation:inuit" && /14 469/.test(vue()) && /84 Inuit/.test(vue()) && tous(".nat__vue .nat__liste .nat__choisir").length === 14);
verifier("les autres nations sont estompées", tous(".nat__communaute.est-estompe").length === 57 - 14);
clic(un('.nat__etiquette--nation[data-nation="inuit"]'));
verifier("un second clic sur le nom désélectionne", choix() === "");
clic(tous(".nat__vue .nat__liste .nat__choisir").find((b) => /Wolastoqiyik/.test(b.textContent)));
verifier("la liste ouvre la nation Wolastoqiyik et rapproche la carte", choix() === "nation:wolastoqiyik" && un(".nat__svg").getAttribute("viewBox") !== vbDepart && /plus proche de ton école/.test(vue()));
clic(tous(".nat__vue .nat__liste .nat__choisir")[0]);
verifier("depuis la nation, on ouvre Cacouna et Kataskomiq : deux terres, aucun résident", choix() === "com:cacouna" && /Kataskomiq/.test(vue()) && /Aucun membre inscrit ne réside/.test(vue()) && /11 km/.test(vue()));
clic(boutonVue(/Voir la nation/));
verifier("le bouton Voir la nation revient à la nation", choix() === "nation:wolastoqiyik");
racine.nat.choisir({ type: "com", id: "whapmagoostui" });
verifier("Whapmagoostui : non-résidents masqués par la source", /moins de 10/.test(vue()) && /Kuujjuarapik/.test(vue()));
racine.nat.choisir(null);

console.log("ÉCOLE ET COUCHES");
clic(boutonVue(/Déplacer le point/));
verifier("Déplacer le point attend un clic sur la carte", racine.classList.contains("est-deplacement"));
const montreal = D.villes.find((v) => v.n === "Montréal");
const vb = un(".nat__svg").getAttribute("viewBox").split(" ").map(Number);
const cx = (montreal.x - vb[0]) / vb[2] * 800, cy = (montreal.y - vb[1]) / vb[2] * 800;
un(".nat__svg").dispatchEvent(new window.MouseEvent("click", { bubbles: true, clientX: cx, clientY: cy }));
verifier("placé à Montréal, le point est le plus proche de Kahnawake", !racine.classList.contains("est-deplacement") && /plus proche de ton point est Kahnawake/.test(vue()), vue().slice(0, 300));
clic(un('.nat__couche[data-couche="familles"]'));
verifier("la couleur par famille de langues s'active", racine.classList.contains("avec-familles"));
clic(un('.nat__couche[data-couche="noms"]'));
verifier("masquer les noms des communautés", tous(".nat__etiquette--com").length === 0);
clic(un('.nat__couche[data-couche="ecole"]'));
verifier("masquer l'école retire son marqueur", un(".nat__ecole-marque").getAttribute("d") === "" && !racine.classList.contains("avec-ecole"));

console.log("RÉINITIALISATION");
clic(un(".nat__replier"));
clic(un(".nat__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ (école comprise)", etatDepart() === depart && /Rivière-du-Loup est Cacouna/.test(vue()), etatDepart());
verifier("Réinitialiser garde le texte masqué", racine.classList.contains("texte-masque"));
pincer();
clic(un(".nat__entete .reinitialiser"));
verifier("Réinitialiser ramène la carte entière", un(".nat__svg").getAttribute("viewBox") === vbDepart && un(".nat__recentrer").hidden);

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [un(".nat__lecture").textContent];
D.nations.forEach((n) => { racine.nat.choisir({ type: "nation", id: n.id }); textes.push(un(".nat__lecture").textContent); racine.nat.choisir(null); });
D.communautes.forEach((c) => { racine.nat.choisir({ type: "com", id: c.id }); textes.push(un(".nat__lecture").textContent); racine.nat.choisir(null); });
typographie(textes, [/31 décembre 2025/, /OpenStreetMap/, /Natural Earth/]);
fin();
