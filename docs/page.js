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

  bascule(document.querySelector('[data-bascule="classe"]'), corps, "classe",
          [" Mode classe", " Quitter le mode classe"]);
  bascule(document.querySelector('[data-bascule="sombre"]'), racine, "sombre",
          [" Thème sombre", " Thème clair"]);

  // Raccourcis : C pour le mode classe, N pour le thème sombre.
  document.addEventListener("keydown", function (e) {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === "c") { var b = document.querySelector('[data-bascule="classe"]'); if (b) b.click(); }
    if (e.key === "n") { var s = document.querySelector('[data-bascule="sombre"]'); if (s) s.click(); }
    if (e.key === "Escape") { delete corps.dataset.classe;
      var b2 = document.querySelector('[data-bascule="classe"]');
      if (b2) { b2.setAttribute("aria-pressed", "false"); b2.lastChild.textContent = " Mode classe"; } }
  });
})();
