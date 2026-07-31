/*
 * Comportements de la page : frise repliable, mode classe, thème sombre.
 *
 * Volontairement minimal. Il n'y a qu'un seul moteur de mise en page, celui
 * du CSS de la page. Ce fichier ne fait que poser des attributs.
 */
(function () {
  "use strict";

  var racine = document.documentElement;
  var corps = document.body;

  function bascule(bouton, cible, attribut, libelles) {
    if (!bouton) return;
    bouton.addEventListener("click", function () {
      var actif = cible.dataset[attribut] === "on";
      if (actif) { delete cible.dataset[attribut]; } else { cible.dataset[attribut] = "on"; }
      bouton.setAttribute("aria-pressed", String(!actif));
      if (libelles) bouton.lastChild.textContent = actif ? libelles[0] : libelles[1];
    });
  }

  // La frise reste repliée pour laisser la place au contenu.
  var frise = document.querySelector(".frise__bascule");
  if (frise) {
    frise.addEventListener("click", function () {
      var ouvert = frise.getAttribute("aria-expanded") === "true";
      frise.setAttribute("aria-expanded", String(!ouvert));
    });
  }

  var sommaire = document.querySelector('[data-bascule="sommaire"]');
  if (sommaire) {
    sommaire.addEventListener("click", function () {
      var replie = corps.dataset.sommaire === "replie";
      if (replie) { delete corps.dataset.sommaire; } else { corps.dataset.sommaire = "replie"; }
      sommaire.setAttribute("aria-expanded", String(replie));
    });
  }

  bascule(document.querySelector('[data-bascule="classe"]'), corps, "classe",
          [" Mode classe", " Quitter le mode classe"]);
  bascule(document.querySelector('[data-bascule="sombre"]'), racine, "sombre",
          [" Thème sombre", " Thème clair"]);

  /* ------------------------------------------------------------ diaporama
     Une surcouche du mode classe, pas un second moteur : la page reste la
     page, on ne fait que montrer une section à la fois. Les sections sont
     les H2 existants, découpés par le CSS grâce à un attribut posé ici. */

  var texte = document.querySelector(".fiche .texte");
  var sections = [];
  var courante = -1;
  var compteur = null;

  function decouperSections() {
    if (sections.length || !texte) return;
    var groupe = null;
    Array.prototype.forEach.call(texte.children, function (el) {
      if (el.tagName === "H2") {
        groupe = { titre: el, membres: [] };
        sections.push(groupe);
      } else if (groupe) {
        groupe.membres.push(el);
      }
    });
  }

  function montrer(index) {
    if (index < 0 || index >= sections.length) return;
    courante = index;
    sections.forEach(function (s, i) {
      var visible = i === index;
      s.titre.style.display = visible ? "" : "none";
      s.membres.forEach(function (m) { m.style.display = visible ? "" : "none"; });
    });
    if (compteur) compteur.textContent = (index + 1) + " / " + sections.length;
    window.scrollTo({ top: 0 });
  }

  function toutMontrer() {
    sections.forEach(function (s) {
      s.titre.style.display = "";
      s.membres.forEach(function (m) { m.style.display = ""; });
    });
  }

  function entrerDiapo() {
    decouperSections();
    if (!sections.length) return;
    corps.dataset.classe = "on";
    corps.dataset.diapo = "on";
    if (!compteur) {
      compteur = document.createElement("button");
      compteur.type = "button";
      compteur.className = "diapo-compteur";
      compteur.title = "Section courante. Flèches pour naviguer, Échap pour quitter.";
      compteur.addEventListener("click", sortirDiapo);
      document.body.appendChild(compteur);
    }
    compteur.style.display = "";
    montrer(0);
  }

  function sortirDiapo() {
    delete corps.dataset.diapo;
    toutMontrer();
    if (compteur) compteur.style.display = "none";
    courante = -1;
  }

  var boutonDiapo = document.querySelector('[data-bascule="diapo"]');
  if (boutonDiapo) boutonDiapo.addEventListener("click", function () {
    if (corps.dataset.diapo === "on") { sortirDiapo(); } else { entrerDiapo(); }
  });

  // Raccourcis : C pour le mode classe, N pour le thème sombre.
  document.addEventListener("keydown", function (e) {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === "c") { var b = document.querySelector('[data-bascule="classe"]'); if (b) b.click(); }
    if (e.key === "s") { var so = document.querySelector('[data-bascule="sommaire"]'); if (so) so.click(); }
    if (e.key === "n") { var s = document.querySelector('[data-bascule="sombre"]'); if (s) s.click(); }
    if (corps.dataset.diapo === "on") {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault(); montrer(courante + 1); return;
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault(); montrer(courante - 1); return;
      }
      if (e.key === "Escape") { sortirDiapo(); return; }
    }
    if (e.key === "p") { var d = document.querySelector('[data-bascule="diapo"]'); if (d) d.click(); }
    if (e.key === "Escape") { delete corps.dataset.classe;
      var b2 = document.querySelector('[data-bascule="classe"]');
      if (b2) { b2.setAttribute("aria-pressed", "false"); b2.lastChild.textContent = " Mode classe"; } }
  });
})();
