/*
 * Test de la chaîne de causalité (moteur cau) dans un DOM simulé.
 *     node outils/test_causes_revolution.js
 *
 * Vérifie le composant de la fiche 09 (causes-revolution) de bout en bout,
 * puis la maquette de la fiche 06 (causes-essor), qui partage le même moteur.
 * Le composant est inséré dans une fiche minimale avec page.js, pour tester
 * aussi le bouton Plein écran que page.js pose dans l'en-tête.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const NB = " ";
let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function charger(nom) {
  const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", nom + ".html"), "utf8");
  const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Les causes</h2>
${composant}
</section></article></main></body></html>`;
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.scrollTo = () => {};
  const pageJs = path.join(RACINE, "theme", "page.js");
  if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
  const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
  window.eval(script);
  window.eval(script);
  const donnees = JSON.parse(composant.match(/var DONNEES = (\{[\s\S]*?\n  \});/)[1]);
  return { window, document: window.document, racine: window.document.getElementById(nom), donnees, composant };
}

// Typographie québécoise : insécable avant le deux-points et dans les
// guillemets, aucune espace avant ; ! ?, ni tiret long, ni « , et ».
function fautesTypo(texte) {
  const fautes = [];
  if (/[   ][;!?]/.test(texte)) fautes.push("espace avant ; ! ?");
  if (/ :/.test(texte)) fautes.push("espace ordinaire avant le deux-points");
  if (/«(?! )/.test(texte)) fautes.push("pas d'insécable après «");
  if (/[^ ]»/.test(texte)) fautes.push("pas d'insécable avant »");
  if (/[–—]/.test(texte)) fautes.push("tiret long");
  if (/, et /.test(texte)) fautes.push("« , et »");
  if (/\d \d{3}\b/.test(texte)) fautes.push("espace ordinaire dans un nombre");
  return fautes;
}
function textesDonnees(donnees) {
  const t = [];
  donnees.faits.forEach((f) => {
    t.push(f.titre, f.texte);
    if (f.date) t.push(f.date);
    (f.causes || []).forEach((c) => t.push(c.lien));
  });
  Object.values(donnees.pieges || {}).forEach((p) => Object.values(p).forEach((m) => t.push(m)));
  donnees.faits.forEach((f) => { if (f.oeuvre) ["titre", "source", "note", "alt"].forEach((k) => { if (f.oeuvre[k]) t.push(f.oeuvre[k]); }); });
  return t;
}

async function testerRevolution() {
  const { window, document, racine, donnees, composant } = charger("causes-revolution");
  const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
  const clic = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const carte = (id) => racine.querySelector(`.cau__carte[data-fait="${id}"]`);
  const fait = (id) => racine.querySelector(`.cau__fait[data-fait="${id}"]`);
  const visibles = () => tous(".cau__fait").filter((li) => !li.hidden).map((li) => li.getAttribute("data-fait"));
  const panneau = racine.querySelector(".cau__panneau");
  const textePanneau = () => panneau.textContent;
  const action = (nom) => panneau.querySelector(`[data-action="${nom}"]`);
  const chemins = () => tous("path.cau__lien");
  const faits = donnees.faits;
  const rang = {};
  faits.forEach((f, i) => { rang[f.id] = i; });
  const nbLiens = faits.reduce((n, f) => n + (f.causes || []).length, 0);
  const textesRendus = [];
  const noterTexte = () => textesRendus.push(textePanneau(), racine.querySelector(".cau__compte").textContent);

  console.log("MISE EN PLACE");
  verifier("composant présent", !!racine);
  verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
  verifier("un fait par donnée, sans doublon au second passage", tous(".cau__fait").length === faits.length, tous(".cau__fait").length);
  verifier("un seul panneau, une seule barre", tous(".cau__panneau").length === 1 && tous(".cau__barre").length === 1);
  verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
  verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);
  const ids = tous("[id]", document).map((el) => el.id);
  verifier("aucun identifiant en double", new Set(ids).size === ids.length);
  verifier("en-tête reconnu par page.js (classe en __entete)", !!racine.querySelector(":scope > .cau__entete"));
  verifier("titre accessible de niveau 3", !!racine.querySelector('.cau__titre[role="heading"][aria-level="3"]'));
  verifier("modes en groupe de boutons à bascule",
    !!racine.querySelector('.cau__modes[role="group"]') && tous(".cau__mode").every((b) => b.hasAttribute("aria-pressed")));
  verifier("panneau et compteur annoncés (aria-live)",
    panneau.getAttribute("aria-live") === "polite" && racine.querySelector(".cau__compte").getAttribute("aria-live") === "polite");
  verifier("tracé des flèches masqué aux lecteurs d'écran", racine.querySelector(".cau__liens").getAttribute("aria-hidden") === "true");
  verifier("chaque fait est un bouton", tous(".cau__fait").every((li) => li.firstElementChild.tagName === "BUTTON"));
  verifier("le texte replié n'apparaît pas hors plein écran (règle CSS présente)",
    composant.includes(".cau:not(.est-plein-ecran) .cau__replier { display: none; }"));

  console.log("DONNÉES");
  verifier("14 faits, 16 liens", faits.length === 14 && nbLiens === 16, `${faits.length} faits, ${nbLiens} liens`);
  verifier("chaque cause précède son fait", faits.every((f, i) => (f.causes || []).every((c) => rang[c.de] < i)));
  verifier("un seul point de départ, la guerre de Sept Ans", faits.filter((f) => !(f.causes || []).length).map((f) => f.id).join() === "sept-ans");
  verifier("l'aboutissement est la Déclaration d'indépendance", faits[faits.length - 1].id === "declaration");
  verifier("chaque fait mène à la rupture",
    faits.every((f) => { const vus = new Set([f.id]); let pile = [f.id]; while (pile.length) { const x = pile.pop(); faits.forEach((g) => (g.causes || []).forEach((c) => { if (c.de === x && !vus.has(g.id)) { vus.add(g.id); pile.push(g.id); } })); } return vus.has("declaration"); }));
  verifier("les pièges visent de mauvaises réponses antérieures",
    Object.entries(donnees.pieges).every(([cible, p]) => Object.keys(p).every((de) => rang[de] < rang[cible] && !(faits[rang[cible]].causes || []).some((c) => c.de === de))));
  const fautes = textesDonnees(donnees).map((t) => [t, fautesTypo(t)]).filter((x) => x[1].length);
  verifier("typographie des données", fautes.length === 0, fautes.map((x) => x[1].join("/") + " : " + x[0].slice(0, 50)).join(" | "));
  verifier("dates cohérentes avec la fiche (1770, 1773, 1774, 1775, 1776)",
    faits.find((f) => f.id === "massacre").date === "5 mars 1770" && faits.find((f) => f.id === "tea-party").date === "16 décembre 1773"
    && faits.find((f) => f.id === "lexington").date === "19 avril 1775" && faits.find((f) => f.id === "declaration").date === "4 juillet 1776");

  console.log("DÉPART");
  verifier("deux faits visibles : le départ et le premier fait à expliquer", visibles().join() === "sept-ans,dette", visibles().join());
  verifier("le fait à expliquer est marqué", fait("dette").classList.contains("est-nouveau") && carte("dette").getAttribute("aria-current") === "true"
    && carte("dette").querySelector(".cau__marque").textContent === "Fait à expliquer");
  verifier("le départ est marqué", fait("sept-ans").classList.contains("est-depart") && carte("sept-ans").querySelector(".cau__marque").textContent === "Départ");
  verifier("le panneau pose la question", textePanneau().includes("Une dette énorme") && textePanneau().includes("Quelle carte en est la cause?"));
  verifier("compteur à zéro", racine.querySelector(".cau__compte").textContent === "Liens trouvés" + NB + ": 0 sur 16",
    racine.querySelector(".cau__compte").textContent);
  verifier("aucune flèche au départ", chemins().length === 0);
  verifier("en format étroit, le panneau suit le fait à expliquer", panneau.parentNode === fait("dette") && racine.querySelector(".cau__cote").hidden);
  noterTexte();

  console.log("CONSTRUCTION");
  clic(carte("dette"));
  verifier("cliquer sur le fait à expliquer le rappelle", textePanneau().includes("C'est le fait à expliquer."));
  clic(carte("sept-ans"));
  await attendre(40);
  verifier("bonne cause : lien trouvé", textePanneau().includes("Lien trouvé!") && textePanneau().includes("«" + NB + "La guerre de Sept Ans" + NB + "» mène à «" + NB + "Une dette énorme" + NB + "»."),
    textePanneau().slice(0, 200));
  verifier("bonne cause : le lien est expliqué", textePanneau().includes(faits[1].causes[0].lien));
  verifier("bonne cause : une flèche relie la cause au fait",
    chemins().length === 1 && chemins()[0].getAttribute("data-de") === "sept-ans" && chemins()[0].getAttribute("data-vers") === "dette");
  verifier("bonne cause : la carte l'indique", fait("sept-ans").classList.contains("est-juste") && carte("sept-ans").querySelector(".cau__marque").textContent === "Cause trouvée");
  verifier("bouton Fait suivant offert", !!action("suivant"));
  verifier("compteur à 1", racine.querySelector(".cau__compte").textContent.endsWith("1 sur 16"));
  noterTexte();
  clic(carte("sept-ans"));
  verifier("recliquer une fois tout trouvé invite à passer au suivant", textePanneau().includes("Toutes les causes de ce fait sont trouvées."));
  clic(action("suivant"));
  verifier("le fait suivant apparaît", visibles().join() === "sept-ans,dette,proclamation" && fait("proclamation").classList.contains("est-nouveau"));
  verifier("la carte précédente n'est plus marquée comme cause", !fait("sept-ans").classList.contains("est-juste"));
  clic(carte("sept-ans"));
  clic(action("suivant"));
  verifier("troisième question : les taxes", fait("taxes").classList.contains("est-nouveau"));
  clic(carte("proclamation"));
  verifier("mauvaise réponse : rétroaction du piège", textePanneau().includes("Pas tout à fait.") && textePanneau().includes(donnees.pieges.taxes.proclamation));
  verifier("mauvaise réponse : la carte l'indique", fait("proclamation").classList.contains("est-faux") && carte("proclamation").querySelector(".cau__marque").textContent === "Pas la cause");
  noterTexte();
  clic(carte("sept-ans"));
  verifier("cause lointaine : il manque une étape", textePanneau().includes("est une cause lointaine de") && textePanneau().includes("il manque au moins une étape"));
  verifier("la mauvaise carte précédente n'est plus marquée", !fait("proclamation").classList.contains("est-faux") && fait("sept-ans").classList.contains("est-faux"));
  noterTexte();
  clic(carte("dette"));
  verifier("puis la bonne cause", textePanneau().includes("Lien trouvé!") && !fait("sept-ans").classList.contains("est-faux"));
  clic(action("suivant"));

  // Résoudre la suite en suivant les données, avec quelques détours.
  let essaisRates = 2;
  let tout = true;
  let messageGenerique = false;
  for (let i = rang.protestation; i < faits.length; i++) {
    const f = faits[i];
    if (!fait(f.id).classList.contains("est-nouveau")) { tout = false; break; }
    const causes = f.causes;
    const attendu = causes.length > 1 ? `Ce fait a ${causes.length} causes.` : "Quelle carte en est la cause?";
    if (!textePanneau().includes(attendu)) { tout = false; console.log("      question inattendue pour " + f.id); }
    if (f.id === "massacre") {
      const kids = Array.from(panneau.children);
      const io = kids.findIndex((n) => n.classList.contains("cau__oeuvre"));
      verifier("en construction, l'œuvre vient en dernier dans le panneau", io === kids.length - 1 && io > kids.findIndex((n) => n.classList.contains("cau__question")));
    }
    if (f.id === "tea-act") {
      clic(carte("massacre"));
      essaisRates++;
      verifier("piège du Tea Act", textePanneau().includes(donnees.pieges["tea-act"].massacre));
    }
    if (f.id === "lexington") {
      clic(carte("proclamation"));
      essaisRates++;
      messageGenerique = textePanneau().includes("arrive avant") && textePanneau().includes("Arriver avant ne suffit pas pour être une cause.");
      verifier("rétroaction générale : arriver avant ne suffit pas", messageGenerique, textePanneau().slice(0, 200));
      noterTexte();
    }
    for (let k = 0; k < causes.length; k++) {
      clic(carte(causes[k].de));
      if (!textePanneau().includes("Lien trouvé!") || !textePanneau().includes(causes[k].lien)) { tout = false; console.log("      lien non reconnu : " + causes[k].de + " > " + f.id); }
      if (k < causes.length - 1) {
        if (!textePanneau().includes("Ce fait a une autre cause. Trouve-la.")) { tout = false; console.log("      relance absente pour " + f.id); }
        if (f.id === "sentiment" && k === 0) {
          clic(carte(causes[0].de));
          verifier("une cause déjà trouvée est signalée sans pénalité", textePanneau().includes("Ce lien est déjà trouvé."));
        }
      }
    }
    noterTexte();
    if (i < faits.length - 1) {
      if (!action("suivant")) { tout = false; break; }
      clic(action("suivant"));
    }
  }
  await attendre(40);
  verifier("toute la chaîne se construit en suivant les données", tout);
  verifier("chaîne complète annoncée", textePanneau().includes("Chaîne complète") && textePanneau().includes("Bravo! Tu as relié les 16 liens de la chaîne."));
  verifier("bilan des essais ratés", textePanneau().includes("Essais ratés" + NB + ": " + essaisRates + "."), textePanneau().slice(-260));
  verifier("compteur à 16 sur 16", racine.querySelector(".cau__compte").textContent.endsWith("16 sur 16"));
  verifier("16 flèches tracées", chemins().length === 16, chemins().length);
  verifier("tous les faits sont visibles", visibles().length === 14);
  verifier("on peut voir la chaîne complète ou recommencer", !!action("explorer") && !!action("recommencer"));
  noterTexte();

  console.log("CHAÎNE COMPLÈTE");
  clic(action("explorer"));
  await attendre(40);
  verifier("mode exploration actif", racine.classList.contains("est-explorer")
    && racine.querySelector('.cau__mode[data-mode="explorer"]').getAttribute("aria-pressed") === "true"
    && racine.querySelector('.cau__mode[data-mode="construire"]').getAttribute("aria-pressed") === "false");
  verifier("invitation à choisir un fait", textePanneau().includes("Clique sur un fait pour voir ses causes et ses conséquences."));
  verifier("les cartes deviennent des boutons à bascule", tous(".cau__carte").every((b) => b.getAttribute("aria-pressed") === "false"));
  noterTexte();
  clic(carte("sentiment"));
  await attendre(40);
  verifier("le fait choisi est marqué", fait("sentiment").classList.contains("est-choisi") && carte("sentiment").getAttribute("aria-pressed") === "true");
  verifier("ses trois causes sont marquées",
    ["proclamation", "massacre", "congres"].every((id) => fait(id).classList.contains("est-cause") && carte(id).querySelector(".cau__marque").textContent === "Cause"));
  verifier("sa conséquence est marquée", fait("declaration").classList.contains("est-consequence") && carte("declaration").querySelector(".cau__marque").textContent === "Conséquence");
  verifier("les autres faits sont atténués", fait("dette").classList.contains("est-attenue") && fait("tea-act").classList.contains("est-attenue"));
  verifier("le panneau liste les causes et la conséquence",
    tous(".cau__liste", panneau).length === 2 && tous(".cau__liste:not(.cau__liste--suite) > li", panneau).length === 3
    && tous(".cau__liste--suite > li", panneau).length === 1 && textePanneau().includes("Ses causes") && textePanneau().includes("Sa conséquence"));
  verifier("chaque lien est expliqué", faits[rang.sentiment].causes.every((c) => textePanneau().includes(c.lien)));
  verifier("flèches de causes et de conséquence distinguées",
    chemins().filter((p) => p.classList.contains("est-cause")).map((p) => p.getAttribute("data-de")).sort().join() === "congres,massacre,proclamation"
    && chemins().filter((p) => p.classList.contains("est-consequence")).map((p) => p.getAttribute("data-vers")).join() === "declaration"
    && chemins().filter((p) => p.classList.contains("est-attenue")).length === 12);
  noterTexte();
  clic(panneau.querySelector('[data-aller="congres"]'));
  verifier("un lien du panneau mène au fait relié", fait("congres").classList.contains("est-choisi") && !fait("sentiment").classList.contains("est-choisi"));
  verifier("le premier fait est un point de départ", (clic(carte("sept-ans")), textePanneau().includes("C'est un point de départ de la chaîne.")));
  verifier("le dernier fait est l'aboutissement", (clic(carte("declaration")), textePanneau().includes("C'est l'aboutissement de la chaîne.")));
  carte("declaration").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  verifier("Échap retire le choix", !racine.querySelector(".cau__fait.est-choisi"));
  clic(carte("taxes"));
  clic(carte("taxes"));
  verifier("recliquer le fait choisi le retire", !racine.querySelector(".cau__fait.est-choisi"));
  carte("taxes").focus();
  carte("taxes").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  verifier("flèche vers le bas : fait suivant", document.activeElement === carte("protestation"));
  carte("protestation").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  verifier("flèche vers le haut : fait précédent", document.activeElement === carte("taxes"));

  console.log("RECOMMENCER");
  clic(racine.querySelector(".cau__recommencer"));
  await attendre(40);
  verifier("retour au départ", racine.classList.contains("est-construire") && visibles().join() === "sept-ans,dette"
    && racine.querySelector(".cau__compte").textContent.endsWith("0 sur 16") && chemins().length === 0);
  clic(racine.querySelector('.cau__mode[data-mode="explorer"]'));
  await attendre(40);
  verifier("la chaîne complète se consulte avant d'avoir fini", visibles().length === 14 && chemins().length === 16);
  clic(racine.querySelector('.cau__mode[data-mode="construire"]'));
  await attendre(40);
  verifier("revenir à la construction garde la progression", visibles().join() === "sept-ans,dette" && chemins().length === 0);

  console.log("IMPRESSION");
  window.dispatchEvent(new window.Event("beforeprint"));
  verifier("à l'impression, toute la chaîne s'affiche", visibles().length === 14 && chemins().length === 16);
  window.dispatchEvent(new window.Event("afterprint"));
  await attendre(40);
  verifier("après l'impression, la progression revient", visibles().join() === "sept-ans,dette" && chemins().length === 0);

  console.log("PLEIN ÉCRAN");
  const bouton = racine.querySelector(".cau__entete .plein-ecran");
  verifier("page.js a posé le bouton Plein écran", !!bouton);
  clic(bouton);
  await attendre(20);
  verifier("plein écran simulé", racine.classList.contains("est-plein-ecran") && racine.classList.contains("est-plein-ecran--simule"));
  verifier("en plein écran, le panneau revient dans la colonne de côté",
    panneau.parentNode === racine.querySelector(".cau__cote") && !racine.querySelector(".cau__cote").hidden);
  const replier = racine.querySelector(".cau__replier");
  clic(replier);
  verifier("Masquer le texte replie les explications", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && replier.textContent === "Afficher le texte");
  verifier("les explications sont marquées pour le repli", tous(".cau__detail", panneau).length > 0);
  clic(replier);
  verifier("Afficher le texte les ramène", !racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "true" && replier.textContent === "Masquer le texte");
  clic(racine.querySelector(".cau__entete .plein-ecran"));
  await attendre(20);
  verifier("sortie du plein écran", !racine.classList.contains("est-plein-ecran") && !racine.classList.contains("est-plein-ecran--simule"));
  verifier("hors plein écran étroit, le panneau suit de nouveau le fait à expliquer", panneau.parentNode === fait("dette"));

  console.log("ŒUVRES");
  const oeuvres = faits.filter((f) => f.oeuvre);
  verifier("le dossier des images est celui de la fiche 09", donnees.medias === "../medias/09-revolution-americaine/");
  verifier("11 faits illustrés par une œuvre", oeuvres.length === 11, oeuvres.length);
  verifier("chaque œuvre a un fichier, un texte de remplacement, une source et une note",
    oeuvres.every((f) => /^[a-z0-9-]+\.jpg$/.test(f.oeuvre.fichier) && f.oeuvre.alt.length > 20 && f.oeuvre.source && f.oeuvre.note));
  verifier("chaque source nomme une date", oeuvres.every((f) => /1[78]\d\d|19\d\d/.test(f.oeuvre.source)));
  const yaml = fs.readFileSync(path.join(RACINE, "medias", "sources.yml"), "utf8");
  const sansTrace = oeuvres.filter((f) => {
    const fichier = path.join(RACINE, "medias", "09-revolution-americaine", f.oeuvre.fichier);
    if (fs.existsSync(fichier)) return false;
    const bloc = yaml.split("\n" + f.oeuvre.fichier + ":\n")[1];
    return !bloc || !/^  fiche: 09-revolution-americaine$/m.test(bloc.split(/\n(?=\S)/)[0]) || !/^  commons: File:/m.test(bloc.split(/\n(?=\S)/)[0]);
  }).map((f) => f.oeuvre.fichier);
  verifier("chaque image est dans le dépôt ou inscrite au registre (fiche 09, fichier Commons)", sansTrace.length === 0, sansTrace.join(", "));
  const credits = racine.querySelector(".cau__credits");
  verifier("un crédit par œuvre, dans un bloc caché hors du panneau",
    !!credits && credits.hidden && !panneau.contains(credits)
    && oeuvres.every((f) => credits.querySelector(`[data-credit="${f.oeuvre.fichier}"]`) && composant.includes(`{{credit:${f.oeuvre.fichier}}}`)));
  verifier("le composant est marqué comme illustré", racine.classList.contains("a-oeuvres"));
  clic(racine.querySelector('.cau__mode[data-mode="explorer"]'));
  clic(carte("massacre"));
  let bloc = panneau.querySelector(".cau__oeuvre");
  let img = bloc && bloc.querySelector("img");
  verifier("le fait choisi montre son œuvre", !!img && img.getAttribute("src") === "../medias/09-revolution-americaine/massacre-boston.jpg"
    && img.alt === faits[rang.massacre].oeuvre.alt);
  verifier("légende : titre en italique, source et note",
    bloc.querySelector(".cau__oeuvre-titre").textContent === "Le massacre de Boston"
    && bloc.querySelector(".cau__oeuvre-legende").textContent.includes("gravure de Paul Revere, 1770.")
    && bloc.querySelector(".cau__oeuvre-legende").textContent.includes("propagande"));
  const ordre = Array.from(panneau.children).map((n) => n.className.split(" ")[0]);
  verifier("en exploration, l'œuvre suit le titre du fait", ordre.indexOf("cau__oeuvre") === ordre.indexOf("cau__sujet") + 1, ordre.join(" "));
  verifier("l'œuvre se replie avec le texte", bloc.classList.contains("cau__detail"));
  clic(carte("massacre")); clic(carte("massacre"));
  verifier("la même image sert d'un affichage à l'autre", panneau.querySelector(".cau__oeuvre img") === img);
  clic(carte("dette"));
  verifier("un fait sans œuvre n'a pas de cadre", !panneau.querySelector(".cau__oeuvre"));
  clic(carte("sept-ans"));
  bloc = panneau.querySelector(".cau__oeuvre");
  img = bloc.querySelector("img");
  img.dispatchEvent(new window.Event("error"));
  verifier("image introuvable : la légende reste seule", bloc.classList.contains("est-absente")
    && bloc.querySelector(".cau__oeuvre-legende").textContent.includes("Benjamin West, 1770"));
  clic(carte("dette")); clic(carte("sept-ans"));
  bloc = panneau.querySelector(".cau__oeuvre");
  verifier("une image introuvable n'est pas redemandée", bloc.classList.contains("est-absente") && !bloc.querySelector("img"));
  clic(racine.querySelector('.cau__mode[data-mode="construire"]'));
  verifier("les faits cachés sont hors de l'arbre accessible",
    tous(".cau__fait").every((li) => li.hidden ? li.getAttribute("aria-hidden") === "true" : !li.hasAttribute("aria-hidden")));
  verifier("en plein écran, les emplacements à venir sont prévus (règle CSS)",
    composant.includes(".cau.est-plein-ecran.est-construire .cau__fait[hidden] > * { visibility: hidden; }"));
  verifier("la mesure du plein écran coupe les transitions (règle CSS)",
    composant.includes(".cau.est-mesure, .cau.est-mesure * { transition: none !important; }"));
  const construit = path.join(RACINE, "docs", "histoire", "09-revolution-americaine.html");
  if (fs.existsSync(construit)) {
    const page = fs.readFileSync(construit, "utf8");
    verifier("fiche construite : crédits composés par build.py",
      !page.includes("{{credit:") && page.includes('data-credit="massacre-boston.jpg"><details class="credit">'));
  }

  console.log("TYPOGRAPHIE DES TEXTES AFFICHÉS");
  const rendus = textesRendus.map((t) => [t, fautesTypo(t)]).filter((x) => x[1].length);
  verifier(`${textesRendus.length} états du panneau sans faute`, rendus.length === 0, rendus.map((x) => x[1].join("/") + " : " + x[0].slice(0, 80)).join(" | "));
  const statiques = [racine.querySelector(".cau__titre").textContent, racine.querySelector(".cau__consigne").textContent,
    ...tous(".cau__bouton").map((b) => b.textContent)].join(" ");
  verifier("textes fixes sans faute", fautesTypo(statiques).length === 0, fautesTypo(statiques).join());
}

async function testerEssor() {
  console.log("MAQUETTE DE LA FICHE 06 (causes-essor)");
  const { window, racine, donnees } = charger("causes-essor");
  const tous = (sel) => Array.from(racine.querySelectorAll(sel));
  const clic = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const carte = (id) => racine.querySelector(`.cau__carte[data-fait="${id}"]`);
  const panneau = racine.querySelector(".cau__panneau");
  verifier("composant présent et initialisé une fois", !!racine && racine.getAttribute("data-pret") === "1" && tous(".cau__fait").length === donnees.faits.length);
  verifier("8 faits, 8 liens", donnees.faits.length === 8 && donnees.faits.reduce((n, f) => n + (f.causes || []).length, 0) === 8);
  const visibles = tous(".cau__fait").filter((li) => !li.hidden).map((li) => li.getAttribute("data-fait"));
  verifier("les deux points de départ apparaissent avec le premier fait à expliquer", visibles.join() === "paix,techniques,surplus", visibles.join());
  verifier("le premier fait a deux causes", panneau.textContent.includes("Ce fait a 2 causes."));
  clic(carte("paix"));
  verifier("première cause trouvée, relance", panneau.textContent.includes("Lien trouvé!") && panneau.textContent.includes("Ce fait a une autre cause."));
  clic(carte("techniques"));
  verifier("seconde cause trouvée, Fait suivant offert", !!panneau.querySelector('[data-action="suivant"]'));
  const fautes = textesDonnees(donnees).map((t) => [t, fautesTypo(t)]).filter((x) => x[1].length);
  verifier("typographie des données", fautes.length === 0, fautes.map((x) => x[1].join("/") + " : " + x[0].slice(0, 50)).join(" | "));
  verifier("chaque cause précède son fait", donnees.faits.every((f, i) => (f.causes || []).every((c) => donnees.faits.findIndex((g) => g.id === c.de) < i)));
  const html = fs.readFileSync(path.join(RACINE, "contenu", "histoire", "06-essor-urbain.md"), "utf8");
  verifier("la maquette n'est pas insérée dans la fiche 06", !html.includes("causes-essor"));
  verifier("aucune œuvre ni bloc de crédits dans la maquette", !racine.classList.contains("a-oeuvres") && !racine.querySelector(".cau__credits") && !panneau.querySelector(".cau__oeuvre"));
}

(async () => {
  await testerRevolution();
  await testerEssor();
  console.log(echecs ? `\n${echecs} échec(s).` : "\nTous les contrôles passent.");
  process.exit(echecs ? 1 : 0);
})();
