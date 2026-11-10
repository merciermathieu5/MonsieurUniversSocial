/* Test des cinq comparateurs en mosaïque dans un DOM simulé.
 *     node outils/test_comparateurs.js
 * Vérifie, pour chacun : six tuiles à deux côtés, tout masqué au départ, l'affichage d'un élément
 * à la fois (un côté, l'autre, puis ce qui change), un seul critère ouvert, « Tout afficher »,
 * la réinitialisation et les textes.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log((ok ? "    ok     " : "    ECHEC  ") + nom + (ok || detail === undefined ? "" : "  (" + detail + ")"));
  if (!ok) { echecs++; }
}

const CAS = [
  { id: "risque-comparaison", p: "rqc", cotes: ["San Francisco", "Manille"], mot: "Ce qui change", tuile: "densite", attendu: [/7.200 hab\.\/km²/, /40.000 hab\.\/km²/, /évacuation est lente/] },
  { id: "energie-comparaison", p: "ecp", cotes: ["La Jamésie", "La Côte-Nord"], mot: "Ce qui change", tuile: "puissance", attendu: [/7.722 MW/, /2.660 MW/, /\S{4}/] },
  { id: "grands-lacs-comparaison", p: "glc", cotes: ["L'âge d'or industriel", "Aujourd'hui"], mot: "Ce qui change", tuile: "ville", attendu: [/1,85 million/, /640.000/, /banlieues/] },
  { id: "tourisme-comparaison", p: "tcp", cotes: ["La Gaspésie", "L'Île-de-France"], mot: "Ce qui change", tuile: "volume", attendu: [/945.100/, /49,1 millions/, /\S{4}/] },
  { id: "segregation-comparee", p: "sgc", cotes: ["Les lois Jim Crow", "L'apartheid"], mot: "Ce qui diffère", tuile: "vote", attendu: [/inscription empêchée/, /citoyenneté retirée/, /retire la citoyenneté/] },
];

CAS.forEach((cas) => {
  console.log(cas.id.toUpperCase());
  const source = fs.readFileSync(path.join(__dirname, "..", "theme", "composants", cas.id + ".html"), "utf8");
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="texte">${source}</div></body></html>`, { runScripts: "dangerously", pretendToBeVisual: true });
  const { document, Event, KeyboardEvent, CustomEvent } = dom.window;
  const racine = document.getElementById(cas.id);
  const P = cas.p;
  const tous = (s, r) => Array.from((r || racine).querySelectorAll(s));
  const un = (s, r) => (r || racine).querySelector(s);
  const clic = (el) => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const tuiles = tous(`.${P}__tuile`);
  const details = tous(`.${P}__detail`);

  const api = racine.comparateur;
  const tetes = tuiles.map((t) => un(`.${P}__tuile-tete`, t));
  const moitie = (cle, k) => un(`.${P}__tuile[data-critere="${cle}"] .${P}__moitie[data-cote="${k}"]`);
  const zone = (cle, k) => un(`#${P}-detail-${cle} [data-zone="${k}"]`);
  const vue = (cle, k) => !un(`.${P}__texte`, zone(cle, k)).hidden && un(`.${P}__voile`, zone(cle, k)).hidden;
  const ouvertes = () => tuiles.filter((t) => t.classList.contains("est-active")).map((t) => t.getAttribute("data-critere"));
  const visibles = () => details.filter((d) => !d.hidden).map((d) => d.id);
  const cles = tuiles.map((t) => t.getAttribute("data-critere"));
  const nbVus = () => { const v = api.etat().vus; return cles.reduce((n, c) => n + v[c].a + v[c].b + v[c].e, 0); };

  verifier("la section est prête et se réinitialise", racine.getAttribute("data-pret") === "1" && racine.hasAttribute("data-reinitialiser") && !!api);
  verifier("un en-tête avec un titre et une consigne", !!un(`.${P}__entete .${P}__titre`).textContent.trim() && /Touche un côté/.test(un(`.${P}__consigne`).textContent));
  verifier("la légende nomme les deux côtés, chacun avec sa couleur", tous(`.${P}__legende > li`).map((l) => l.textContent).join("|") === cas.cotes.join("|") && tous(`.${P}__legende .${P}__cle`).length === 2);
  verifier("six tuiles, six détails", tuiles.length === 6 && details.length === 6, tuiles.length + " / " + details.length);
  verifier("chaque tuile a un en-tête (pictogramme et nom) et deux côtés qui sont des boutons",
    tuiles.every((t) => un(`.${P}__tuile-tete`, t).tagName === "BUTTON" && un(`.${P}__tuile-tete .${P}__icone`, t) && un(`.${P}__tuile-nom`, t).textContent.trim() && tous(`button.${P}__moitie`, t).length === 2));
  verifier("chaque côté d'une tuile porte son nom et une valeur", tuiles.every((t) => tous(`.${P}__moitie-nom`, t).map((n) => n.textContent).join("|") === cas.cotes.join("|") && tous(`.${P}__moitie-valeur`, t).every((v) => v.textContent.trim().length > 2)));
  verifier("chaque en-tête commande son détail, placé juste après la tuile", tuiles.every((t, k) => { const d = document.getElementById(tetes[k].getAttribute("aria-controls")); return d && d === details[k] && d.previousElementSibling === t; }));
  verifier("chaque détail a deux côtés nommés, deux textes et ce qui change",
    details.every((d) => tous(`.${P}__lieu`, d).map((l) => l.textContent).join("|") === cas.cotes.join("|") && tous(`.${P}__cote p`, d).every((p) => p.textContent.length > 40) && un(`.${P}__ecart-texte strong`, d).textContent === cas.mot && un(`.${P}__ecart-texte span`, d).textContent.length > 40));
  verifier("au départ, tout est masqué : aucune valeur, aucun détail ouvert", nbVus() === 0 && visibles().length === 0 && tous(`.${P}__moitie-valeur`).every((v) => v.hidden) && tous(`.${P}__moitie`).every((m) => m.getAttribute("aria-expanded") === "false"));
  verifier("au départ, le bouton propose « Tout afficher »", un(`.${P}__outil`).textContent === "Tout afficher");

  const C = cas.tuile;
  clic(moitie(C, "a"));
  verifier("un clic sur le premier côté affiche sa valeur et son texte, pas l'autre côté ni l'écart",
    cas.attendu[0].test(un(`.${P}__moitie-valeur`, moitie(C, "a")).textContent) && !un(`.${P}__moitie-valeur`, moitie(C, "a")).hidden && un(`.${P}__moitie-valeur`, moitie(C, "b")).hidden && vue(C, "a") && !vue(C, "b") && !vue(C, "e") && nbVus() === 1);
  verifier("le critère s'ouvre et lui seul", ouvertes().join() === C && visibles().join() === `${P}-detail-${C}` && un(`.${P}__tuile[data-critere="${C}"] .${P}__tuile-tete`).getAttribute("aria-expanded") === "true");
  verifier("le côté affiché est annoncé", cas.attendu[0].test(un(`.${P}__annonce`).textContent));
  clic(un(`.${P}__voile`, zone(C, "b")));
  verifier("dans le détail, le voile du second côté l'affiche aussi dans la tuile", vue(C, "b") && cas.attendu[1].test(moitie(C, "b").textContent) && moitie(C, "b").getAttribute("aria-expanded") === "true" && !vue(C, "e"));
  clic(un(`.${P}__voile`, zone(C, "e")));
  verifier("« " + cas.mot + " » s'affiche en dernier, d'un clic", vue(C, "e") && cas.attendu[2].test(zone(C, "e").textContent) && nbVus() === 3);
  clic(moitie(C, "a"));
  verifier("recliquer sur un côté déjà affiché ne le masque pas", vue(C, "a") && nbVus() === 3);

  const autre = cles.find((c) => c !== C);
  clic(moitie(autre, "b"));
  verifier("afficher un côté d'un autre critère ouvre ce critère et referme le premier", ouvertes().join() === autre && visibles().length === 1 && vue(autre, "b") && !vue(autre, "a"));
  verifier("ce qui a été affiché le reste", api.etat().vus[C].a && api.etat().vus[C].b && api.etat().vus[C].e && !un(`.${P}__moitie-valeur`, moitie(C, "a")).hidden);
  const teteAutre = un(`.${P}__tuile[data-critere="${autre}"] .${P}__tuile-tete`);
  clic(teteAutre);
  verifier("l'en-tête referme le détail sans rien masquer", ouvertes().length === 0 && visibles().length === 0 && nbVus() === 4);
  clic(teteAutre);
  verifier("l'en-tête rouvre le détail, avec ses voiles pour ce qui reste à afficher", ouvertes().join() === autre && !un(`.${P}__voile`, zone(autre, "a")).hidden && !un(`.${P}__voile`, zone(autre, "e")).hidden);
  racine.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  verifier("Échap referme le détail et rend le focus à l'en-tête", ouvertes().length === 0 && document.activeElement === teteAutre && nbVus() === 4);

  clic(un(`.${P}__outil`));
  verifier("« Tout afficher » montre les 18 éléments et devient « Tout masquer »", nbVus() === 18 && tous(`.${P}__moitie-valeur`).every((v) => !v.hidden) && tous(`.${P}__voile`).every((v) => v.hidden) && un(`.${P}__outil`).textContent === "Tout masquer");
  clic(un(`.${P}__outil`));
  verifier("« Tout masquer » remet tous les voiles", nbVus() === 0 && tous(`.${P}__moitie-valeur`).every((v) => v.hidden) && un(`.${P}__outil`).textContent === "Tout afficher");
  clic(moitie(C, "a"));
  racine.dispatchEvent(new CustomEvent("reinitialiser"));
  verifier("la réinitialisation masque tout et referme tout", nbVus() === 0 && ouvertes().length === 0 && visibles().length === 0 && !un(`.${P}__attente`).hidden);
  clic(un(`.${P}__outil`));

  const propre = racine.cloneNode(true);
  tous("style, script", propre).forEach((el) => el.remove());
  const visible = propre.textContent;
  verifier("aucun tiret long ou moyen, aucune virgule devant « et »", !/[–—]/.test(visible) && !/, et /.test(visible));
  verifier("aucune espace avant ? ! ;", !/[  ][?!;]/.test(visible), (visible.match(/.{20}[  ][?!;]/) || [""])[0]);
  verifier("espace insécable avant le deux-points", !/ :/.test(visible), (visible.match(/.{20} :/) || [""])[0]);
  verifier("aucun « undefined » ni « NaN »", !/undefined|NaN/.test(propre.innerHTML));
  verifier("le style prévoit le thème sombre, le plein écran, l'impression et le mouvement réduit",
    /data-sombre="on"/.test(source) && /est-plein-ecran/.test(source) && /@media print/.test(source) && /prefers-reduced-motion/.test(source) && /::marker/.test(source));
});

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
