/*
 * Test de l'onglet « Mon trajet en métro » de la carte du transport (fiche de géographie 02) dans un DOM simulé.
 *     node outils/test_montreal_trajet.js [composant.html]
 * On vérifie les onglets, le plan schématique (4 lignes, 68 stations, 4 correspondances, trains de banlieue), le choix du départ
 * (liste et clic sur le plan, y compris à bord d'un train qui entre sur le plan), la direction et le nombre de stations, l'arrêt aux correspondances,
 * le changement de ligne, les trajets en train de banlieue, le journal, le défi, l'onglet Exerce-toi, les repères et Réinitialiser.
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
const filer = () => { while (etat().phase === "pause") T.rester(); };
const dir = (l, s) => un(`.mtrj__dir[data-ligne="${l}"][data-sens="${s}"]`);

console.log("ONGLETS");
const onglets = tous(".mtr__onglet");
verifier("trois onglets, le réseau ouvert au départ", onglets.length === 3 && racine.getAttribute("data-onglet") === "reseau" && onglets[0].getAttribute("aria-selected") === "true");
clic(onglets[1]);
verifier("l'onglet Mon trajet s'ouvre et change le titre", racine.getAttribute("data-onglet") === "trajet" && /Mon trajet/.test(un(".mtr__titre").textContent) && onglets[1].getAttribute("aria-selected") === "true");
clic(onglets[0]);
verifier("retour au réseau : titre d'origine", racine.getAttribute("data-onglet") === "reseau" && /par étages/.test(un(".mtr__titre").textContent));
clic(onglets[1]);

console.log("PLAN SCHÉMATIQUE");
verifier("4 lignes du métro", tous(".mtrj__ligne").length === 4);
verifier("68 stations", tous(".mtrj__station:not(.mtrj__station--entree)").length === 68, tous(".mtrj__station").length);
verifier("5 entrées en train, au bout des flèches", tous(".mtrj__station--entree").length === 5);
verifier("4 stations de correspondance", tous(".mtrj__station--corresp").map((g) => g.getAttribute("data-station")).sort().join() === "berri-uqam,jean-talon,lionel-groulx,snowdon");
verifier("68 noms de station affichés", tous(".mtrj__nom").length === 68);
verifier("5 lignes de trains de banlieue, chacune avec sa direction", tous(".mtrj__banlieue").length === 5 && tous(".mtrj__banlieue-nom--fort").map((n) => n.textContent).join("|") === "Direction Blainville-Saint-Jérôme|Direction Deux-Montagnes|Direction Dorion-Rigaud|Direction Delson-Candiac|Direction Mont-Saint-Hilaire");
verifier("5 stations intermodales", tous(".mtrj__gares .mtrj__intermodale").map((n) => n.getAttribute("data-station")).sort().join() === "bonaventure,de-la-concorde,lucien-l-allier,parc,vendome");

console.log("DÉPART");
verifier("au départ : choisir une station (liste de 68 stations et de 5 trains)", etat().phase === "depart" && tous(".mtrj__liste option").length === 74 && tous(".mtrj__liste optgroup").length === 2);
const liste = un(".mtrj__liste");
liste.value = "vendome"; liste.dispatchEvent(new window.Event("change", { bubbles: true }));
verifier("la liste fixe le départ à Vendôme", etat().pos === "vendome" && etat().phase === "choix");
verifier("Vendôme : deux directions sur la ligne orange et quatre choix de train", tous(".mtrj__dir").length === 6 && !!dir("orange", "1") && !!dir("orange", "-1") && tous(".mtrj__dir--train").length === 4);
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
verifier("nouvel arrêt à Lucien-L'Allier, station intermodale", etat().phase === "pause" && etat().pos === "lucien-l-allier" && /station intermodale/.test(cmd()));
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
verifier("défi d'Angrignon à Saint-Michel : trajet le plus court de 15 stations, par le train de Vendôme à Parc", etat().defi.min === 15 && /Défi/.test(cmd()) && !!un(".mtrj__repere--but"));
T.choisirDirection("verte", 1); T.regler(7); T.partir();
verifier("arrivée à Lionel-Groulx après 7 stations", etat().phase === "choix" && etat().pos === "lionel-groulx");
 T.choisirDirection("orange", -1); T.regler(4); T.partir(); filer();
verifier("Snowdon atteint", etat().pos === "snowdon");
T.choisirDirection("bleue", 1); T.regler(11); T.partir();
verifier("arrêt à Parc, station intermodale", etat().phase === "pause" && etat().pos === "parc"); T.rester();
verifier("passage à Jean-Talon", etat().phase === "pause" && etat().pos === "jean-talon"); T.rester();
verifier("défi réussi sans le train, en 22 stations", etat().phase === "fin" && etat().defi.reussi && etat().bilan.stations === 22, JSON.stringify(etat()));
verifier("le bilan compare au trajet le plus court", /plus court compte 15 stations/.test(cmd()));

console.log("TRAINS DE BANLIEUE");
T.recommencer(); T.choisirDepart("de-la-concorde");
verifier("De la Concorde : le train de Blainville-Saint-Jérôme dans les deux sens", !!dir("sj", "1") && !!dir("sj", "-1") && dir("sj", "-1").getAttribute("data-sortie") === "1");
clic(dir("sj", "1"));
for (let i = 0; i < 9; i++) clic(bouton(".mtrj__plus"));
verifier("trois arrêts au plus jusqu'à Lucien-L'Allier", etat().n === 3);
T.regler(1); clic(bouton(".mtrj__partir"));
verifier("un arrêt en train : De la Concorde à Parc", etat().pos === "parc" && etat().phase === "choix" && etat().bilan.stations === 1);
verifier("le journal nomme le train", /Train de Blainville-Saint-Jérôme, direction Lucien-L'Allier\s:\s1 station, de De la Concorde à Parc/.test(un(".mtrj__journal").textContent), un(".mtrj__journal").textContent);
T.choisirDirection("sj", 1); T.regler(2); T.partir();
verifier("le train s'arrête à Vendôme, où passe la ligne orange", etat().phase === "pause" && etat().pos === "vendome" && /ligne orange/.test(cmd()));
T.descendre(); T.choisirDirection("orange", 1); T.regler(1); T.partir();
verifier("correspondance du train au métro notée au journal", etat().pos === "place-saint-henri" && etat().bilan.corresp === 1 && /du train de Blainville-Saint-Jérôme à la ligne orange/.test(un(".mtrj__journal").textContent));
T.recommencer(); T.choisirDepart("vendome");
verifier("vers Lucien-L'Allier, les trois trains forment un seul choix", T.options().filter((o) => o.s > 0 && o.l !== "orange").length === 1 && /Train de banlieue, direction/.test(dir("sj", "1").textContent));
T.recommencer(); T.choisirDepart("bonaventure");
verifier("Bonaventure : deux trains qui sortent du plan", tous('.mtrj__dir[data-sortie="1"]').length === 2);
clic(dir("dm", "-1"));
verifier("sortie du plan : pas de nombre de stations à choisir", !bouton(".mtrj__plus") && /quitte le plan/.test(cmd()));
clic(bouton(".mtrj__partir"));
verifier("le trajet se termine hors du plan", etat().phase === "fin" && etat().sorti && etat().bilan.stations === 0 && /à bord du train de Deux-Montagnes/.test(cmd()));
T.defi("vendome", "atwater"); T.choisirDirection("dr", -1); T.partir();
verifier("sortir du plan pendant un défi : défi non réussi", etat().phase === "fin" && !etat().defi.reussi && /Défi non réussi/.test(cmd()));
console.log("PARTIR D'UN TRAIN DE BANLIEUE");
T.recommencer();
clic(un('.mtrj__station--entree[data-station="x-dm"]'));
verifier("un clic au bout de la flèche : départ dans le train de Deux-Montagnes", etat().depart === "x-dm" && etat().phase === "choix" && /arrives de l'extérieur du plan/.test(cmd()));
verifier("une seule direction : Bonaventure", tous(".mtrj__dir").length === 1 && /Bonaventure/.test(dir("dm", "1").textContent));
clic(dir("dm", "1")); clic(bouton(".mtrj__partir"));
verifier("arrivée à Bonaventure après 1 station", etat().pos === "bonaventure" && etat().bilan.stations === 1 && /de l'entrée du plan \(train de Deux-Montagnes\) à Bonaventure/.test(un(".mtrj__journal").textContent), un(".mtrj__journal").textContent);
T.choisirDirection("orange", 1); T.regler(2); T.partir();
verifier("puis le métro : 1 correspondance", etat().pos === "place-d-armes" && etat().bilan.corresp === 1);
T.recommencer();
const l2 = un(".mtrj__liste"); l2.value = "x-sj"; l2.dispatchEvent(new window.Event("change", { bubbles: true }));
verifier("la liste offre aussi le départ en train", etat().depart === "x-sj" && !!un(".mtrj__repere--depart"));
T.choisirDirection("sj", 1);
for (let i = 0; i < 9; i++) clic(bouton(".mtrj__plus"));
verifier("quatre arrêts au plus, de De la Concorde à Lucien-L'Allier", etat().n === 4);
T.partir(); filer();
verifier("le train entre par le nord et finit à Lucien-L'Allier", etat().pos === "lucien-l-allier" && etat().bilan.stations === 4);
clic(bouton(".mtrj__terminer"));
verifier("bilan depuis l'entrée du plan", /De l'entrée du plan \(train de Blainville-Saint-Jérôme\) à Lucien-L'Allier/.test(cmd()), cmd());
verifier("le trajet le plus court tient compte des trains", T.distance("de-la-concorde", "lucien-l-allier") === 3);

console.log("REPÈRES DE TERRITOIRE");
verifier("Laval, île de Montréal et Longueuil sur le plan", tous(".mtrj__region").map((t) => t.textContent).join("|") === "Laval|Île de Montréal|Longueuil");

console.log("EXERCE-TOI");
const X = racine.mtr.exercice;
clic(onglets[2]);
verifier("l'onglet Exerce-toi s'ouvre avec le plan", racine.getAttribute("data-onglet") === "exercice" && /Exerce-toi/.test(un(".mtr__titre").textContent) && !!un(".mtrj__exercice .mtrj__ex-situation"));
/* Plus court chemin en métro seulement, et nombre de chemins les plus courts, à partir des données du composant. */
const D = JSON.parse(composant.slice(composant.indexOf("var D = ") + 8, composant.indexOf(";\n", composant.indexOf("var D = "))));
const VOIS = {};
for (const k of ["verte", "orange", "jaune", "bleue"]) { const st = D.lignes[k].st; st.forEach((id, i) => { VOIS[id] = VOIS[id] || []; if (i) VOIS[id].push(st[i - 1]); if (i < st.length - 1) VOIS[id].push(st[i + 1]); }); }
function plusCourt(a, b) { const dist = { [a]: 0 }, nb = { [a]: 1 }, file = [a]; while (file.length) { const c = file.shift(); for (const v of VOIS[c]) { if (dist[v] === undefined) { dist[v] = dist[c] + 1; nb[v] = 0; file.push(v); } if (dist[v] === dist[c] + 1) nb[v] += nb[c]; } } return [dist[b], nb[b]]; }
const QS = X.questions();
verifier("13 situations, dont 5 en train de banlieue", QS.length === 13 && QS.filter((Q) => Q.train).length === 5);
let qOk = true, qDetail = "";
QS.forEach((Q, i) => {
  const sg = X.segments(Q), dep = Q.train ? Q.trajet[0][1] : Q.depart;
  let ok = sg.every(Boolean) && sg[0].ids[0] === dep && sg[sg.length - 1].ids.slice(-1)[0] === Q.but;
  for (let j = 1; j < sg.length; j++) ok = ok && sg[j].ids[0] === sg[j - 1].ids.slice(-1)[0] && sg[j].l !== sg[j - 1].l;
  if (Q.train) ok = ok && T.arrivee(Q.train) === dep && !!T.segment(Q.train, "x-" + Q.train, dep);
  const total = sg.reduce((n, g) => n + g.n, 0), [d, nb] = plusCourt(dep, Q.but);
  ok = ok && total === d && nb === 1;
  ok = ok && Q.qui.includes("(station de métro " + T.nom(Q.but) + ")");
  if (!ok) { qOk = false; qDetail += ` ${i + 1}:${total}/${d}/${nb}`; }
});
verifier("chaque itinéraire est valide et le seul plus court en métro", qOk, qDetail);
X.aller(0);
verifier("situation 1 : 7 cases (couleur, direction, nombre, correspondance)", X.champs().length === 7, X.champs().length);
verifier("situation 1 : bonnes réponses attendues", X.cases().map((c) => c.rep).join() === "orange,cote-vertu,10,berri-uqam,verte,angrignon,2", X.cases().map((c) => c.rep).join());
verifier("le plan marque le départ et la destination, sans tracer le trajet", !!un(".mtrj__repere--depart") && !!un(".mtrj__repere--but") && !un(".mtrj__halos .mtrj__halo"));
const remplir = (vals) => X.champs().forEach((f, i) => { f.value = vals[i]; f.dispatchEvent(new window.Event("input", { bubbles: true })); });
remplir(["orange", "cote-vertu", "9", "berri-uqam", "verte", "angrignon", "2"]);
clic(un(".mtrj__ex-verifier"));
verifier("une erreur : 6 bonnes réponses sur 7, la case fausse en rouge", /6 bonnes réponses sur 7/.test(un(".mtrj__ex-retour").textContent) && tous(".mtrj__ex-champ.est-faux").length === 1 && !un(".mtrj__halos .mtrj__halo"));
remplir(["orange", "cote-vertu", "10", "berri-uqam", "verte", "angrignon", "2"]);
clic(un(".mtrj__ex-verifier"));
verifier("tout juste : bravo et trajet tracé sur le plan", /Bravo/.test(un(".mtrj__ex-retour").textContent) && tous(".mtrj__halos .mtrj__halo").length === 2);
clic(un(".mtrj__ex-suiv"));
verifier("situation suivante : cases vides, compteur à jour", X.no() === 1 && X.champs().every((f) => f.value === "") && /Situation 2 sur 13/.test(un(".mtrj__exercice").textContent));
X.aller(9);
verifier("situation en train : la première case est la station d'arrivée du train", X.cases()[0].rep === "lucien-l-allier" && /son train arrive-t-il/.test(un(".mtrj__ex-etapes").textContent));
clic(un(".mtrj__ex-reponse"));
verifier("Afficher la réponse remplit les cases et trace le train puis le métro", X.champs().every((f, i) => f.value === X.cases()[i].rep) && tous(".mtrj__halos .mtrj__halo").length === 3 && tous(".mtrj__halo--train").length === 1);
racine.dispatchEvent(new window.CustomEvent("reinitialiser"));
verifier("Réinitialiser vide les cases de la situation", X.no() === 9 && X.champs().every((f) => f.value === "") && !un(".mtrj__halos .mtrj__halo"));
verifier("le plan n'accepte pas de clic de départ pendant l'exercice", (clic(un('.mtrj__station[data-station="snowdon"]')), T.etat().phase === "exercice"));
clic(onglets[1]);
verifier("retour à Mon trajet : on recommence au choix du départ", T.etat().phase === "depart" && !un(".mtrj__repere"));
clic(onglets[2]);
for (let i = 0; i < QS.length; i++) { X.aller(i); X.reponse(); if (i === 7) break; }

console.log("RÉINITIALISATION ET TYPOGRAPHIE");
clic(onglets[1]);
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
