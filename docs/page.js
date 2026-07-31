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
  var barre = null;
  var echelle = 1;
  var position = null;
  var etiquette = null;

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
    if (position) position.textContent = (index + 1) + " / " + sections.length;
    if (etiquette) etiquette.textContent = sections[index].titre.textContent;
    window.scrollTo({ top: 0 });
  }

  function toutMontrer() {
    sections.forEach(function (s) {
      s.titre.style.display = "";
      s.membres.forEach(function (m) { m.style.display = ""; });
    });
  }

  function zoomer(pas) {
    echelle = Math.min(1.8, Math.max(0.7, Math.round((echelle + pas) * 10) / 10));
    racine.style.setProperty("--echelle", echelle);
  }

  function libelleTheme() {
    return racine.dataset.sombre === "on" ? "Clair" : "Sombre";
  }

  function creerBarre() {
    barre = document.createElement("div");
    barre.className = "diapo-barre";
    barre.innerHTML =
      '<button type="button" data-d="prec" aria-label="Section précédente">&#8592;</button>' +
      '<span class="diapo-position"></span>' +
      '<button type="button" data-d="suiv" aria-label="Section suivante">&#8594;</button>' +
      '<span class="diapo-titre"></span>' +
      '<button type="button" data-d="reduire" aria-label="Réduire le texte">A&#8722;</button>' +
      '<button type="button" data-d="agrandir" aria-label="Agrandir le texte">A+</button>' +
      '<button type="button" data-d="theme"></button>' +
      '<button type="button" data-d="quitter">Quitter</button>';
    document.body.appendChild(barre);
    position = barre.querySelector(".diapo-position");
    etiquette = barre.querySelector(".diapo-titre");
    barre.querySelector('[data-d="theme"]').textContent = libelleTheme();

    barre.addEventListener("click", function (ev) {
      var bouton = ev.target.closest("button");
      if (!bouton) return;
      var action = bouton.dataset.d;
      if (action === "prec") montrer(courante - 1);
      if (action === "suiv") montrer(courante + 1);
      if (action === "quitter") sortirDiapo();
      if (action === "reduire") zoomer(-0.1);
      if (action === "agrandir") zoomer(0.1);
      if (action === "theme") {
        var s = document.querySelector('[data-bascule="sombre"]');
        if (s) s.click(); else {
          if (racine.dataset.sombre === "on") { delete racine.dataset.sombre; }
          else { racine.dataset.sombre = "on"; }
        }
        bouton.textContent = libelleTheme();
      }
    });
  }

  function entrerDiapo() {
    decouperSections();
    if (!sections.length) return;
    corps.dataset.classe = "on";
    corps.dataset.diapo = "on";
    if (!barre) creerBarre();
    barre.style.display = "";
    barre.querySelector('[data-d="theme"]').textContent = libelleTheme();
    montrer(0);
  }

  function sortirDiapo() {
    delete corps.dataset.diapo;
    toutMontrer();
    if (barre) barre.style.display = "none";
    courante = -1;
  }

  var boutonDiapo = document.querySelector('[data-bascule="diapo"]');
  if (boutonDiapo) boutonDiapo.addEventListener("click", function () {
    if (corps.dataset.diapo === "on") { sortirDiapo(); } else { entrerDiapo(); }
  });

  /* ---------------------------------------------------------- visionneuse */

  function ouvrirVisionneuse(img) {
    var figure = img.closest("figure");
    var legende = "";
    if (figure) {
      var noeud = figure.querySelector(".figure-legende");
      legende = noeud ? noeud.textContent : "";
    }
    var voile = document.createElement("div");
    voile.className = "visionneuse";
    voile.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="visionneuse__fermer" aria-label="Fermer">&#10005;</button>';
    voile.querySelector("img").src = img.currentSrc || img.src;
    voile.querySelector("img").alt = img.alt || "";
    voile.querySelector("figcaption").textContent = legende || img.alt || "";
    document.body.appendChild(voile);
    corps.dataset.visionneuse = "on";
    voile.addEventListener("click", fermerVisionneuse);
  }

  function fermerVisionneuse() {
    var voile = document.querySelector(".visionneuse");
    if (voile) voile.remove();
    delete corps.dataset.visionneuse;
  }

  document.addEventListener("click", function (e) {
    var img = e.target.closest(".illustration img");
    if (img && !e.target.closest(".visionneuse")) ouvrirVisionneuse(img);
  });

  // Raccourcis : C pour le mode classe, N pour le thème sombre.
  document.addEventListener("keydown", function (e) {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (corps.dataset.visionneuse === "on") {
      if (e.key === "Escape") fermerVisionneuse();
      return;
    }
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
      if (e.key === "+" || e.key === "=") { zoomer(0.1); return; }
      if (e.key === "-") { zoomer(-0.1); return; }
    }
    if (e.key === "p") { var d = document.querySelector('[data-bascule="diapo"]'); if (d) d.click(); }
    if (e.key === "Escape") { delete corps.dataset.classe;
      var b2 = document.querySelector('[data-bascule="classe"]');
      if (b2) { b2.setAttribute("aria-pressed", "false"); b2.lastChild.textContent = " Mode classe"; } }
  });
})();
