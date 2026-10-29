/*
 * Test du Congo de Léopold II en documents dans un DOM simulé.
 *     node outils/test_congo_documents.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "congo-documents.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>Le cas du Congo</h2>
${composant}
</section></article></main></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
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
const racine = document.getElementById("congo-documents");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
const un = (sel) => racine.querySelector(sel);
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const visibles = () => tous('[role="tabpanel"]').filter((p) => !p.hidden).map((p) => p.id).join();

(async () => {
  console.log("MISE EN PLACE");
  verifier("composant présent, id = nom du composant", !!racine);
  verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
  verifier("en-tête reconnu par page.js : un seul bouton Plein écran", tous(".cgo__entete .plein-ecran").length === 1);
  verifier("aucun titre h2 ou h3 dans le composant", tous("h2, h3").length === 0);
  verifier("aucune figure ni image", tous("figure, img").length === 0);
  const ids = tous("[id]", document).map((el) => el.id);
  verifier("aucun identifiant en double", new Set(ids).size === ids.length);
  verifier("cinq documents et un bilan", tous(".cgo__doc").length === 5 && tous(".cgo__bilan").length === 1);
  verifier("chaque document cite sa source avec un lien", tous(".cgo__doc").every((d) => d.querySelector(".cgo__source a[href^='https://']")));
  verifier("les extraits traduits ont leur original en anglais", tous(".cgo__original").length === 4 && tous(".cgo__original").every((o) => o.getAttribute("lang") === "en"));
  verifier("listes neutralisées dans le style", /\.cgo ul > li::before, \.cgo ol > li::before \{ content: none; \}/.test(composant) && /list-style: none/.test(composant));
  verifier("variantes sombres présentes", /html\[data-sombre="on"\] \.cgo/.test(composant));
  verifier("mouvement réduit et impression prévus", /prefers-reduced-motion/.test(composant) && /@media print/.test(composant));
  verifier("requêtes de conteneur pour le téléphone", /@container cgo \(max-width: 40rem\)/.test(composant));

  console.log("ARIA ET ONGLETS");
  const onglets = tous('[role="tab"]');
  verifier("six onglets dans une liste d'onglets", onglets.length === 6 && !!un('[role="tablist"]'));
  verifier("chaque onglet contrôle un panneau qui le nomme", onglets.every((o) => {
    const pan = document.getElementById(o.getAttribute("aria-controls"));
    return pan && pan.getAttribute("role") === "tabpanel" && pan.getAttribute("aria-labelledby") === o.id;
  }));
  verifier("un seul panneau visible au départ, le document 1", visibles() === "cgo-panneau-1");
  verifier("tabindex itinérant", onglets.filter((o) => o.getAttribute("tabindex") !== "-1").length === 1);
  onglets[0].focus();
  onglets[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  verifier("flèche droite : document 2 sélectionné et focalisé", visibles() === "cgo-panneau-2" && document.activeElement === onglets[1]);
  onglets[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  verifier("Fin : le bilan", visibles() === "cgo-panneau-6" && onglets[5].getAttribute("aria-selected") === "true");
  onglets[5].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  verifier("flèche droite au bout : retour au début", visibles() === "cgo-panneau-1");
  clic(onglets[2]);
  verifier("clic : document 3", visibles() === "cgo-panneau-3");

  console.log("PISTES ET ORIGINAUX");
  const b = un("#cgo-panneau-3 .cgo__question-bouton");
  const piste = document.getElementById(b.getAttribute("aria-controls"));
  verifier("piste cachée au départ", piste.hidden && b.getAttribute("aria-expanded") === "false");
  clic(b);
  verifier("piste ouverte, état annoncé", !piste.hidden && b.getAttribute("aria-expanded") === "true" && b.textContent === "Masquer la piste");
  clic(b);
  verifier("piste refermée", piste.hidden && b.textContent === "Piste de réponse");
  const o = un("#cgo-panneau-3 .cgo__original-bouton");
  clic(o);
  verifier("texte original affiché", !document.getElementById("cgo-original-3").hidden && o.getAttribute("aria-expanded") === "true");
  verifier("chaque question a sa piste", tous(".cgo__question").length === tous(".cgo__piste").length && tous(".cgo__question-bouton").length === tous(".cgo__piste").length);

  console.log("TRI DES DOCUMENTS");
  const ligne = (n) => un(`.cgo__tri > li[data-doc="${n}"]`);
  const choisir = (n, q, v) => clic(ligne(n).querySelector(`.cgo__choix[data-q="${q}"][data-v="${v}"]`));
  choisir(5, "vue", "defend");
  verifier("un seul choix : demande l'autre", /autre choix/.test(ligne(5).querySelector(".cgo__retour").textContent));
  choisir(5, "temoin", "non");
  verifier("mauvais choix : indice sans la réponse", ligne(5).querySelector(".cgo__retour").classList.contains("est-faux"));
  choisir(5, "vue", "denonce");
  verifier("bon choix : explication", ligne(5).querySelector(".cgo__retour").classList.contains("est-juste") && /piège/.test(ligne(5).querySelector(".cgo__retour").textContent));
  verifier("un seul bouton enfoncé par question", ligne(5).querySelectorAll('[data-q="vue"][aria-pressed="true"]').length === 1);
  choisir(1, "vue", "defend"); choisir(1, "temoin", "non");
  verifier("document 1 : défend, pas témoin", ligne(1).querySelector(".cgo__retour").classList.contains("est-juste"));
  verifier("les retours sont annoncés", tous(".cgo__retour").every((r) => r.getAttribute("aria-live") === "polite"));

  console.log("PLEIN ÉCRAN");
  clic(un(".cgo__entete .plein-ecran"));
  verifier("le bouton met l'interface en plein écran (simulé sans API)", racine.classList.contains("est-plein-ecran"));
  const replier = un(".cgo__replier");
  clic(replier);
  verifier("Masquer le texte : classe texte-masque et état annoncé", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && replier.textContent === "Afficher le texte");
  clic(replier);
  verifier("Afficher le texte : retour", !racine.classList.contains("texte-masque") && replier.textContent === "Masquer le texte");
  clic(replier);
  clic(un(".cgo__entete .plein-ecran"));
  await new Promise((r) => setTimeout(r, 0));
  verifier("en quittant le plein écran, le texte réapparaît", !racine.classList.contains("est-plein-ecran") && !racine.classList.contains("texte-masque"));
  const large = composant.split("@container cgo (min-width: 52.0625rem) {")[1] || "";
  verifier("plein écran large : un document court se centre sans couper le haut (marges automatiques)",
    large.includes("> .cgo__doc > :first-child { margin-top: auto; }") && large.includes("> .cgo__doc > :last-child { margin-bottom: auto; }"));
  verifier("plein écran large : l'extrait grandit avec l'écran (règle CSS)", /\.cgo\.est-plein-ecran \.cgo__extrait p \{ font-size: clamp\(1\.2rem, [^)]*vw/.test(large));
  verifier("la colonne des dates des conséquences suit la taille du texte (em)", composant.includes(".cgo__suites li { display: grid; grid-template-columns: 5.6em 1fr;"));

  console.log("TYPOGRAPHIE");
  tous(".cgo__question-bouton").forEach(clic);
  const sansCode = Array.from(racine.querySelectorAll("*")).filter((n) => !/^(SCRIPT|STYLE)$/.test(n.tagName) && !n.closest("[lang=en]"))
    .map((n) => Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join("")).join("\n")
    + "\n" + tous(".cgo__retour").map((r) => r.getAttribute("data-juste")).join("\n") + "\n"
    + (script.match(/"[^"\n]*"/g) || []).filter((c) => /[a-zé] /i.test(c)).join("\n");
  verifier("aucun tiret cadratin ou demi-cadratin", !/[–—]/.test(sansCode));
  verifier("aucune construction « , et »", !/, et /.test(sansCode), (sansCode.match(/.{20}, et .{10}/) || [])[0]);
  verifier("aucune espace avant ; ! ?", !/[   ][;!?]/.test(sansCode.replace(/\/\*[\s\S]*?\*\//g, "").replace(/ \? /g, "")), (sansCode.match(/.{15}[   ][;!?]/) || [])[0]);
  verifier("espace insécable avant le deux-points", !/[^ \s]:(\s|$)/.test(sansCode.split("(function")[0].replace(/https?:/g, "")), (sansCode.match(/.{15}[^ \s]:\s/) || [])[0]);
  verifier("espaces insécables dans les guillemets", !/«[^ ]|[^ ]»/.test(sansCode));
  verifier("espaces insécables dans les nombres", !/\d \d{3}/.test(sansCode) && /5 000/.test(sansCode));

  console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est correct.");
  process.exit(echecs ? 1 : 0);
})();
