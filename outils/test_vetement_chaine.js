/*
 * Test de la chaîne d'un t-shirt (fiche de géographie 09) dans un DOM simulé.
 *     node outils/test_vetement_chaine.js [composant.html]
 * On vérifie les neuf étapes, les distances cumulées, les deux routes vers Montréal (Suez, cap),
 * la navigation (numéros, Précédent, Suivant, flèches, lieux de la carte), la désélection
 * (second clic, Échap), le zoom à deux doigts, Réinitialiser (page.js) et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "vetement-chaine.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("vetement-chaine");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const touche = (k) => racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const choix = () => racine.getAttribute("data-choix");
const titre = () => un(".vch__intertitre").textContent;
const vue = () => un(".vch__vue").textContent;
const numero = (n) => tous(".vch__numero")[n - 1];
const etatDepart = () => JSON.stringify(racine.vch.etat()) + "|" + tous(".vch__puce").map((b) => b.getAttribute("aria-pressed")).join() + "|" + titre();
const D = racine.vch.donnees;
const kmTexte = (n) => n.toLocaleString("fr-CA").replace(/\s/g, " ");

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("neuf étapes et neuf boutons numérotés", D.etapes.length === 9 && tous(".vch__numero").length === 9);
verifier("Brésil, Bangladesh et Canada colorés", tous(".vch__pays").length === 3);
verifier("cinq lieux sur la carte", tous(".vch__lieu").length === 5, tous(".vch__lieu").length);
verifier("six tracés (terre et mer)", tous(".vch__trace").length === 6);
verifier("distances plausibles (Mato Grosso-Santos, Santos-Chattogram par le cap, Suez, cap)",
  Math.abs(D.traces["terre-br"].km - 1572) < 30 && Math.abs(D.traces["mer-cap"].km - 16451) < 200 && Math.abs(D.traces.suez.km - 18279) < 200 && Math.abs(D.traces.cap.km - 23601) < 200,
  [D.traces["terre-br"].km, D.traces["mer-cap"].km, D.traces.suez.km, D.traces.cap.km].join());
verifier("au départ : vue d'ensemble, route par Suez", choix() === "" && racine.vch.etat().route === "suez" && /Du champ de coton au magasin/.test(titre()));
verifier("la vue d'ensemble liste les neuf étapes", tous(".vch__vue .vch__choisir").length === 9);
verifier("Précédent désactivé au départ", un(".vch__precedent").disabled);
verifier("data-reinitialiser et boutons de page.js", racine.hasAttribute("data-reinitialiser") && !!un(".vch__entete .reinitialiser") && !!un(".vch__entete .plein-ecran"));
const depart = etatDepart();
const totalSuez = racine.vch.etat().km;
verifier("total affiché dans la vue d'ensemble", vue().includes(kmTexte(totalSuez) + " km"), totalSuez);

console.log("ÉTAPES");
clic(numero(1));
verifier("étape 1 : le coton du Mato Grosso", choix() === "etape:0" && /coton pousse/.test(titre()) && /30,5/.test(vue()) && /70/.test(vue()));
verifier("le lieu actif est le Mato Grosso", un('.vch__lieu[data-lieu="mt"]').classList.contains("est-choisi"));
verifier("la carte se rapproche du Brésil", racine.vch.etat().vue !== JSON.parse(depart.split("|")[0]).vue);
clic(un(".vch__suivant"));
const km2 = D.traces["terre-br"].km + D.traces["mer-cap"].km;
verifier("étape 2 : deux océans, distance cumulée", choix() === "etape:1" && vue().includes(kmTexte(km2) + " km") && /23 %/.test(vue()));
verifier("les tracés de l'étape 2 sont actifs", un('.vch__trace[data-trace="mer-cap"]').classList.contains("est-actif") && un('.vch__trace[data-trace="terre-br"]').classList.contains("est-actif"));
verifier("les tracés suivants sont à venir", un('.vch__trace[data-trace="suez"]').classList.contains("est-futur"));
touche("ArrowRight");
verifier("flèche droite : filature", choix() === "etape:2" && /filature/i.test(titre()));
verifier("l'étape précédente est tracée comme faite", un('.vch__trace[data-trace="mer-cap"]').classList.contains("est-fait"));
touche("ArrowLeft");
verifier("flèche gauche : retour à l'étape 2", choix() === "etape:1");
clic(numero(6));
verifier("étape 6 : confection, pays atelier, salaire", /confection/i.test(titre()) && /pays atelier/.test(vue()) && /12 500 takas/.test(vue()) && /6,9 %/.test(vue()));
clic(numero(7));
verifier("étape 7 : Rana Plaza, 24 avril 2013, 1 134 morts", /Rana Plaza/.test(titre()) && /24 avril 2013/.test(vue()) && /1 134 morts/.test(vue()) && !!un(".vch__vue .vch__alerte"));
verifier("lieu en alerte pour le Rana Plaza", un('.vch__lieu[data-lieu="dhaka"]').classList.contains("est-alerte"));
clic(numero(8));
verifier("étape 8 : les deux routes comparées", /Suez/.test(vue()) && vue().includes(kmTexte(D.traces.suez.km) + " km") && vue().includes(kmTexte(D.traces.cap.km) + " km"));
verifier("la route par Suez est active, celle du cap à venir", un('.vch__trace[data-trace="suez"]').classList.contains("est-actif") && un('.vch__trace[data-trace="cap"]').classList.contains("est-futur"));
clic(un('.vch__route[data-route="cap"]'));
verifier("bouton cap : la route du cap devient active", racine.vch.etat().route === "cap" && un('.vch__trace[data-trace="cap"]').classList.contains("est-actif") && un('.vch__trace[data-trace="suez"]').classList.contains("est-futur"));
verifier("le total grandit par le cap", racine.vch.etat().km - totalSuez === D.traces.cap.km - D.traces.suez.km);
clic(un(".vch__suivant"));
verifier("étape 9 : vente à Montréal, Suivant désactivé", choix() === "etape:8" && /Montréal/.test(titre()) && un(".vch__suivant").disabled);
verifier("la jauge est pleine à la dernière étape", parseFloat(un(".vch__jauge > span").style.width) === 100);

console.log("DÉSÉLECTION ET LIEUX");
clic(numero(9));
verifier("un second clic sur le numéro actif revient à la vue d'ensemble", choix() === "");
clic(un('.vch__lieu[data-lieu="ctg"] circle'));
verifier("clic sur Chattogram : étape 2", choix() === "etape:1", choix());
clic(un('.vch__lieu[data-lieu="ctg"] circle'));
verifier("second clic sur Chattogram : désélection", choix() === "");
clic(un('.vch__lieu[data-lieu="dhaka"] circle'));
verifier("clic sur la région de Dhaka : filature", choix() === "etape:2");
touche("Escape");
verifier("Échap désélectionne", choix() === "");

console.log("ZOOM ET RÉINITIALISATION");
const carte = un(".vch__carte");
const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
const raf = window.requestAnimationFrame; window.requestAnimationFrame = undefined;
const d1 = toucher("touchstart", [doigt(300, 200, 1), doigt(340, 200, 2)]);
toucher("touchmove", [doigt(260, 200, 1), doigt(380, 200, 2)]);
toucher("touchend", []);
window.requestAnimationFrame = raf;
verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && carte.classList.contains("est-zoomee"));
clic(numero(8)); clic(un('.vch__route[data-route="cap"]'));
clic(un(".vch__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ (route par Suez)", etatDepart() === depart && !carte.classList.contains("est-zoomee"), etatDepart());

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [];
["suez", "cap"].forEach((r) => { clic(un(`.vch__route[data-route="${r}"]`)); D.etapes.forEach((e, i) => { racine.vch.aller(i); textes.push(un(".vch__lecture").textContent); }); racine.vch.choisir(null); textes.push(un(".vch__lecture").textContent); });
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((n) => n.remove());
const t = copie.textContent + textes.join(" ");
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(t));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
verifier("aucun « undefined » ni « NaN »", !/undefined|NaN/.test(t));
const ids = tous("[id]").map((n) => n.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées vch__", tous("[class]").every((n) => { const c = n.getAttribute("class"); return !c || /(^|\s)vch/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
verifier("sources citées (USDA, OMC, Natural Earth)", /USDA/.test(un(".vch__source").textContent) && /OMC/.test(un(".vch__source").textContent) && /Natural Earth/.test(un(".vch__source").textContent));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
