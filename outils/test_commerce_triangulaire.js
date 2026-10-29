/*
 * Test de la carte du commerce triangulaire dans un DOM simulé.
 *     node outils/test_commerce_triangulaire.js [composant.html]
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi le bouton Plein écran que la page lui ajoute.
 * Le mouvement réduit est demandé : les déplacements de la carte se font
 * alors d'un coup, ce qui rend le test prévisible.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "commerce-triangulaire.html");
const composant = fs.readFileSync(fichier, "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>L'expansion européenne</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.matchMedia = (requete) => ({
  matches: /prefers-reduced-motion:\s*reduce/.test(requete), media: requete,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
});
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const racine = document.getElementById("commerce-triangulaire");
const api = racine && racine.commerceTriangulaire;
// Un second passage du script ne doit rien doubler.
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const svg = un(".ctr__svg");
const panneauxVisibles = () => tous(".ctr__panneau.est-visible").map((p) => p.getAttribute("data-panneau"));
const fenetre = () => (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
const D = JSON.parse((script.match(/var D = (\{.*?\});\n/s) || [0, "null"])[1]);
const etendue = D && D.etendue;
const ongletCourant = () => tous('.ctr__etape[aria-current="step"]').map((b) => b.getAttribute("data-etape")).join();
const portsPresses = () => tous('.ctr__port-bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-port"));
const fluxActifs = () => tous(".ctr__flux.est-actif");
const routeDe = (el) => (el.getAttribute("href") || "").replace("#ctr-a-", "");
const dansEtendue = (v) => v[0] >= etendue[0] - 0.01 && v[1] >= etendue[1] - 0.01 && v[0] + v[2] <= etendue[2] + 0.01 && v[1] + v[3] <= etendue[3] + 0.01;

// Textes visibles : le composant sans son style ni son script.
const copie = racine.cloneNode(true);
tous("style, script", copie).forEach((el) => el.remove());
const visible = copie.textContent;

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret") && racine.commerceTriangulaire === api);
verifier("les données du moteur sont lisibles", !!D && Array.isArray(D.etapes) && Array.isArray(etendue) && etendue.length === 4);
const onglets = tous(".ctr__etape");
const boutonsPorts = tous(".ctr__port-bouton");
verifier("six étapes", onglets.length === 6 && D.etapes.length === 6, onglets.length);
verifier("chaque onglet ouvre le panneau de son étape (aria-controls)",
  onglets.every((b) => { const p = document.getElementById(b.getAttribute("aria-controls")); return p && p.getAttribute("data-panneau") === "etape-" + b.getAttribute("data-etape"); }));
verifier("douze ports à choisir, quatre par continent",
  boutonsPorts.length === 12 && ["europe", "afrique", "amerique"].every((g) => tous(".ctr__port-bouton--" + g).length === 4), boutonsPorts.length);
verifier("chaque port a son panneau, relié par aria-controls",
  boutonsPorts.every((b) => { const p = document.getElementById(b.getAttribute("aria-controls")); return p && p.getAttribute("data-panneau") === "port-" + b.getAttribute("data-port"); }));
const marqueurs = tous(".ctr__port");
verifier("chaque port a son point sur la carte, une seule fois",
  marqueurs.length === 12 && boutonsPorts.every((b) => tous(`.ctr__port[data-port="${b.getAttribute("data-port")}"]`).length === 1));
verifier("chaque point porte le nom de son bouton",
  boutonsPorts.every((b) => un(`.ctr__port[data-port="${b.getAttribute("data-port")}"] .ctr__nom`).textContent === b.textContent.trim()));
verifier("chaque point a la couleur de son continent",
  boutonsPorts.every((b) => un(`.ctr__port[data-port="${b.getAttribute("data-port")}"]`).classList.contains("ctr__port--" + /ctr__port-bouton--(\w+)/.exec(b.className)[1])));
verifier("chaque nom de port a au moins deux places possibles",
  marqueurs.every((m) => (m.getAttribute("data-ancres") || "").split(";").filter((a) => a.split(",").length === 3).length >= 2));
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join());
verifier("chaque <use> vise un élément existant",
  tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
verifier("la carte a une description pour les lecteurs d'écran",
  svg.getAttribute("role") === "img" && (svg.getAttribute("aria-label") || "").length > 60);
verifier("la légende nomme les trois côtés et les ports", tous(".ctr__legende > li").length === 4 && /Côté 1/.test(un(".ctr__legende").textContent) && /Côté 3/.test(un(".ctr__legende").textContent));
verifier("une échelle est posée sur la carte", !!un(".ctr__carte .ctr__echelle .ctr__echelle-barre"));
// Chaque tronçon des étapes existe : un tracé, un trait de couleur et son liseré.
const cles = new Set(D.etapes.flatMap((e) => e.flux.map((f) => f.k)));
verifier("chaque tronçon des étapes a son tracé, son trait et son liseré",
  [...cles].every((k) => tous(`.ctr__flux[data-flux="${k}"]`).length === 1 && tous(`.ctr__flux-halo[data-flux="${k}"]`).length === 1)
  && D.etapes.every((e) => e.flux.every((f) => document.getElementById("ctr-a-" + f.id) && D.aretes[f.id] > 0)), cles.size);
verifier("le trait d'un tronçon a la couleur de son côté",
  D.etapes.every((e) => e.flux.every((f) => un(`.ctr__flux[data-flux="${f.k}"]`).classList.contains("ctr__flux--c" + f.cote))));
verifier("les retours vers les ports d'Europe sont parcourus à rebours",
  ["liverpool-large", "nantes-large", "bordeaux-large"].every((id) => { const el = un(`.ctr__flux[data-flux="${id}-c3"]`); return el && el.classList.contains("est-inverse"); }));

console.log("ÉTAPES");
verifier("la vue d'ensemble s'affiche au départ", panneauxVisibles().join() === "etape-ensemble" && ongletCourant() === "ensemble", panneauxVisibles().join());
verifier("le premier panneau est visible même sans script", /ctr__panneau--etape est-visible/.test(composant));
verifier("on ne peut pas reculer à la première étape", un(".ctr__precedent").disabled && !un(".ctr__suivant").disabled);
verifier("la barre annonce l'étape 1 sur 6", /^Étape 1 sur 6$/.test(un(".ctr__nav-texte").textContent));
const depart = fenetre();
verifier("la fenêtre de départ reste dans les données", dansEtendue(depart), depart.join(" "));
const vues = {};
const COTES = { cote1: 1, cote2: 2, cote3: 3 };
for (let i = 0; i < 6; i++) {
  if (i > 0) clic(un(".ctr__suivant"));
  const e = D.etapes[i];
  const actifs = fluxActifs();
  const pleins = actifs.filter((el) => !el.classList.contains("est-pale"));
  const routes = actifs.map(routeDe);
  vues[e.id] = fenetre();
  verifier(`étape ${i + 1} (${e.id}) : son panneau, son onglet, sa barre`,
    panneauxVisibles().join() === "etape-" + e.id && ongletCourant() === e.id && un(".ctr__nav-texte").textContent === `Étape ${i + 1} sur 6`,
    panneauxVisibles().join() + " / " + ongletCourant());
  verifier(`étape ${i + 1} : chaque tronçon prévu est montré, aucun autre`,
    actifs.length === e.flux.length && e.flux.every((f) => un(`.ctr__flux[data-flux="${f.k}"]`).classList.contains("est-actif")), `${actifs.length} / ${e.flux.length}`);
  verifier(`étape ${i + 1} : jamais deux traits sur le même tracé`, new Set(routes).size === routes.length, routes.filter((x, j) => routes.indexOf(x) !== j).join());
  verifier(`étape ${i + 1} : un liseré sous chaque trait en couleur, aucun sous les traits pâles`,
    tous(".ctr__flux-halo.est-actif").filter((h) => !h.classList.contains("est-pale")).length === pleins.length);
  verifier(`étape ${i + 1} : la fenêtre reste dans les données`, dansEtendue(vues[e.id]), vues[e.id].join(" "));
  if (COTES[e.id]) {
    const n = COTES[e.id];
    verifier(`étape ${i + 1} : seul le côté ${n} est en couleur, et il avance`,
      pleins.length > 0 && pleins.every((el) => el.classList.contains("ctr__flux--c" + n) && el.classList.contains("est-anime")), pleins.map((el) => el.getAttribute("data-flux")).join());
    verifier(`étape ${i + 1} : les deux autres côtés restent visibles, en pâle`,
      [1, 2, 3].filter((c) => c !== n).every((c) => actifs.some((el) => el.classList.contains("ctr__flux--c" + c) && el.classList.contains("est-pale"))));
  }
}
verifier("les étapes déplacent la carte", new Set(Object.values(vues).map((v) => v.join(" "))).size >= 4);
verifier("la traversée cadre l'Atlantique de l'Afrique aux Antilles", vues.cote2[2] < depart[2], vues.cote2.join(" "));
const bresil = D.etapes.find((e) => e.id === "bresil");
const pleinsBresil = bresil.flux.filter((f) => !f.pale).map((f) => f.k).sort().join();
verifier("le Brésil : seuls les allers-retours avec l'Afrique sont en couleur",
  pleinsBresil === ["luanda-rio-c2", "ouidah-salvador-c2", "rio-luanda-c1", "salvador-ouidah-c1"].sort().join(), pleinsBresil);
verifier("les allers du Brésil ne s'affichent pas aux trois côtés du triangle",
  D.etapes.filter((e) => COTES[e.id]).every((e) => e.flux.every((f) => !/^(salvador-ouidah|rio-luanda)/.test(f.k))));
verifier("la vue d'ensemble et l'après-traite montrent tout, sans animation",
  ["ensemble", "apres"].every((id) => { const e = D.etapes.find((x) => x.id === id); return !e.anime && e.flux.every((f) => !f.pale); }));
verifier("on ne peut pas avancer à la dernière étape", un(".ctr__suivant").disabled && !un(".ctr__precedent").disabled);
clic(un(".ctr__precedent"));
verifier("on peut revenir en arrière", panneauxVisibles().join() === "etape-bresil" && ongletCourant() === "bresil");
clic(un('.ctr__etape[data-etape="cote1"]'));
verifier("un onglet mène directement à son étape", panneauxVisibles().join() === "etape-cote1" && un(".ctr__nav-texte").textContent === "Étape 2 sur 6");

console.log("PORTS");
boutonsPorts.forEach((b) => {
  const cle = b.getAttribute("data-port");
  clic(b);
  const point = un(`.ctr__port[data-port="${cle}"]`);
  const ok = panneauxVisibles().join() === "port-" + cle && portsPresses().join() === cle
    && point.classList.contains("est-choisi") && tous(".ctr__port.est-choisi").length === 1;
  verifier(`${b.textContent.trim()} : panneau, bouton enfoncé, point en évidence`, ok, panneauxVisibles().join());
});
clic(un('.ctr__port[data-port="elmina"] .ctr__point'));
verifier("un clic sur un point de la carte choisit le port", panneauxVisibles().join() === "port-elmina" && portsPresses().join() === "elmina");
clic(un("#ctr-port-elmina .ctr__retour"));
verifier("le bouton de retour ramène à l'étape en cours", panneauxVisibles().join() === "etape-cote1" && portsPresses().length === 0 && tous(".ctr__port.est-choisi").length === 0);
clic(un('.ctr__port-bouton[data-port="rio"]'));
clic(un('.ctr__etape[data-etape="cote3"]'));
verifier("changer d'étape libère le port choisi", panneauxVisibles().join() === "etape-cote3" && portsPresses().length === 0);

console.log("QUESTIONS");
const voirs = tous(".ctr__voir");
verifier("une question à réfléchir à chaque étape sauf la vue d'ensemble", voirs.length === 5, voirs.length);
voirs.forEach((b) => {
  const piste = document.getElementById(b.getAttribute("aria-controls"));
  const avant = piste && piste.hidden;
  clic(b);
  const ouvert = piste && !piste.hidden && b.getAttribute("aria-expanded") === "true" && /Masquer/.test(b.textContent);
  clic(b);
  const ferme = piste && piste.hidden && b.getAttribute("aria-expanded") === "false" && /Voir/.test(b.textContent);
  verifier(`la piste « ${piste ? piste.id.replace("ctr-piste-", "") : "?"} » s'ouvre et se referme`, avant && ouvert && ferme);
});

console.log("CHIFFRES ET GRAPHIQUES");
const chiffres = tous("#ctr-etape-ensemble .ctr__chiffre-val").map((x) => x.textContent.replace(/\s/g, " "));
verifier("vue d'ensemble : 12,5 millions embarqués, 10,7 débarqués, 1,8 mort en mer",
  chiffres.join("|") === "12,5 millions|10,7 millions|1,8 million", chiffres.join("|"));
const nombre = (s) => +s.replace(/\s/g, "");
const departs = tous(".ctr__barres--depart .ctr__barre-val").map((x) => nombre(x.textContent));
const arrivees = tous(".ctr__barres--arrivee .ctr__barre-val").map((x) => nombre(x.textContent));
verifier("huit régions de départ, sept régions d'arrivée", departs.length === 8 && arrivees.length === 7, `${departs.length} / ${arrivees.length}`);
const somme = (l) => l.reduce((a, b) => a + b, 0);
verifier("les départs font environ 12,5 millions", Math.abs(somme(departs) - 12.5e6) < 0.06e6, somme(departs));
verifier("les arrivées en Amérique font environ 10,5 millions", Math.abs(somme(arrivees) - 10.54e6) < 0.06e6, somme(arrivees));
verifier("les barres sont rangées de la plus longue à la plus courte",
  [departs, arrivees].every((l) => l.every((v, i) => i === 0 || v <= l[i - 1])));
verifier("la plus longue barre remplit sa piste, les autres en proportion",
  ["depart", "arrivee"].every((g) => { const w = tous(`.ctr__barres--${g} .ctr__barre`).map((x) => parseFloat(x.style.getPropertyValue("--v"))); return w[0] === 100 && w.every((v) => v > 0 && v <= 100); }));
verifier("chaque produit a son icône", tous(".ctr__produit").length >= 13 && tous(".ctr__produit use").every((u) => document.getElementById(u.getAttribute("href").slice(1))));

console.log("CARTE");
clic(un('.ctr__outil[data-zoom="ensemble"]'));
const ensemble = fenetre();
clic(un('.ctr__outil[data-zoom="plus"]'));
verifier("le bouton + agrandit", fenetre()[2] < ensemble[2] - 1, fenetre().join(" "));
const milieu = fenetre();
clic(un('.ctr__outil[data-zoom="moins"]'));
verifier("le bouton − réduit", fenetre()[2] > milieu[2] + 1);
for (let i = 0; i < 12; i++) clic(un('.ctr__outil[data-zoom="moins"]'));
const loin = fenetre();
verifier("on ne recule jamais au-delà des données", dansEtendue(loin) && loin[2] <= etendue[2] - etendue[0] + 0.01, loin.join(" "));
for (let i = 0; i < 20; i++) clic(un('.ctr__outil[data-zoom="plus"]'));
verifier("ni ne s'approche sans limite", fenetre()[2] >= D.largeurMin - 0.1, fenetre().join(" "));
clic(un('.ctr__outil[data-zoom="ensemble"]'));
verifier("la maison ramène la vue d'ensemble", Math.abs(fenetre()[2] - ensemble[2]) < 0.5, fenetre().join(" "));

console.log("MOLETTE");
// Sans requestAnimationFrame, le moteur applique la molette et les animations tout de suite.
const rafOriginal = window.requestAnimationFrame;
function molette(deltaY, options) {
  const o = Object.assign({ clientX: 300, clientY: 250, deltaMode: 0 }, options || {});
  const ev = new window.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY, deltaMode: o.deltaMode, clientX: o.clientX, clientY: o.clientY, ctrlKey: !!o.ctrlKey, metaKey: !!o.metaKey });
  window.requestAnimationFrame = undefined;
  svg.dispatchEvent(ev);
  window.requestAnimationFrame = rafOriginal;
  return ev;
}
// Point de la carte sous le pointeur, avec la taille de repli du moteur (jsdom ne mesure rien).
function pointSous(v, cx, cy) {
  const u = Math.max(v[2] / 1000, v[3] / 600);
  const ox = (1000 - v[2] / u) / 2, oy = (600 - v[3] / u) / 2;
  return [v[0] + (cx - ox) * u, v[1] + (cy - oy) * u];
}
clic(un('.ctr__outil[data-zoom="ensemble"]'));
let avantMolette = fenetre();
let ev = molette(-100);
verifier("hors plein écran, la molette seule laisse défiler la page", !ev.defaultPrevented && fenetre().join() === avantMolette.join());
ev = molette(-100, { ctrlKey: true });
verifier("hors plein écran, Ctrl + molette zoome", ev.defaultPrevented && fenetre()[2] < avantMolette[2] - 1, fenetre().join(" "));
clic(un('.ctr__outil[data-zoom="ensemble"]'));

console.log("PLEIN ÉCRAN");
const pleinBouton = un(".ctr__entete > .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = un(".ctr__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  clic(un('.ctr__outil[data-zoom="ensemble"]'));
  avantMolette = fenetre();
  const p0 = pointSous(avantMolette, 300, 250);
  ev = molette(-100);
  const apresMolette = fenetre();
  const p1 = pointSous(apresMolette, 300, 250);
  verifier("en plein écran, la molette seule zoome", ev.defaultPrevented && apresMolette[2] < avantMolette[2] - 1, apresMolette.join(" "));
  verifier("le zoom se fait vers le point visé", Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.5, `${p0.map(Math.round)} -> ${p1.map(Math.round)}`);
  verifier("la carte garde ses proportions en zoomant", Math.abs(apresMolette[2] / apresMolette[3] - avantMolette[2] / avantMolette[3]) < 0.001);
  molette(100);
  verifier("la molette vers soi recule", fenetre()[2] > apresMolette[2] + 1, fenetre().join(" "));
  molette(-3, { deltaMode: 1 });
  verifier("les crans en lignes (Firefox) zooment aussi", fenetre()[2] < avantMolette[2] - 1, fenetre().join(" "));
  for (let i = 0; i < 40; i++) molette(-120);
  verifier("la molette respecte la même limite que le bouton +", fenetre()[2] >= D.largeurMin - 0.1 && dansEtendue(fenetre()), fenetre().join(" "));
  for (let i = 0; i < 40; i++) molette(120, { clientX: 20, clientY: 20 });
  verifier("ni ne recule au-delà des données", dansEtendue(fenetre()) && fenetre()[2] <= etendue[2] - etendue[0] + 0.01, fenetre().join(" "));
  clic(un('.ctr__outil[data-zoom="ensemble"]'));
  verifier("les textes, la navigation et les ports sont rangés à côté de la carte",
    !!un(".ctr__cote > .ctr__contenu") && !!un(".ctr__cote > .ctr__nav") && !!un(".ctr__cote > .ctr__ports") && !!un(".ctr__cadre > .ctr__carte"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(un('.ctr__port-bouton[data-port="luanda"]'));
  verifier("en plein écran, un port ouvre toujours son panneau", panneauxVisibles().join() === "port-luanda");
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
verifier("aucun tiret cadratin ni demi-cadratin", !/[—–]/.test(racine.textContent));
verifier("aucune virgule devant « et »", !/,\s+et\s/.test(visible), (visible.match(/.{30},\s+et\s.{10}/) || [""])[0]);
const sansAdresses = visible.replace(/https?:\/\//g, "");
verifier("une espace insécable devant chaque deux-points", !/(?<! ):/.test(sansAdresses), (sansAdresses.match(/.{20}(?<! ):.{10}/) || [""])[0]);
verifier("des espaces insécables dans les guillemets", !/«(?! )/.test(visible) && !/(?<! )»/.test(visible), (visible.match(/.{10}«(?! ).{10}|.{10}(?<! )».{10}/) || [""])[0]);
verifier("aucune espace devant ; ! ?", !/[   ][;!?]/.test(visible), (visible.match(/.{20}[   ][;!?]/) || [""])[0]);
verifier("des espaces insécables dans les nombres", !/\d \d{3}(?!\d)/.test(visible), (visible.match(/.{10}\d \d{3}.{5}/) || [""])[0]);
verifier("une espace insécable devant %", !/\d ?%/.test(visible.replace(/ %/g, "")), (visible.match(/.{10}\d ?%/) || [""])[0]);
verifier("chaque port a un rôle et un texte d'au moins 80 caractères",
  tous(".ctr__panneau--port").every((p) => un(".ctr__role", p) && un(".ctr__detail", p).textContent.length > 80));
verifier("la source nomme Slave Voyages et Natural Earth", /Slave Voyages/.test(un(".ctr__source").textContent) && /Natural Earth/.test(un(".ctr__source").textContent));
verifier("la traite est nommée pour ce qu'elle est : des personnes réduites en esclavage",
  /personnes réduites en esclavage/.test(visible) && !/\bmarchandise humaine\b/i.test(visible));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
