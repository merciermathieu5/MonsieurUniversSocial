/*
 * Test de la carte des cités de Mésopotamie et d'Égypte dans un DOM simulé.
 *     node outils/test_cites.js
 *
 * Le composant est inséré dans une fiche minimale, avec page.js quand il est
 * présent, pour vérifier aussi qu'il ne gêne pas les raccourcis de la page.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = path.join(__dirname, "..");
const composant = fs.readFileSync(path.join(RACINE, "theme", "composants", "cites-mesopotamie-egypte.html"), "utf8");
const html = `<!DOCTYPE html><html lang="fr-CA" data-couleur="histoire"><head><meta charset="utf-8"></head>
<body><main><article class="fiche"><section class="texte"><h2>La Mésopotamie et le Croissant fertile</h2>
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
// Un second passage du script ne doit rien doubler.
window.eval(script);

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`    ${ok ? "ok     " : "ECHEC  "}${nom}${!ok && detail !== undefined ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
const racine = document.getElementById("cites-carte");
const tous = (sel, base) => Array.from((base || racine).querySelectorAll(sel));
function clic(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
const vueVisible = () => {
  const v = tous(".cme__svg.est-visible");
  return v.length === 1 ? v[0].getAttribute("data-carte") : v.map((x) => x.getAttribute("data-carte")).join("+") || null;
};
const carte = (nom) => racine.querySelector(`.cme__svg[data-carte="${nom}"]`);
const panneauxVisibles = () => tous(".cme__panneau.est-visible").map((p) => p.getAttribute("data-lieu"));
const boutonsPresses = () => tous('.cme__bouton[aria-pressed="true"]').map((b) => b.getAttribute("data-lieu"));

console.log("MISE EN PLACE");
verifier("composant présent", !!racine);
verifier("initialisé une seule fois", racine.getAttribute("data-pret") === "1" && racine.classList.contains("est-pret"));
verifier("quatre vues", tous(".cme__svg").length === 4, tous(".cme__svg").length);
verifier("la vue d'ensemble s'affiche au départ", vueVisible() === "ensemble", vueVisible());
verifier("le panneau d'accueil s'affiche au départ", panneauxVisibles().join() === "accueil", panneauxVisibles().join());
verifier("aucun lieu choisi au départ", boutonsPresses().length === 0 && tous(".est-choisi").length === 0);
const boutons = tous(".cme__bouton");
verifier("24 boutons : 10 cités, 6 villes, 8 fleuves et mers", boutons.length === 24, boutons.length);
verifier("un panneau par bouton, relié par aria-controls",
  boutons.every((b) => { const p = document.getElementById(b.getAttribute("aria-controls")); return p && p.getAttribute("data-lieu") === b.getAttribute("data-lieu"); }));
const ids = tous("[id]", document).map((el) => el.id);
verifier("aucun identifiant en double", new Set(ids).size === ids.length);
verifier("chaque <use> vise un tracé existant",
  tous("use").every((u) => document.getElementById((u.getAttribute("href") || "").slice(1))));
verifier("aucun titre de niveau 2 ou 3 dans le composant", tous("h2, h3").length === 0);
verifier("aucune figure, que le moteur déplacerait en galerie", tous("figure").length === 0);

console.log("POINTS");
const villes = boutons.filter((b) => b.getAttribute("data-vues") === b.getAttribute("data-vue") && racine.querySelector(`.cme__point[data-lieu="${b.getAttribute("data-lieu")}"]`));
verifier("16 lieux habités", villes.length === 16, villes.length);
villes.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  const vue = b.getAttribute("data-vue");
  const point = carte(vue).querySelector(`.cme__point[data-lieu="${cle}"]`);
  const nom = point && point.querySelector(".cme__nom");
  verifier(`${b.textContent} est nommée dans la vue ${vue}`,
    point && !point.classList.contains("cme__point--reduit") && nom && nom.textContent === b.textContent);
});
verifier("dans la vue d'ensemble, tous les points sont réduits",
  tous(".cme__point", carte("ensemble")).every((p) => p.classList.contains("cme__point--reduit")));
verifier("chaque lieu n'est nommé que dans une seule vue",
  villes.every((b) => tous(`.cme__point[data-lieu="${b.getAttribute("data-lieu")}"]:not(.cme__point--reduit)`).length === 1));

console.log("CHOIX D'UN LIEU");
villes.forEach((b) => {
  clic(carte("ensemble").parentNode.querySelector('.cme__vue[data-vue="ensemble"]'));
  clic(b);
  const cle = b.getAttribute("data-lieu");
  const ok = vueVisible() === b.getAttribute("data-vue")
    && panneauxVisibles().join() === cle
    && boutonsPresses().join() === cle
    && carte(b.getAttribute("data-vue")).querySelector(`.cme__point[data-lieu="${cle}"]`).classList.contains("est-choisi");
  verifier(`${b.textContent} : bonne vue, point et panneau`, ok, `${vueVisible()} / ${panneauxVisibles()}`);
});

console.log("FLEUVES ET MERS");
const eaux = boutons.filter((b) => !villes.includes(b));
verifier("8 fleuves et mers", eaux.length === 8, eaux.map((b) => b.textContent).join());
eaux.forEach((b) => {
  const cle = b.getAttribute("data-lieu");
  const vues = b.getAttribute("data-vues").split(" ");
  // Depuis une vue où il n'apparaît pas, on bascule vers sa vue par défaut.
  const ailleurs = ["ensemble", "mesopotamie", "sumer", "egypte"].find((v) => !vues.includes(v));
  if (ailleurs) {
    clic(racine.querySelector(`.cme__vue[data-vue="${ailleurs}"]`));
    clic(b);
    verifier(`${b.textContent} : depuis ${ailleurs}, bascule vers ${b.getAttribute("data-vue")}`, vueVisible() === b.getAttribute("data-vue"), vueVisible());
  }
  // Depuis une vue où il apparaît, la carte reste en place.
  vues.forEach((v) => {
    clic(racine.querySelector(`.cme__vue[data-vue="${v}"]`));
    clic(b);
    const surCarte = tous(`[data-lieu="${cle}"]`, carte(v)).filter((el) => el.classList.contains("cme__fleuve") || el.classList.contains("cme__eau"));
    verifier(`${b.textContent} : visible et mis en évidence dans la vue ${v}`,
      vueVisible() === v && surCarte.length > 0 && surCarte.every((el) => el.classList.contains("est-choisi")) && panneauxVisibles().join() === cle,
      `${vueVisible()} ${surCarte.length}`);
  });
});

console.log("CARTE");
clic(racine.querySelector('.cme__vue[data-vue="ensemble"]'));
clic(carte("ensemble").querySelector('.cme__zoom[data-zoom="mesopotamie"]'));
verifier("le cadre de la Mésopotamie agrandit la carte", vueVisible() === "mesopotamie", vueVisible());
clic(carte("mesopotamie").querySelector('.cme__zoom[data-zoom="sumer"]'));
verifier("le cadre de Sumer agrandit la carte", vueVisible() === "sumer", vueVisible());
clic(racine.querySelector('.cme__vue[data-vue="ensemble"]'));
clic(carte("ensemble").querySelector('.cme__zoom[data-zoom="egypte"]'));
verifier("le cadre de l'Égypte agrandit la carte", vueVisible() === "egypte", vueVisible());
verifier("le bouton de vue suit la carte",
  tous('.cme__vue[aria-pressed="true"]').map((b) => b.getAttribute("data-vue")).join() === "egypte");
clic(carte("egypte").querySelector('.cme__point[data-lieu="thebes"]'));
verifier("un clic sur un point choisit la ville sans changer de vue",
  vueVisible() === "egypte" && panneauxVisibles().join() === "thebes" && boutonsPresses().join() === "thebes");
clic(carte("egypte").querySelector('.cme__fleuve[data-lieu="nil"]'));
verifier("un clic sur le Nil le choisit", panneauxVisibles().join() === "nil" && boutonsPresses().join() === "nil");
clic(carte("egypte").querySelector('.cme__eau[data-lieu="rouge"]'));
verifier("un clic sur la mer Rouge la choisit", panneauxVisibles().join() === "rouge");
clic(racine.querySelector('.cme__vue[data-vue="sumer"]'));
const chatt = carte("sumer").querySelector(".cme__fleuve--chatt");
clic(chatt);
verifier("le Chatt el-Arab n'est pas un lieu à choisir", !chatt.hasAttribute("data-lieu") && panneauxVisibles().join() === "rouge");
clic(racine.querySelector('.cme__vue[data-vue="ensemble"]'));
clic(carte("ensemble").querySelector('.cme__point--reduit[data-lieu="ur"]'));
verifier("un point réduit ne choisit rien", panneauxVisibles().join() === "rouge" && vueVisible() === "ensemble");

console.log("PLEIN ÉCRAN");
const pleinBouton = racine.querySelector(".cme__entete > .plein-ecran");
verifier("le bouton Plein écran est dans l'en-tête", !!pleinBouton);
const replier = racine.querySelector(".cme__replier");
verifier("le bouton qui replie les textes existe", !!replier && replier.getAttribute("aria-expanded") === "true");
if (pleinBouton) {
  clic(pleinBouton);
  verifier("la carte passe en plein écran", racine.classList.contains("est-plein-ecran"));
  verifier("les textes sont rangés à côté de la carte", !!racine.querySelector(".cme__cote > .cme__contenu") && !!racine.querySelector(".cme__cote > .cme__choix"));
  clic(replier);
  verifier("les textes se replient", racine.classList.contains("texte-masque") && replier.getAttribute("aria-expanded") === "false" && /Afficher/.test(replier.textContent));
  clic(replier);
  verifier("puis se déploient", !racine.classList.contains("texte-masque") && /Masquer/.test(replier.textContent));
  clic(pleinBouton);
  verifier("un second clic quitte le plein écran", !racine.classList.contains("est-plein-ecran"));
}

console.log("TEXTES");
const texte = racine.textContent;
verifier("aucun tiret cadratin ni demi-cadratin", !/[\u2014\u2013]/.test(texte));
verifier("dates en négatif, sans « av. J.-C. »", !/av\.\s*J\.-C\./.test(texte));
verifier("chaque panneau a un lieu, un rôle et un texte",
  tous(".cme__panneau:not(.cme__panneau--accueil)").every((p) => p.querySelector(".cme__lieu") && p.querySelector(".cme__role") && p.querySelector(".cme__detail").textContent.length > 80));
verifier("chaque vue a une description pour les lecteurs d'écran",
  tous(".cme__svg").every((s) => s.getAttribute("role") === "img" && (s.getAttribute("aria-label") || "").length > 40));
verifier("la source nomme Natural Earth et Pleiades", /Natural Earth/.test(texte) && /Pleiades/.test(texte));

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est conforme.");
process.exit(echecs ? 1 : 0);
