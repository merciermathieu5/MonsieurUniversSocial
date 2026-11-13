/*
 * Test des graphiques de la population de Montréal (fiche de géographie 02) dans un DOM simulé.
 *     node outils/test_population_montreal.js [composant.html]
 * On vérifie l'initialisation unique, les cinq thèmes, le choix d'une année dans chacun,
 * les chiffres affichés (tirés des sources citées), les courbes de l'île et de la ville,
 * Réinitialiser (page.js), le clavier et la typographie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "population-montreal.html");
const composant = fs.readFileSync(fichier, "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"></head><body><main><article class="fiche"><div class="texte">${composant}</div></article></main></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
window.eval(script);
const racine = window.document.getElementById("population-montreal");
let echecs = 0;
function verifier(nom, ok, detail) { console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`); if (!ok) echecs++; }
const un = (s) => racine.querySelector(s), tous = (s) => Array.from(racine.querySelectorAll(s));
const clic = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const NB = " ";
const lect = () => un(".mpo__lecture").textContent;
const vis = () => un(".mpo__visuel").textContent;
const theme = (v) => clic(un(`.mpo__segment[data-vue="${v}"]`));
const annee = (a) => clic(un(`.mpo__annee[data-annee="${a}"]`));
const etat = () => racine.mpo.etat();
const etatComplet = () => JSON.stringify(etat()) + "|" + tous(".mpo__segment").map((b) => b.getAttribute("aria-pressed")).join() + "|" + lect();
const n = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, NB);

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!racine && racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && tous(".mpo__visuel > *").length > 0 && tous(".mpo__lecture .mpo__intertitre").length === 1);
verifier("cinq thèmes, Population choisi au départ", tous(".mpo__segment").length === 5 && un('.mpo__segment[aria-pressed="true"]').getAttribute("data-vue") === "population");
verifier("data-reinitialiser sur la racine", racine.hasAttribute("data-reinitialiser"));
verifier("page.js ajoute Réinitialiser avant Plein écran", !!un(".mpo__entete .reinitialiser") && un(".mpo__entete .reinitialiser").nextElementSibling === un(".mpo__entete .plein-ecran"));
verifier("aucun titre h2 ou h3 dans le composant", !/<h[23][ >]/.test(composant));
const depart = etatComplet();

console.log("DONNÉES");
const D = racine.mpo.donnees;
verifier("13 recensements de 1961 à 2021 pour la population", D.pop.annees.length === 13 && D.pop.annees[0] === 1961 && D.pop.annees[12] === 2021 && D.pop.ile.length === 13 && D.pop.ville.length === 13);
verifier("île : aucun chiffre avant 1971, 2 004 265 en 2021", D.pop.ile[0] === null && D.pop.ile[1] === null && D.pop.ile[2] === 1959143 && D.pop.ile[12] === 2004265);
verifier("langue maternelle : chaque année totalise 100 %", D.lang.annees.every((a, k) => Math.abs(D.lang.fr[k] + D.lang.an[k] + D.lang.autre[k] + D.lang.plus[k] - 100) < 0.05));
verifier("pays de naissance : dix pays de 2001 à 2016, huit continents en 2021", ["2001", "2006", "2011", "2016"].every((a) => D.pays[a].length === 10) && D.pays["2021"].length === 8);
verifier("pays de naissance classés du plus grand au plus petit", Object.keys(D.pays).every((a) => D.pays[a].every((l, k, t) => k === 0 || t[k - 1][1] >= l[1])));
verifier("immigrants : neuf recensements, de 21,0 % à 33,3 %", D.imm.annees.length === 9 && D.imm.pc[0] === 21 && D.imm.pc[8] === 33.3);

console.log("POPULATION");
verifier("13 boutons d'année, 2021 choisi", tous(".mpo__annee").length === 13 && un('.mpo__annee[aria-pressed="true"]').getAttribute("data-annee") === "2021");
verifier("courbe de l'île (un tracé) et de la ville (deux tracés, coupés par les fusions)", tous(".mpo__ligne--ile").length === 1 && tous(".mpo__ligne--ville").length === 2 && !!un(".mpo__coupure"));
verifier("11 points pour l'île et 13 pour la ville", tous(".mpo__point--ile").length === 11 && tous(".mpo__point--ville").length === 13);
verifier("2021 : île 2 004 265, ville 1 762 949", lect().includes(n(2004265)) && lect().includes(n(1762949)));
annee(1986);
verifier("1986 : île 1 752 582 et creux de 206 561 habitants", etat().annee === 1986 && lect().includes(n(1752582)) && lect().includes(n(206561)));
verifier("1986 : variation depuis 1981 affichée avec un signe moins", lect().includes("−" + n(7540)));
annee(1961);
verifier("1961 : ville 1 191 062, pas de chiffre pour l'île", lect().includes(n(1191062)) && lect().includes("non affiché avant 1971"));
annee(2006);
verifier("2006 : la ville change de limites (fusions, 15 villes reconstituées)", lect().includes("Limites changées") && lect().includes("15 d'entre elles"));
clic(un(".mpo__cible[data-annee='2016']"));
verifier("un clic dans le graphique choisit l'année", etat().annee === 2016 && un('.mpo__annee[aria-pressed="true"]').getAttribute("data-annee") === "2016");
un(".mpo__cible[data-annee='1971']").dispatchEvent(new window.Event("pointerenter"));
verifier("le survol affiche une bulle avec les deux valeurs", !un(".mpo__bulle").hidden && un(".mpo__bulle").textContent.includes(n(1959143)) && un(".mpo__bulle").textContent.includes(n(1214352)));
clic(un('.mpo__serie[data-serie="ville"]'));
verifier("masquer la ville : seule l'île reste", tous(".mpo__ligne--ville").length === 0 && tous(".mpo__ligne--ile").length === 1 && un('.mpo__serie[data-serie="ville"]').getAttribute("aria-pressed") === "false");
clic(un('.mpo__serie[data-serie="ile"]'));
verifier("on ne peut pas tout masquer : la ville revient", tous(".mpo__ligne--ile").length === 0 && tous(".mpo__ligne--ville").length === 2);
clic(un('.mpo__serie[data-serie="ile"]'));
verifier("les deux courbes reviennent", tous(".mpo__ligne--ile").length === 1 && tous(".mpo__ligne--ville").length === 2);

console.log("IMMIGRANTS");
theme("immigrants");
verifier("thème Immigrants : neuf colonnes, 2021 choisi", etat().vue === "immigrants" && tous(".mpo__colonne").length === 9 && etat().annee === 2021);
verifier("2021 : 652 725 personnes, 33,3 %", lect().includes(n(652725)) && lect().includes("33,3" + NB + "%"));
verifier("2021 : les résidents non permanents sont expliqués", lect().includes(n(138240)));
annee(1981);
verifier("1981 : 369 585 personnes, 21,0 %", lect().includes(n(369585)) && lect().includes("21,0" + NB + "%") && tous(".mpo__colonne.est-choisie").length === 1);
annee(2011);
verifier("2011 : mise en garde sur l'ENM", lect().includes("Enquête nationale auprès des ménages"));

console.log("PAYS DE NAISSANCE");
theme("naissance");
const premier = () => un(".mpo__rang .mpo__rang-nom").textContent;
verifier("2016 au départ : Haïti au premier rang, dix barres", etat().annee === 2016 && premier() === "Haïti" && tous(".mpo__rang").length === 10);
annee(2001);
verifier("2001 : l'Italie au premier rang (11,5 %)", premier() === "Italie" && vis().includes("11,5" + NB + "%"));
annee(2021);
verifier("2021 : huit continents, l'Asie en tête", premier() === "Asie" && tous(".mpo__rang").length === 8 && lect().includes("continent"));

console.log("LANGUES");
theme("langues");
verifier("six barres empilées de 1996 à 2021, quatre parts chacune", tous(".mpo__pile").length === 6 && tous(".mpo__part").length === 24);
verifier("légende des quatre catégories", tous(".mpo__cle").length === 4);
verifier("2021 : français 43,8 % et note sur la compilation", lect().includes("43,8" + NB + "%") && lect().includes("autre compilation"));
clic(un('.mpo__pile[data-annee="1996"]'));
verifier("un clic sur la barre de 1996 la choisit (français 52,1 %)", etat().annee === 1996 && lect().includes("52,1" + NB + "%") && un('.mpo__pile[aria-pressed="true"]').getAttribute("data-annee") === "1996");
verifier("langues parlées à la maison en 2016 : l'arabe en tête", tous(".mpo__visuel .mpo__rang")[0].textContent.includes("Arabe"));

console.log("DIVERSITÉ DES ORIGINES");
theme("minorites");
verifier("trois colonnes, 2021 : 37,6 %", tous(".mpo__colonne").length === 3 && lect().includes("37,6" + NB + "%"));
verifier("expression « groupes racisés » définie, ancienne expression nommée", lect().includes("groupes racisés") && lect().includes("autochtones") && lect().includes("minorités visibles"));
verifier("le bouton du thème s'appelle Diversité des origines", un('.mpo__segment[data-vue="minorites"]').textContent === "Diversité des origines");
verifier("huit groupes de 2016", tous(".mpo__rang").length === 8);

console.log("CLAVIER ET RÉINITIALISATION");
const b2016 = un('.mpo__annee[data-annee="2016"]');
b2016.focus();
b2016.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
verifier("flèche droite : année suivante, le focus suit", etat().annee === 2021 && window.document.activeElement === un('.mpo__annee[data-annee="2021"]'));
theme("population"); annee(1976);
clic(un('.mpo__serie[data-serie="ville"]'));
clic(un(".mpo__entete .reinitialiser"));
verifier("Réinitialiser ramène l'état exact du départ", etatComplet() === depart, JSON.stringify(etat()));

console.log("SOURCES");
const sources = {};
["population", "immigrants", "naissance", "langues", "minorites"].forEach((v) => { theme(v); sources[v] = un(".mpo__source").textContent; });
verifier("chaque thème nomme ses sources (Statistique Canada)", Object.values(sources).every((s) => /Statistique Canada/.test(s) && s.length > 80));
verifier("chaque thème a un encadré « Ce qu'il faut retenir » et un tableau", ["population", "immigrants", "naissance", "langues", "minorites"].every((v) => { theme(v); return !!un(".mpo__retenir") && !!un(".mpo__table"); }));

console.log("TYPOGRAPHIE ET STRUCTURE");
const textes = [];
const vues = { population: D.pop.annees, immigrants: D.imm.annees, naissance: [2001, 2006, 2011, 2016, 2021], langues: D.lang.annees, minorites: D.vm.annees };
Object.keys(vues).forEach((v) => { theme(v); vues[v].forEach((a) => { racine.mpo.choisirAnnee(a); textes.push(un(".mpo__visuel").textContent, lect(), un(".mpo__source").textContent); tous("[aria-label], [title]").forEach((e) => textes.push(e.getAttribute("aria-label") || "", e.getAttribute("title") || "")); }); });
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script, svg").forEach((x) => x.remove());
const t = copie.textContent + " " + textes.join(" ") + " " + racine.getAttribute("aria-label");
verifier("aucun tiret cadratin ou demi-cadratin (texte et fichier)", !/[–—]/.test(t) && !/[–—]/.test(composant));
verifier("aucune virgule devant « et »", !/, et /.test(t));
verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(t));
verifier("espace insécable devant les deux-points", !/ :/.test(t));
verifier("espace insécable devant le signe %", !/ %/.test(t));
verifier("jamais la ligature œ (coeur, oeuvre)", !/[œŒ]/.test(t) && !/[œŒ]/.test(composant));
const ids = tous("[id]").map((x) => x.id).concat([racine.id]);
verifier("aucun id en double", new Set(ids).size === ids.length);
verifier("classes préfixées mpo__", tous("[class]").every((x) => { const c = x.getAttribute("class"); return !c || /(^|\s)mpo/.test(c) || /reinitialiser|plein-ecran|entete-actions/.test(c); }));
verifier("toutes les listes neutralisent les puces", /list-style: none/.test(composant) && /::marker/.test(composant) && /li::before/.test(composant));
verifier("variante sombre prévue", /html\[data-sombre="on"\] \.mpo \{/.test(composant));
console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
