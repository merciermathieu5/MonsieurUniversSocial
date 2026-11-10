/*
 * Test de la déforestation de l'Amazonie, année par année (fiche de géographie 06) dans un DOM simulé.
 *     node outils/test_amazonie_deforestation.js [composant.html]
 */
/* Partie commune des tests du lot : DOM simulé, page.js, outils. ID et PFX sont remplacés. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "amazonie-deforestation.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("amazonie-deforestation");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".amz__intertitre").textContent;
const api = racine.amz;
const etatDepart = () => JSON.stringify(api.etat()) + "|" + tous(".amz__couche, .amz__segment").map((b) => b.getAttribute("aria-pressed")).join() + "|" + racine.className.split(" ").filter((c) => c && c !== "texte-masque").sort().join(" ") + "|" + titre();
function pincer() {
  const carte = un(".amz__carte");
  const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
  const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
  const avant = un(".amz__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = undefined;
  const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
  toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
  toucher("touchend", []);
  window.requestAnimationFrame = raf;
  verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un(".amz__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un(".amz__svg").getAttribute("viewBox"));
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
  verifier("classes préfixées amz__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)amz/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
  verifier("sources citées", un(".amz__source").textContent.length > 80);
}
function fin() { console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme."); process.exit(echecs ? 1 : 0); }

const nbsp = (s) => s.replace(/[  ]/g, " ");
const vue = () => nbsp(un(".amz__vue").textContent);
console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("data-reinitialiser et bouton Réinitialiser de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".amz__entete .reinitialiser"));
verifier("neuf États de l'Amazonie légale", tous(".amz__etat").length === 9);
verifier("39 colonnes de 1988 à 2026, six repères", tous(".amz__colonne").length === 39 && tous(".amz__jalon").length === 6);
verifier("au départ : 2025-2026, 3 335 km², estimation, le plus bas", racine.getAttribute("data-annee") === "2026" && /3 335 km²/.test(vue()) && /Estimation/.test(vue()) && /le plus bas depuis 1988/.test(vue()));
verifier("l'accueil liste les neuf États, Pará en tête (1 130 km², 34 %)", tous(".amz__vue .amz__choisir").length >= 12 && tous(".amz__vue .amz__choisir").some((b) => /^Pará1 130 km² · 34 %$/.test(nbsp(b.textContent))));
verifier("noms d'États et valeurs sur la carte", tous(".amz__etiquette--etat").length >= 5 && tous(".amz__etiquette--val").length >= 5);
const depart = etatDepart();

console.log("ANNÉES");
clic(un('.amz__colonne[data-annee="2004"]'));
verifier("clic sur 2004 : 27 772 km², Mato Grosso au plus foncé", racine.getAttribute("data-annee") === "2004" && /27 772 km²/.test(vue()) && un('.amz__etat[data-etat="MT"]').getAttribute("data-c") === "5");
verifier("variation et rang calculés", /\+9,4 %/.test(vue()) && /2e plus haut sur 39/.test(vue()));
const curseur = un(".amz__annee");
curseur.value = "7"; curseur.dispatchEvent(new window.Event("input", { bubbles: true }));
verifier("le curseur mène à 1995, le record de la série", racine.getAttribute("data-annee") === "1995" && /29 059/.test(vue()) && /le plus haut depuis 1988/.test(vue()));
clic(un(".amz__pas--moins"));
verifier("le bouton précédent mène à 1994 (valeur moyenne 1993-1994)", racine.getAttribute("data-annee") === "1994" && /même valeur moyenne/.test(vue()));
clic(un('.amz__colonne[data-annee="2025"]'));
verifier("2025 : chiffre définitif 5 731 et estimation 5 796 rappelée", /5 731 km²/.test(vue()) && /5 796/.test(vue()));

console.log("ÉTATS");
clic(un('.amz__etat[data-etat="PA"]'));
verifier("un clic sur le Pará ouvre sa fiche (2 064 km², record 2003-2004)", choix() === "etat:PA" && /2 064 km²/.test(vue()) && /2003-2004 · 8 870 km²/.test(vue()) && /Belém/.test(vue()));
verifier("sa part apparaît dans le graphique", Number(tous(".amz__partie")[37].getAttribute("height")) > 0 && racine.classList.contains("avec-etat"));
clic(un('.amz__colonne[data-annee="2012"]'));
verifier("changer d'année garde l'État choisi", choix() === "etat:PA" && /1 741 km²/.test(vue()));
clic(un('.amz__etat[data-etat="PA"]'));
verifier("un second clic désélectionne", choix() === "" && Number(tous(".amz__partie")[37].getAttribute("height")) === 0);
clic(un('.amz__etat[data-etat="MA"]'));
verifier("Maranhão : seul l'ouest compte", /44e méridien/.test(vue()));
touche("Escape");
verifier("Échap désélectionne", choix() === "");

console.log("REPÈRES ET CAUSES");
clic(un('.amz__jalon[data-jalon="2004"] circle'));
verifier("le repère 1 ouvre le PPCDAm et passe à 2004", choix() === "jalon:2004" && racine.getAttribute("data-annee") === "2004" && /PPCDAm/.test(vue()) && /84 %/.test(vue()));
tous(".amz__vue .amz__retour").find((b) => /suivant/.test(b.textContent)).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("repère suivant : moratoire du soja (2006)", choix() === "jalon:2006" && racine.getAttribute("data-annee") === "2006");
clic(un('.amz__jalon[data-jalon="2006"] circle'));
verifier("un second clic sur le repère le ferme", choix() === "" && racine.getAttribute("data-annee") === "2006");
clic(un('.amz__colonne[data-annee="2026"]'));
clic(tous(".amz__vue .amz__choisir").find((b) => /routes/i.test(b.textContent)));
verifier("la cause « routes » cite l'étude de 2014 (95 %)", choix() === "cause:routes" && /95 %/.test(vue()));
clic(un('.amz__couche[data-couche="routes"]'));
verifier("la couche des routes s'affiche", un(".amz__routes").style.display === "" && un(".amz__routes").getAttribute("d").length > 1000);
clic(un('.amz__segment[data-mode="cumul"]'));
verifier("mode total : le Pará dépasse 100 000 km²", racine.getAttribute("data-mode") === "cumul" && un('.amz__etat[data-etat="PA"]').getAttribute("data-c") === "5");
pincer();

console.log("RÉINITIALISATION");
clic(un(".amz__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatDepart() === depart, etatDepart());

const textes = [];
const lire = () => textes.push(un(".amz__lecture").textContent, un(".amz__cles").textContent);
api.donnees.annees.forEach((a) => { api.annee(a); lire(); });
api.mode("cumul"); lire(); api.mode("annee");
api.donnees.ordre.forEach((e) => { api.choisir({ type: "etat", id: e }); lire(); api.choisir(null); });
["elevage", "soja", "routes"].forEach((c) => { api.choisir({ type: "cause", id: c }); lire(); api.choisir(null); });
[2004, 2006, 2012, 2019, 2023, 2026].forEach((j) => { api.choisir({ type: "jalon", id: String(j) }); lire(); api.choisir(null); });
textes.push(tous(".amz__graphe title").map((t) => t.textContent).join(" "));
typographie(textes);
fin();
