/* =========================================================================
   Mode projection

   Chaque titre de niveau 2 d'une fiche devient un panneau plein écran. La
   découpe ne demande aucun travail d'écriture supplémentaire : elle réutilise
   la structure que les fiches ont déjà.

   Flèches ou espace pour avancer, Échap pour sortir, + et - pour la taille.
   ========================================================================= */

(function () {
  "use strict";

  var texte = document.querySelector(".fiche .texte");
  if (!texte) return;

  var corps = document.body;
  var panneaux = [];
  var courant = 0;
  var echelle = 1;
  var construit = false;

  /* ------------------------------------------------------ mise en panneaux */

  function decouper() {
    if (construit) return;

    var titre = document.querySelector(".entete h1");
    var groupes = [];
    var encours = null;

    Array.prototype.slice.call(texte.children).forEach(function (element) {
      if (element.tagName === "H2") {
        encours = { titre: element, blocs: [] };
        groupes.push(encours);
      } else if (encours) {
        encours.blocs.push(element);
      } else {
        // Tout ce qui précède le premier H2 forme le panneau d'ouverture.
        if (!groupes.length) {
          encours = { titre: null, blocs: [] };
          groupes.push(encours);
        }
        encours.blocs.push(element);
      }
    });

    var scene = document.createElement("div");
    scene.className = "scene";

    groupes.forEach(function (groupe, index) {
      var panneau = document.createElement("section");
      panneau.className = "panneau";

      var entete = document.createElement("header");
      entete.className = "panneau__entete";
      var surtitre = document.createElement("p");
      surtitre.className = "panneau__surtitre";
      surtitre.textContent = titre ? titre.textContent : "";
      entete.appendChild(surtitre);
      if (groupe.titre) {
        var h = document.createElement("h2");
        h.textContent = groupe.titre.textContent;
        entete.appendChild(h);
      }
      panneau.appendChild(entete);

      // Les illustrations et les vidéos partent à droite, le texte reste à
      // gauche. Sur un écran de classe, c'est ce qui se lit le mieux.
      var colonneTexte = document.createElement("div");
      colonneTexte.className = "panneau__texte";
      var colonneVisuels = document.createElement("div");
      colonneVisuels.className = "panneau__visuels";

      groupe.blocs.forEach(function (bloc) {
        var copie = bloc.cloneNode(true);
        if (bloc.classList.contains("illustration") || bloc.classList.contains("video")) {
          colonneVisuels.appendChild(copie);
        } else {
          colonneTexte.appendChild(copie);
        }
      });

      var contenu = document.createElement("div");
      contenu.className = "panneau__corps";
      if (colonneVisuels.children.length) {
        contenu.classList.add("panneau__corps--deux");
      }
      contenu.appendChild(colonneTexte);
      if (colonneVisuels.children.length) contenu.appendChild(colonneVisuels);
      panneau.appendChild(contenu);

      scene.appendChild(panneau);
      panneaux.push({ noeud: panneau, titre: groupe.titre ? groupe.titre.textContent : "Introduction" });
    });

    document.querySelector(".fiche").appendChild(scene);
    construit = true;
  }

  /* --------------------------------------------------------- barre du bas */

  var barre, position, etiquette;

  function creerBarre() {
    barre = document.createElement("div");
    barre.className = "pilote";
    barre.innerHTML =
      '<button type="button" data-action="precedent" aria-label="Panneau précédent">&#8592;</button>' +
      '<span class="pilote__position"></span>' +
      '<button type="button" data-action="suivant" aria-label="Panneau suivant">&#8594;</button>' +
      '<span class="pilote__etiquette"></span>' +
      '<span class="pilote__espace"></span>' +
      '<button type="button" data-action="reduire" aria-label="Réduire le texte">A&#8722;</button>' +
      '<button type="button" data-action="agrandir" aria-label="Agrandir le texte">A+</button>' +
      '<button type="button" data-action="quitter">Quitter</button>';
    document.body.appendChild(barre);
    position = barre.querySelector(".pilote__position");
    etiquette = barre.querySelector(".pilote__etiquette");

    barre.addEventListener("click", function (evenement) {
      var bouton = evenement.target.closest("button");
      if (!bouton) return;
      var action = bouton.dataset.action;
      if (action === "precedent") aller(courant - 1);
      if (action === "suivant") aller(courant + 1);
      if (action === "quitter") sortir();
      if (action === "agrandir") zoomer(0.1);
      if (action === "reduire") zoomer(-0.1);
    });
  }

  function zoomer(pas) {
    echelle = Math.min(1.8, Math.max(0.7, echelle + pas));
    document.documentElement.style.setProperty("--echelle", echelle);
  }

  function aller(index) {
    if (index < 0 || index >= panneaux.length) return;
    panneaux[courant].noeud.classList.remove("est-visible");
    courant = index;
    panneaux[courant].noeud.classList.add("est-visible");
    position.textContent = (courant + 1) + " / " + panneaux.length;
    etiquette.textContent = panneaux[courant].titre;
    panneaux[courant].noeud.scrollTop = 0;
  }

  /* ------------------------------------------------------ entrée et sortie */

  function entrer() {
    decouper();
    if (!barre) creerBarre();
    corps.dataset.projection = "on";
    courant = 0;
    panneaux.forEach(function (p) { p.noeud.classList.remove("est-visible"); });
    aller(0);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  }

  function sortir() {
    delete corps.dataset.projection;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }

  document.addEventListener("keydown", function (evenement) {
    if (corps.dataset.projection !== "on") {
      // P démarre la projection, sauf si on est en train d'écrire quelque part.
      if (evenement.key === "p" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        entrer();
      }
      return;
    }
    if (evenement.key === "ArrowRight" || evenement.key === " " || evenement.key === "PageDown") {
      evenement.preventDefault();
      aller(courant + 1);
    } else if (evenement.key === "ArrowLeft" || evenement.key === "PageUp") {
      evenement.preventDefault();
      aller(courant - 1);
    } else if (evenement.key === "Escape") {
      sortir();
    } else if (evenement.key === "+" || evenement.key === "=") {
      zoomer(0.1);
    } else if (evenement.key === "-") {
      zoomer(-0.1);
    } else if (evenement.key === "Home") {
      aller(0);
    } else if (evenement.key === "End") {
      aller(panneaux.length - 1);
    }
  });

  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement && corps.dataset.projection === "on") sortir();
  });

  /* ------------------------------------------------ bouton dans la page */

  var bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "declencheur";
  bouton.innerHTML = '<span aria-hidden="true">&#9635;</span> Projeter';
  bouton.title = "Afficher la fiche en plein écran pour la classe (touche P)";
  bouton.addEventListener("click", entrer);

  var accueil = document.querySelector(".entete__interieur");
  if (accueil) accueil.appendChild(bouton);
})();
