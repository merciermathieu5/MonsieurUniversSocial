/*
 * Test du moteur « Enjeu » (instance etalement-enjeu, fiche de géographie 02) dans un DOM simulé.
 *     node outils/test_etalement_enjeu.js [composant.html]
 *
 * On vérifie les données (groupes, critères, référence au zonage agricole), le parcours en fenêtres
 * (départ, un groupe à la fois, bilan; Précédent, Suivant, pastilles, flèches, Échap), l'évaluation
 * conservée en revenant, le tableau de comparaison, la position et la synthèse avec sa rétroaction, le bouton Réinitialiser ajouté par page.js, le
 * texte repliable, les conventions du dépôt, la typographie, puis une seconde instance du moteur
 * avec d'autres données dans la même page.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const fichier = process.argv[2] || path.join(RACINE, "theme", "composants", "etalement-enjeu.html");
const composant = fs.readFileSync(fichier, "utf8");

// Seconde instance : même code, autre id, autres données.
const autresDonnees = {
  titre: "Le tourisme : qui propose quoi?", consigne: "Évalue les propositions", question: "Faut-il limiter les croisières?", intro: "Deux groupes s'opposent.",
  documents: [{ type: "reference", titre: "Un document", paragraphes: ["Un paragraphe."], chiffres: [{ valeur: "12", texte: "navires" }], source: "Source : essai." }],
  echelle: [{ valeur: 2, nom: "Oui" }, { valeur: 1, nom: "En partie" }, { valeur: 0, nom: "Non" }],
  criteres: [{ cle: "emplois", nom: "Crée des emplois", court: "Emplois", aide: "?", oui: "crée des emplois", non: "nuit aux emplois" }, { cle: "calme", nom: "Garde le quartier calme", court: "Calme", aide: "?", oui: "garde le quartier calme", non: "dérange les résidents" }],
  groupes: [{ cle: "port", nom: "Le port", court: "Port", qui: "Le port.", interets: ["Accueillir des navires."], proposition: "Plus de croisières.", arguments: ["Des retombées."], source: "Source : essai." },
            { cle: "residents", nom: "Les résidents", court: "Résidents", qui: "Les gens du quartier.", interets: ["Le calme."], proposition: "Moins de croisières.", arguments: ["La foule."], source: "Source : essai." }],
  textes: { groupes: "Les groupes", documents: "Les documents", masquer: "Masquer le texte", afficher: "Afficher le texte", evaluer: "Évalue la proposition", annonceReinit: "Réinitialisé" }
};
const second = composant
  .replace('id="etalement-enjeu"', 'id="tourisme-enjeu"')
  .replace(/<script type="application\/json" class="enj__donnees">[\s\S]*?<\/script>/, '<script type="application/json" class="enj__donnees">' + JSON.stringify(autresDonnees) + "</script>");

const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="geographie"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>L'étalement urbain</h2>
${composant}
${second}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.matchMedia = (q) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.lastIndexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
const racine = document.getElementById("etalement-enjeu");
const api = racine && racine.enjeu;
window.eval(script); // un second passage ne doit rien doubler

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
function clic(el) { if (el) el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const cote = () => un(".enj__cote").textContent;
const D = api && api.donnees;

const fen = () => un(".enj__fenetre").textContent;
const aller = (i) => clic(un(`.enj__etape[data-fenetre="${i}"]`));
const suivant = () => clic(un('.enj__nav [data-action="suivant"]'));
const precedent = () => clic(un('.enj__nav [data-action="precedent"]'));
const note = (cr, v) => un(`.enj__fenetre .enj__note[data-critere="${cr}"][data-valeur="${v}"]`);
const N = D ? D.groupes.length : 0, BILAN = N + 1;

console.log("MISE EN PLACE");
verifier("composant présent et initialisé une seule fois", !!api && racine.getAttribute("data-pret") === "1" && tous(".enj__etape").length === N + 2 && tous(".enj__fenetre").length === 1);
verifier("page.js ajoute Réinitialiser et Plein écran dans l'entête", !!un(".enj__entete .reinitialiser") && !!un(".enj__entete .plein-ecran") && racine.hasAttribute("data-reinitialiser"));
verifier("le titre vient des données", /qui propose quoi/.test(un(".enj__titre").textContent));

console.log("DONNÉES");
verifier("sept groupes en présence, chacun complet", D.groupes.length === 7 && D.groupes.every((g) => g.nom && g.qui && g.proposition && g.interets.length >= 2 && g.arguments.length >= 2 && /^Sources? :/.test(g.source)));
verifier("quatre critères avec leurs phrases pour la piste de justification", D.criteres.length === 4 && D.criteres.every((c) => c.nom && c.aide && c.oui && c.non));
const ref = D.documents.find((d) => d.type === "reference");
const refTexte = ref ? [ref.titre].concat(ref.paragraphes, ref.chiffres.map((c) => c.valeur + " " + c.texte), [ref.source]).join(" ") : "";
verifier("la référence au zonage agricole : loi de 1978, CPTAQ, exclusion, part du Grand Montréal", /zonage agricole/.test(refTexte) && /1978/.test(refTexte) && /CPTAQ/.test(refTexte) && /exclusion/.test(refTexte) && /58 %/.test(refTexte) && /P-41\.1/.test(refTexte));
verifier("les groupes attendus sont présents (UPA, CMM, banlieues, promoteurs, familles, Vivre en Ville, Québec)", ["upa", "cmm", "banlieues", "promoteurs", "familles", "vivreenville", "quebec"].every((k) => D.groupes.some((g) => g.cle === k)));

console.log("FENÊTRE DE DÉPART");
verifier("au départ : la question, le document de référence et les chiffres, une seule fenêtre", api.etat().fenetre === 0 && /sans sacrifier les terres agricoles/.test(fen()) && /zonage agricole/.test(fen()) && /58/.test(fen()) && tous(".enj__fenetre .enj__chiffre").length >= 6);
verifier("l'étape Départ est marquée en cours, Précédent est caché, Suivant invite à commencer", un('.enj__etape[data-fenetre="0"]').getAttribute("aria-current") === "step" && un('.enj__nav [data-action="precedent"]').hidden && /Commencer/.test(un('.enj__nav [data-action="suivant"]').textContent));
suivant();
verifier("le bouton Commencer (bas de la fenêtre) ouvre la fenêtre du premier groupe", api.etat().fenetre === 1 && /Les agriculteurs et l'UPA/.test(fen()));

console.log("UNE FENÊTRE PAR GROUPE");
verifier("la fenêtre montre qui c'est, la proposition bien en vue, les intérêts, les arguments et la source", /Union des producteurs agricoles/.test(fen()) && /Ne plus grignoter/.test(un(".enj__proposition").textContent) && /57.000/.test(fen()) && /Source/.test(fen()));
verifier("l'évaluation est dans la même fenêtre : 4 critères, 12 réponses", tous(".enj__fenetre .enj__critere").length === 4 && tous(".enj__fenetre .enj__note").length === 12);
verifier("l'indicateur dit « Groupe 1 sur 7 » et Précédent revient", /Groupe 1 sur 7/.test(un(".enj__nav-milieu").textContent) && !un('.enj__nav [data-action="precedent"]').hidden);
verifier("le focus est placé sur le titre de la nouvelle fenêtre et l'annonce suit", document.activeElement === un(".enj__fenetre-titre") && /Groupe 1 sur 7/.test(un(".enj__annonce").textContent));
clic(note("terres", 2)); clic(note("logement", 0));
verifier("une évaluation partielle est indiquée (2 sur 4) et la pastille passe à moitié", /2 critères évalués sur 4/.test(un(".enj__etat-eval").textContent) && un('.enj__etape[data-fenetre="1"]').classList.contains("est-partielle"));
suivant();
verifier("on peut passer au groupe suivant sans tout évaluer", api.etat().fenetre === 2 && /Communauté métropolitaine/.test(fen()) && /Groupe 2 sur 7/.test(un(".enj__nav-milieu").textContent));
clic(note("terres", 2)); clic(note("logement", 2)); clic(note("auto", 2)); clic(note("faisable", 1));
verifier("une évaluation complète est indiquée et la pastille se remplit", /Évaluation complète/.test(un(".enj__etat-eval").textContent) && un('.enj__etape[data-fenetre="2"]').classList.contains("est-complete"));
clic(note("faisable", 1));
verifier("cliquer de nouveau sur une réponse l'efface", api.etat().notes.cmm.faisable === undefined && /3 critères évalués sur 4/.test(un(".enj__etat-eval").textContent));
clic(note("faisable", 1));
precedent();
verifier("Précédent ramène au groupe 1, ses réponses sont conservées", api.etat().fenetre === 1 && note("terres", 2).getAttribute("aria-pressed") === "true" && note("logement", 0).getAttribute("aria-pressed") === "true");
racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
verifier("la flèche droite passe au groupe suivant", api.etat().fenetre === 2);
racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
verifier("la flèche gauche revient", api.etat().fenetre === 1);
aller(5);
verifier("une pastille d'étape ouvre directement sa fenêtre", api.etat().fenetre === 5 && /Les familles/.test(fen()));
clic(note("terres", 0)); clic(note("logement", 2)); clic(note("auto", 0)); clic(note("faisable", 2));
aller(5);
verifier("un second clic sur l'étape en cours revient au départ (désélection)", api.etat().fenetre === 0);
aller(6);
clic(note("terres", 2)); clic(note("logement", 1)); clic(note("auto", 2)); clic(note("faisable", 1));
racine.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
verifier("Échap revient au départ, les évaluations restent", api.etat().fenetre === 0 && Object.keys(api.etat().notes).length === 4);
aller(7);
verifier("au dernier groupe, Suivant devient « Voir le bilan »", /Voir le bilan/.test(un('.enj__nav [data-action="suivant"]').textContent));

console.log("LE BILAN");
suivant();
verifier("la fenêtre finale est le bilan, Suivant est caché", api.etat().fenetre === BILAN && /Le bilan/.test(un(".enj__fenetre-titre").textContent) && un('.enj__nav [data-action="suivant"]').hidden);
verifier("le bilan indique ce qui reste à évaluer, avec un lien vers chaque groupe", /Propositions évaluées : 3 sur 7/.test(un(".enj__reste").textContent.replace(/\u00a0/g, " ")) && tous(".enj__reste [data-fenetre]").length === 4);
const ligne = (cle) => { const b = tous(".enj__ligne-nom").find((x) => x.textContent.indexOf(D.groupes.find((g) => g.cle === cle).court) >= 0); return b && b.closest("tr"); };
verifier("le tableau compare les propositions avec leur score (Familles 4 / 8, CMM 7 / 8)", /4 \/ 8/.test(ligne("familles").querySelector(".enj__score").textContent) && /7 \/ 8/.test(ligne("cmm").querySelector(".enj__score").textContent) && ligne("upa").querySelectorAll(".enj__case--vide").length === 2);
clic(un('[data-appui="familles"]')); clic(un('[data-priorite="terres"]'));
const j = un(".enj__justif"); j.value = "Je veux une cour."; j.dispatchEvent(new window.Event("input", { bubbles: true }));
clic(un('[data-action="synthese"]'));
const synth = () => un(".enj__synthese").textContent;
verifier("la synthèse s'affiche avec la proposition et le critère choisis", !un(".enj__synthese").hidden && /Les familles qui cherchent une maison/.test(synth()) && /Protège les terres agricoles/.test(synth()));
verifier("rétroaction : le critère jugé le plus important n'est pas respecté par la proposition appuyée", /ne le respecte pas/.test(synth()));
verifier("rétroaction : une autre proposition a un meilleur score", /Communauté métropolitaine/.test(synth()) && /meilleur score/.test(synth()));
verifier("rétroaction : la justification est courte", /courte/.test(synth()));
verifier("la piste de justification reprend les critères notés Oui et une limite", /J'appuie la proposition de « Familles » parce qu'elle aide à loger plus de gens et qu'elle est réaliste\. Elle a toutefois une limite : elle menace les terres agricoles\./.test(synth()), api.phrasePiste());
verifier("aucune bonne réponse imposée", !/mauvaise|bonne réponse/i.test(synth()));
clic(ligne("upa").querySelector(".enj__ligne-nom"));
verifier("le nom d'un groupe dans le tableau ramène à sa fenêtre", api.etat().fenetre === 1);
aller(BILAN);
verifier("en revenant au bilan, la position, la justification et la synthèse sont conservées", un('[data-appui="familles"]').getAttribute("aria-pressed") === "true" && un(".enj__justif").value === "Je veux une cour." && !un(".enj__synthese").hidden);
clic(un('[data-appui="familles"]'));
verifier("cliquer de nouveau sur la proposition appuyée l'enlève", api.etat().appui === null);

console.log("TEXTE REPLIABLE ET RÉINITIALISATION");
const replier = un(".enj__replier");
clic(replier);
verifier("le bouton replie le texte (texte-masque) et change de libellé", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
clic(replier);
clic(un(".enj__entete .reinitialiser"));
const e = api.etat();
verifier("Réinitialiser revient à la fenêtre de départ et efface tout", e.fenetre === 0 && Object.keys(e.notes).length === 0 && e.appui === null && e.priorite === null && !e.synthese && e.justification === "" && /zonage agricole/.test(fen()));
verifier("après Réinitialiser, aucune pastille n'est remplie et l'annonce est faite", tous(".enj__etape.est-complete, .enj__etape.est-partielle").length === 0 && /Interface réinitialisée/.test(un(".enj__annonce").textContent));

console.log("SECONDE INSTANCE DU MOTEUR");
const r2 = document.getElementById("tourisme-enjeu");
verifier("une seconde instance avec d'autres données se construit dans la même page", !!r2 && !!r2.enjeu && r2.querySelectorAll(".enj__etape").length === 4 && /Le tourisme/.test(r2.querySelector(".enj__titre").textContent));
r2.querySelector('.enj__nav [data-action="suivant"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
r2.querySelector('.enj__note[data-critere="emplois"][data-valeur="2"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
verifier("elle fonctionne seule, sans toucher à la première", r2.enjeu.etat().notes.port.emplois === 2 && Object.keys(api.etat().notes).length === 0 && r2.querySelectorAll(".enj__fenetre .enj__critere").length === 2);
r2.enjeu.aller(3);
verifier("son bilan a son propre champ de justification", !!r2.querySelector('label[for="tourisme-enjeu-justif"]') && !!document.getElementById("tourisme-enjeu-justif"));

console.log("CONVENTIONS DU DÉPÔT");
verifier("aucun titre h2 ou h3 dans le composant", !/<h[23][\s>]/.test(composant));
verifier("listes sans puces (::before et ::marker neutralisés)", /\.enj ul > li::before, \.enj ol > li::before \{ content: none; display: none; \}/.test(composant) && /\.enj ul > li::marker, \.enj ol > li::marker \{ content: none; \}/.test(composant));
verifier("variantes sombres", (composant.match(/html\[data-sombre="on"\] \.enj/g) || []).length >= 6);
verifier("mouvement réduit respecté", /prefers-reduced-motion: reduce/.test(composant));
verifier("texte repliable en plein écran", /\.enj\.est-plein-ecran\.texte-masque \.enj__repliable/.test(composant) && /\.enj\.est-plein-ecran \{ display: flex;/.test(composant));
verifier("pas de font: inherit global sur les boutons", !/\.enj (button|\*) \{[^}]*font: inherit/.test(composant));
verifier("aucun id en double dans la page", (() => { const ids = tous("[id]", document).map((x) => x.id); return new Set(ids).size === ids.length; })());
verifier("le code ne contient pas de contenu propre à l'étalement urbain", (() => { const code = script; return !/UPA|CPTAQ|Montréal|étalement/i.test(code); })());

console.log("TYPOGRAPHIE");
const copie = racine.cloneNode(true); copie.querySelectorAll("style, script").forEach((n) => n.remove());
const texteDonnees = JSON.stringify(D).replace(/\\u00a0/g, " ");
const textes = copie.textContent + " " + [D.titre, D.question, D.intro].concat(D.documents.flatMap((d) => [d.titre].concat(d.paragraphes, d.chiffres.map((c) => c.texte), [d.source])), D.groupes.flatMap((g) => [g.nom, g.qui, g.proposition, g.source].concat(g.interets, g.arguments)), D.criteres.flatMap((c) => [c.nom, c.aide]), Object.values(D.textes)).join(" ");
verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(textes) && !/[–—]/.test(texteDonnees));
verifier("aucune virgule devant « et »", !/, et /.test(textes), (textes.match(/.{30}, et .{10}/) || [""])[0]);
verifier("espace insécable avant le deux-points", !/[^ \s]:(?![\d/])/.test(textes) && !/\w :/.test(textes), (textes.match(/.{25}[^ \s]:(?![\d/]).{5}/) || [""])[0]);
verifier("aucune espace avant ; ! ?", !/[  ][;!?]/.test(textes), (textes.match(/.{20}[  ][;!?].{5}/) || [""])[0]);
verifier("guillemets français avec espaces insécables", !/«[^ ]|[^ ]»/.test(textes));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
