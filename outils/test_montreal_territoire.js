/*
 * Test de la carte du territoire de la région métropolitaine (fiche de géographie 02) dans un DOM simulé.
 *     node outils/test_montreal_territoire.js [composant.html]
 * On vérifie les 82 municipalités et les cinq secteurs, le choix d'un secteur ou d'une ville,
 * les 19 arrondissements, les ponts de l'île, la désélection (second clic, Échap), les couches,
 * le mode « Teste tes connaissances » (lettres des cours d'eau, chiffres des secteurs),
 * le zoom à deux doigts, Réinitialiser (page.js) et la typographie.
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

console.log("ARRONDISSEMENTS");
verifier("19 arrondissements dessinés", tous(".mtt__arr").length === 19);
verifier("population des arrondissements : 1 762 949 en tout (2021)", racine.mtt.arr().reduce((s, a) => s + a.pop, 0) === 1762949);
clic(un('.mtt__arr[data-arr="rosemont-la-petite-patrie"]'));
verifier("un clic sur Rosemont-La Petite-Patrie ouvre sa fiche", choix() === "arr:rosemont-la-petite-patrie" && /141 813/.test(un(".mtt__vue").textContent) && /3e sur 19/.test(un(".mtt__vue").textContent));
verifier("l'arrondissement choisi est entouré", un(".mtt__choix").getAttribute("d") === un('.mtt__arr[data-arr="rosemont-la-petite-patrie"]').getAttribute("d"));
clic(tous(".mtt__vue .mtt__retour")[0]);
verifier("depuis l'arrondissement, on revient à la ville de Montréal", choix() === "ville:montreal" && tous(".mtt__vue .mtt__liste .mtt__choisir").length === 19);
clic(tous(".mtt__vue .mtt__liste .mtt__choisir").find((b) => /Verdun/.test(b.textContent)));
verifier("la liste de la ville ouvre un arrondissement", choix() === "arr:verdun");
clic(un('.mtt__couche[data-couche="arrondissements"]'));
verifier("masquer les arrondissements : on revient à la ville et leurs limites disparaissent", choix() === "ville:montreal" && !racine.classList.contains("avec-arrondissements"));
clic(un('.mtt__couche[data-couche="arrondissements"]'));
touche("Escape");

console.log("COUCHES");
clic(un('.mtt__couche[data-couche="villes"]'));
verifier("masquer les villes : la ville devient son secteur, plus de noms de villes", !racine.classList.contains("avec-villes") && tous(".mtt__etiquette--ville").length === 0);
clic(ville("mirabel"));
verifier("sans les villes, un clic choisit le secteur", choix() === "secteur:nord");
clic(un('.mtt__couche[data-couche="ponts"]'));
verifier("la couche des ponts affiche 15 ponts et le tunnel", tous(".mtt__pont-groupe").length === 16 && tous(".mtt__pont-tablier--tunnel").length === 1, tous(".mtt__pont-groupe").length);
clic(un('.mtt__pont-groupe[data-pont="jacques-cartier"] .mtt__pont-prise'));
verifier("un clic sur le pont Jacques-Cartier ouvre sa fiche", choix() === "pont:jacques-cartier" && titre() === "Pont Jacques-Cartier" && /1930/.test(un(".mtt__vue").textContent));
verifier("le pont choisi est mis en valeur", !!un('.mtt__pont-groupe.est-choisi[data-pont="jacques-cartier"]'));
clic(un('.mtt__pont-groupe[data-pont="jacques-cartier"] .mtt__pont-prise'));
verifier("un second clic sur le pont désélectionne", choix() === "");
clic(un('.mtt__couche[data-couche="eau"]'));
verifier("masquer les cours d'eau retire leurs noms", tous(".mtt__etiquette--eau").length === 0 && !racine.classList.contains("avec-eau"));
clic(un(".mtt__zoom-plus"));
verifier("le bouton + rapproche la carte", un(".mtt__svg").getAttribute("viewBox") !== "0 0 1000 892" && !un(".mtt__recentrer").hidden);

console.log("MODE TEST");
const Q = racine.mtt.questions();
const parNom = Object.fromEntries(Q.map((x) => [x.bonne, x]));
const barreTitre = () => un(".mtt__repondre-titre").textContent;
const choixBarre = () => tous(".mtt__repondre-choix button");
const choisirNom = (nom) => clic(choixBarre().find((b) => b.textContent === nom));
const repere = (cle) => un(`.mtt__repere[data-repere="${cle}"] circle`);
const reponsesCarte = () => tous(".mtt__etiquette--reponse").map((t) => t.textContent);
const resultat = () => (un(".mtt__resultat") || { textContent: "" }).textContent;
verifier("12 questions : 7 cours d'eau (A à G) et 5 secteurs (1 à 5)", Q.length === 12 && Q.filter((x) => x.sorte === "eau").map((x) => x.marque).join("") === "ABCDEFG" && Q.filter((x) => x.sorte === "secteur").map((x) => x.marque).join("") === "12345");
verifier("le fleuve, la rivière des Mille Îles et la couronne sud ont deux repères (même lettre ou chiffre)", parNom["Fleuve Saint-Laurent"].reperes === 2 && parNom["Rivière des Mille Îles"].reperes === 2 && parNom["Couronne sud"].reperes === 2 && Q.every((x) => x.reperes >= 1));
const boutonTest = un('.mtt__mode[data-mode="test"]'), boutonExplorer = un('.mtt__mode[data-mode="explorer"]');
verifier("deux modes au départ : Explorer est enfoncé, la barre de réponse est cachée", boutonExplorer.getAttribute("aria-pressed") === "true" && boutonTest.getAttribute("aria-pressed") === "false" && un(".mtt__repondre").hidden);
clic(boutonTest);
verifier("le bouton Teste tes connaissances ouvre le test", racine.classList.contains("est-quiz") && boutonTest.getAttribute("aria-pressed") === "true" && titre() === "Les cours d'eau et les secteurs" && /lettre ou un chiffre/.test(un(".mtt__consigne").textContent));
verifier("la barre sous la carte s'ouvre sur la lettre A, avec les 7 noms de cours d'eau", !un(".mtt__repondre").hidden && /Cours d'eau A/.test(barreTitre()) && choixBarre().length === 7 && un('.mtt__repere[data-repere="eau:A"]').classList.contains("est-actif"));
const noms = choixBarre().map((b) => b.textContent);
verifier("les noms sont en ordre alphabétique, pas dans l'ordre des lettres", noms.join("|") === noms.slice().sort((x, y) => x.localeCompare(y, "fr")).join("|") && Q.filter((x) => x.sorte === "eau").map((x) => noms.indexOf(x.bonne)).join() !== "0,1,2,3,4,5,6");
verifier("15 repères sur la carte (9 lettres, 6 chiffres)", tous(".mtt__repere").length === 15 && tous(".mtt__repere--eau").length === 9 && tous(".mtt__repere--secteur").length === 6, tous(".mtt__repere").length);
verifier("aucun nom sur la carte au départ (ni secteur, ni ville, ni cours d'eau)", tous(".mtt__etiquette--secteur, .mtt__etiquette--ville, .mtt__etiquette--eau, .mtt__etiquette--arr, .mtt__etiquette--pont, .mtt__etiquette--reponse").length === 0);
verifier("carte sans couleurs de secteurs, avec l'eau, même si la couche de l'eau était masquée", !racine.classList.contains("avec-secteurs") && !racine.classList.contains("avec-villes") && racine.classList.contains("avec-eau"));
choisirNom("Lac des Deux Montagnes");
verifier("choisir un nom l'écrit sur la carte, à côté du repère", reponsesCarte().includes("Lac des Deux Montagnes"));
verifier("on passe tout seul à la lettre B", /Cours d'eau B/.test(barreTitre()) && un('.mtt__repere[data-repere="eau:B"]').classList.contains("est-actif"));
verifier("la progression suit : 1 réponse choisie sur 12", /1 réponse choisie sur 12/.test(un(".mtt__repondre-etat").textContent) && /1 réponse choisie sur 12/.test(un(".mtt__progres").textContent));
clic(repere("secteur:3"));
verifier("toucher le chiffre 3 sur la carte : la barre propose les 5 secteurs", /Secteur 3/.test(barreTitre()) && choixBarre().length === 5);
clic(un('.mtt__repondre-nav[data-pas="1"]'));
verifier("le bouton › passe au repère suivant (4)", /Secteur 4/.test(barreTitre()));
clic(un('.mtt__repondre-nav[data-pas="-1"]')); clic(un('.mtt__repondre-nav[data-pas="-1"]'));
verifier("le bouton ‹ revient en arrière (2)", /Secteur 2/.test(barreTitre()));
clic(repere("eau:A"));
verifier("la réponse déjà choisie est enfoncée quand on revient sur un repère", choixBarre().find((b) => b.getAttribute("aria-pressed") === "true").textContent === "Lac des Deux Montagnes");
choisirNom("Lac des Deux Montagnes");
verifier("toucher de nouveau le nom enfoncé efface la réponse", !reponsesCarte().includes("Lac des Deux Montagnes") && /0 réponse choisie/.test(un(".mtt__progres").textContent));
// tout répondre en suivant l'avancement automatique, avec une erreur (C) et un oubli (5)
clic(repere("eau:A"));
const faux = { "eau:C": "Rivière des Mille Îles" };
for (let i = 0; i < 11; i++) {
  const cle = Q.find((x) => barreTitre().includes((x.sorte === "eau" ? "Cours d'eau " : "Secteur ") + x.marque)).cle;
  if (cle === "secteur:5") { clic(un('.mtt__repondre-nav[data-pas="1"]')); continue; }
  choisirNom(faux[cle] || Q.find((x) => x.cle === cle).bonne);
}
verifier("11 réponses choisies, le bouton Vérifier de la barre n'apparaît qu'une fois tout choisi", /11 réponses choisies/.test(un(".mtt__progres").textContent) && !un(".mtt__verifier-carte"));
clic(un(".mtt__verifier"));
verifier("Vérifier (panneau) : 10 bonnes réponses sur 12", /Tu as 10 bonnes réponses sur 12/.test(resultat()) && /10 bonnes réponses/.test(un(".mtt__repondre-etat").textContent), resultat());
verifier("repères verts et rouges sur la carte, réponse fausse barrée", tous(".mtt__repere.est-faux").length === 3 && tous(".mtt__repere.est-juste").length === 12 && !!un(".mtt__etiquette--reponse.est-faux"));
verifier("la barre se place sur la première réponse à revoir (C) et l'indique", /Cours d'eau C/.test(barreTitre()) && /À revoir/.test(barreTitre()));
verifier("la liste du panneau suit : coches et aria-invalid", un('li[data-repere="eau:A"] .mtt__coche').textContent === "✓" && un('li[data-repere="eau:C"] .mtt__coche').textContent === "✗" && un('li[data-repere="eau:C"] select').getAttribute("aria-invalid") === "true" && /Sans réponse/.test(un('li[data-repere="secteur:5"] .mtt__verdict').textContent));
verifier("le bouton Voir les bonnes réponses apparaît", !un(".mtt__voir").hidden);
clic(un(".mtt__voir"));
verifier("Voir les bonnes réponses les écrit sur la carte et dans la liste", reponsesCarte().some((t) => /Rivière des Prairies/.test(t) && /→/.test(t)) && /La bonne réponse : Rivière des Prairies/.test(un('li[data-repere="eau:C"] .mtt__verdict').textContent) && un(".mtt__voir").hidden);
const testEcrit = un(".mtt__lecture").textContent + " " + un(".mtt__repondre").textContent;
choisirNom("Rivière des Prairies");
verifier("corriger C efface seulement sa correction, les autres repères restent marqués", !un('.mtt__repere[data-repere="eau:C"]').classList.contains("est-faux") && tous(".mtt__repere.est-juste").length === 12 && resultat() === "");
verifier("on passe tout seul à la prochaine réponse à revoir (5)", /Secteur 5/.test(barreTitre()));
choisirNom("Couronne sud");
verifier("tout choisi : le bouton Vérifier apparaît dans la barre", !!un(".mtt__verifier-carte"));
clic(un(".mtt__verifier-carte"));
verifier("tout juste : Bravo, 15 repères verts", /Bravo/.test(resultat()) && tous(".mtt__repere.est-juste").length === 15 && un(".mtt__voir").hidden);
const listeSel = un('li[data-repere="eau:D"] select');
listeSel.value = "Bassin de La Prairie"; listeSel.dispatchEvent(new window.Event("change", { bubbles: true }));
verifier("répondre avec la liste du panneau met aussi la carte à jour", reponsesCarte().includes("Bassin de La Prairie") && !un('.mtt__repere[data-repere="eau:D"]').classList.contains("est-juste"));
clic(un(".mtt__explorer"));
verifier("Revenir à l'exploration : accueil, couleurs et couches d'avant, plus de barre", !racine.classList.contains("est-quiz") && /82 municipalités/.test(titre()) && racine.classList.contains("avec-secteurs") && !racine.classList.contains("avec-villes") && !racine.classList.contains("avec-eau") && tous(".mtt__repere").length === 0 && un(".mtt__repondre").hidden);
clic(un(".mtt__vers-test"));
verifier("le bouton de l'accueil rouvre le test, avec les réponses gardées", racine.classList.contains("est-quiz") && reponsesCarte().includes("Fleuve Saint-Laurent"));
clic(un(".mtt__recommencer"));
verifier("Recommencer efface tout et revient à la lettre A", reponsesCarte().length === 0 && resultat() === "" && /Cours d'eau A/.test(barreTitre()) && tous(".mtt__questions select").every((sel) => sel.value === ""));
clic(boutonTest);
verifier("un second clic sur Teste tes connaissances ne change rien", racine.classList.contains("est-quiz"));
choisirNom("Lac des Deux Montagnes");
const svgEl = un(".mtt__svg"), rectOrig = svgEl.getBoundingClientRect;
/* La carte est déjà rapprochée (bouton +) : on simule un très petit écran. */
svgEl.getBoundingClientRect = () => ({ width: 200, height: 178, left: 0, top: 0, right: 200, bottom: 178, x: 0, y: 0 });
choisirNom("Rivière des Mille Îles");
verifier("petite carte (téléphone) : pas de noms sur la carte, repères répondus marqués, conseil de rapprocher", reponsesCarte().length === 0 && un('.mtt__repere[data-repere="eau:A"]').classList.contains("est-repondu") && /Rapproche la carte/.test(un(".mtt__repondre-etat").textContent));
svgEl.getBoundingClientRect = rectOrig;
clic(un(".mtt__zoom-moins")); /* un changement de vue redessine la carte, comme un redimensionnement */
verifier("grande carte : les noms reviennent", reponsesCarte().includes("Lac des Deux Montagnes") && reponsesCarte().includes("Rivière des Mille Îles"));
clic(ville("terrebonne"));
verifier("en mode test, toucher une ville n'ouvre pas de fiche", choix() === "" && racine.classList.contains("est-quiz") && titre() === "Les cours d'eau et les secteurs");
console.log("RÉINITIALISATION");
clic(un(".mtt__replier"));
clic(un(".mtt__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ, hors du mode test", etatDepart() === depart && !racine.classList.contains("est-quiz"), etatDepart());
verifier("Réinitialiser garde le texte masqué", racine.classList.contains("texte-masque"));
const carte = un(".mtt__carte");
const doigt = (x, y, id) => ({ clientX: x, clientY: y, identifier: id, target: carte });
const toucher = (type, liste) => { const ev = new window.Event(type, { bubbles: true, cancelable: true }); ev.touches = liste; carte.dispatchEvent(ev); return ev; };
const avant = un(".mtt__svg").getAttribute("viewBox"), raf = window.requestAnimationFrame;
window.requestAnimationFrame = undefined;
const d1 = toucher("touchstart", [doigt(300, 300, 1), doigt(340, 300, 2)]);
toucher("touchmove", [doigt(260, 300, 1), doigt(380, 300, 2)]);
toucher("touchend", []);
window.requestAnimationFrame = raf;
verifier("pincer à deux doigts rapproche la carte", d1.defaultPrevented && un(".mtt__svg").getAttribute("viewBox") !== avant && carte.classList.contains("est-zoomee"), un(".mtt__svg").getAttribute("viewBox"));
clic(un(".mtt__entete .reinitialiser"));
verifier("Réinitialiser ramène la carte entière", un(".mtt__svg").getAttribute("viewBox") === "0 0 1000 892" && un(".mtt__recentrer").hidden);

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [];
const vu = new Set();
function parcourir() { textes.push(racine.querySelector(".mtt__lecture").textContent); }
parcourir();
["montreal", "laval", "longueuil", "nord", "sud"].forEach((k) => { racine.mtt.choisir({ type: "secteur", id: k }); parcourir(); racine.mtt.choisir(null); });
["montreal", "l-ile-dorval", "terrebonne", "westmount"].forEach((k) => { racine.mtt.choisir({ type: "ville", id: k }); parcourir(); racine.mtt.choisir(null); });
racine.mtt.arr().forEach((a) => { racine.mtt.choisir({ type: "arr", id: a.id }); parcourir(); racine.mtt.choisir(null); });
racine.mtt.ponts().forEach((p) => { racine.mtt.choisir({ type: "pont", id: p.id }); parcourir(); racine.mtt.choisir(null); });
textes.push(testEcrit);
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
