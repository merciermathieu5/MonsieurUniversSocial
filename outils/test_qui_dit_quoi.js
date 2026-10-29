/*
 * Test de l'activité de tri « Libéralisme, socialisme, syndicalisme : qui dit quoi? ».
 *     node outils/test_qui_dit_quoi.js
 *
 * Le hasard est remplacé par une suite fixe : le mélange des énoncés devient
 * reproductible d'un lancement à l'autre.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "qui-dit-quoi.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La naissance du syndicalisme</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
let graine = 7;
window.Math.random = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
const pageJs = path.join(RACINE, "theme", "page.js");
if (fs.existsSync(pageJs)) window.eval(fs.readFileSync(pageJs, "utf8"));
const script = composant.slice(composant.indexOf("<script>") + 8, composant.lastIndexOf("</script>"));
window.eval(script);
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const racine = document.getElementById("qui-dit-quoi");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel, base) => (base || racine).querySelector(sel);
const q = (cle) => un(`[data-qdq="${cle}"]`);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const texte = (el) => (el ? el.textContent.replace(/ /g, " ").trim() : "");
const DOCTRINE = (i) => ["lib", "soc", "syn"][Math.floor(i / 4)];
const NOM = { lib: "Libéralisme", soc: "Socialisme", syn: "Syndicalisme" };

const fautes = new Set();
function controlerTypo(etat) {
  const marcheur = document.createTreeWalker(racine, window.NodeFilter.SHOW_TEXT);
  let n;
  while ((n = marcheur.nextNode())) {
    const parent = n.parentElement;
    if (!parent || parent.closest("script, style, [lang='en']")) continue;
    const t = n.nodeValue;
    if (!t.trim()) continue;
    const signaler = (motif) => fautes.add(`${etat} : ${motif} dans « ${t.trim().slice(0, 70)} »`);
    if (/ :/.test(t)) signaler("espace ordinaire devant le deux-points");
    if (/[   ][;!?]/.test(t)) signaler("espace devant ; ! ?");
    if (/« /.test(t) || / »/.test(t)) signaler("espace ordinaire dans les guillemets");
    if (/«(?! )/.test(t) || /(?<! )»/.test(t)) signaler("guillemet sans insécable");
    if (/[–—]/.test(t)) signaler("tiret long");
    if (/, et /.test(t)) signaler("construction « , et »");
    if (/\d \d{3}\b/.test(t)) signaler("espace ordinaire dans un nombre");
  }
}

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1");
verifier("trois boutons de doctrine, sans doublon", tous(".qdq__choix .qdq__bouton").length === 3, tous(".qdq__choix .qdq__bouton").length);
verifier("trois bacs vides au départ", tous(".qdq__bac").length === 3 && tous(".qdq__jetons > li").length === 0);
verifier("aucun titre de niveau 2 ou 3", tous("h2, h3").length === 0);
verifier("aucune figure ni image", tous("figure, img").length === 0);
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("l'en-tête porte le bouton Plein écran", !!un(".qdq__entete .plein-ecran"));
verifier("le groupe de boutons est nommé par la question", un(".qdq__choix").getAttribute("aria-labelledby") === "qdq-question" && !!document.getElementById("qdq-question"));
verifier("progression au départ", texte(q("progres")) === "Énoncé 1 sur 12" && texte(q("score")) === "0 bonne réponse");
verifier("l'aide-mémoire définit les trois doctrines", tous(".qdq__definitions dt").map(texte).join() === "Libéralisme,Socialisme,Syndicalisme");
controlerTypo("départ");

console.log("UNE MANCHE COMPLÈTE");
const vus = [];
let bons = 0;
for (let k = 0; k < 12; k++) {
  const i = +q("carte").getAttribute("data-enonce");
  vus.push(i);
  const enonce = texte(q("enonce"));
  verifier(`énoncé ${k + 1} entre guillemets, avec son type`, /^« .+ »$/.test(enonce) && texte(q("type")).length > 5, enonce.slice(0, 40));
  const juste = k % 3 !== 2;
  const bonne = DOCTRINE(i);
  const choisi = juste ? bonne : ["lib", "soc", "syn"].find((d) => d !== bonne);
  clic(un(`.qdq__choix [data-doctrine="${choisi}"]`));
  if (juste) bons++;
  const retour = q("retour");
  verifier(`énoncé ${k + 1} : rétroaction ${juste ? "positive" : "corrective"} avec l'auteur et la source`,
    !retour.hidden && (juste ? /^Bonne réponse!/.test(texte(un(".qdq__verdict", retour))) : new RegExp("relève du " + NOM[bonne].toLowerCase()).test(texte(un(".qdq__verdict", retour)))) &&
    /^Qui parle\? /.test(texte(un(".qdq__qui", retour))) && un(".qdq__source a", retour) && /^https:\/\//.test(un(".qdq__source a", retour).href));
  verifier(`énoncé ${k + 1} : la bonne doctrine est marquée, les boutons bloqués`,
    un(`.qdq__choix [data-doctrine="${bonne}"]`).classList.contains("est-bonne") && tous(".qdq__choix .qdq__bouton").every((b) => b.disabled) &&
    (juste || un(`.qdq__choix [data-doctrine="${choisi}"]`).classList.contains("est-erreur")));
  const jetons = tous(`[data-bac="${bonne}"] .qdq__jetons > li`);
  const dernier = jetons[jetons.length - 1];
  verifier(`énoncé ${k + 1} : rangé dans le bac ${NOM[bonne]}`, dernier && (juste ? /Bien classé/.test(texte(dernier)) : /Tu avais choisi : /.test(texte(dernier))));
  const avant = texte(q("score"));
  clic(un(`.qdq__choix [data-doctrine="${bonne}"]`));
  verifier(`énoncé ${k + 1} : un second clic ne compte pas deux fois`, texte(q("score")) === avant);
  controlerTypo(`énoncé ${i}`);
  verifier(`énoncé ${k + 1} : bouton ${k === 11 ? "Voir le bilan" : "Énoncé suivant"}`, !q("suivant").hidden && texte(q("suivant")) === (k === 11 ? "Voir le bilan" : "Énoncé suivant"));
  clic(q("suivant"));
}
verifier("les 12 énoncés passent une seule fois", new Set(vus).size === 12 && vus.length === 12, vus.join());
verifier("le mélange change l'ordre de départ", vus.join() !== "0,1,2,3,4,5,6,7,8,9,10,11");
verifier("chaque bac reçoit ses 4 énoncés", ["lib", "soc", "syn"].every((d) => tous(`[data-bac="${d}"] .qdq__jetons > li`).length === 4 && texte(un(`[data-bac="${d}"] .qdq__bac-titre span`)) === "4"));
verifier("le bilan remplace la carte", q("carte").hidden && !q("bilan").hidden);
verifier(`le bilan compte ${bons} sur 12`, new RegExp(`Tu as bien classé ${bons} énoncés sur 12`).test(texte(q("bilan"))), texte(q("bilan")).slice(0, 80));
verifier("le bilan détaille chaque doctrine", /Libéralisme : \d sur 4/.test(texte(q("bilan"))) && /Syndicalisme : \d sur 4/.test(texte(q("bilan"))));
verifier("trois fiches de synthèse", tous(".qdq__fiche").length === 3);
verifier("progression terminée", texte(q("progres")) === "Terminé : 12 énoncés classés");
controlerTypo("bilan");

console.log("REPRISE");
const erreurs = 12 - bons;
const reprendre = q("erreurs");
verifier(`bouton Reprendre mes erreurs (${erreurs})`, reprendre && texte(reprendre) === `Reprendre mes erreurs (${erreurs})`);
clic(reprendre);
verifier("la reprise ne garde que les erreurs", texte(q("progres")) === `Énoncé 1 sur ${erreurs}` && !q("carte").hidden && q("bilan").hidden);
verifier("les bacs sont vidés", tous(".qdq__jetons > li").length === 0);
for (let k = 0; k < erreurs; k++) {
  const i = +q("carte").getAttribute("data-enonce");
  clic(un(`.qdq__choix [data-doctrine="${DOCTRINE(i)}"]`));
  clic(q("suivant"));
}
verifier("reprise réussie : bravo sans faute", /Bravo, sans faute!/.test(texte(q("bilan"))) && !q("erreurs"));
clic(q("recommencer"));
verifier("Recommencer repart avec les 12 énoncés", texte(q("progres")) === "Énoncé 1 sur 12" && texte(q("score")) === "0 bonne réponse");

console.log("PLEIN ÉCRAN");
const bouton = un(".qdq__entete .plein-ecran");
clic(bouton);
verifier("le bouton passe l'interface en plein écran", racine.classList.contains("est-plein-ecran"));
const replier = q("replier");
clic(replier);
verifier("Masquer l'aide-mémoire replie le panneau", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && texte(replier) === "Afficher l'aide-mémoire");
clic(replier);
verifier("Afficher l'aide-mémoire le rouvre", !racine.classList.contains("texte-masque"));
clic(bouton);
verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
const large = composant.split("@media (min-width: 50.0625rem) and (min-aspect-ratio: 1001/1000) {")[1] || "";
verifier("plein écran large : les bacs remplissent la hauteur sous l'énoncé (règles CSS)",
  large.includes(".qdq.est-plein-ecran .qdq__scene { display: flex; flex-direction: column;")
  && large.includes(".qdq.est-plein-ecran .qdq__bacs { flex: 1 0 auto;"));
verifier("plein écran large : l'énoncé et les choix grandissent avec l'écran (règles CSS)",
  /\.qdq\.est-plein-ecran \.qdq__enonce \{ font-size: clamp\(1\.5rem, [^)]*vw[^)]*\); \}/.test(large)
  && /\.qdq\.est-plein-ecran \.qdq__choix \.qdq__bouton \{ font-size: clamp\(/.test(large));

console.log("TYPOGRAPHIE");
verifier("aucune faute typographique dans les textes affichés", fautes.size === 0, Array.from(fautes).slice(0, 6).join(" | "));
verifier("aucun tiret long dans le fichier", !/[–—]/.test(composant));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
