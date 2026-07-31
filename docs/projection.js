/* =========================================================================
   Mode projection

   Chaque titre de niveau 2 d'une fiche devient un panneau plein écran. La
   découpe ne demande aucun travail d'écriture supplémentaire : elle réutilise
   la structure que les fiches ont déjà.

   Flèches ou espace pour avancer, Échap pour sortir, + et - pour la taille.
   ========================================================================= */

(function () {
  "use strict";

  // La frise reste repliée pour laisser la place au contenu.
  var bascule = document.querySelector(".frise__bascule");
  if (bascule) {
    bascule.addEventListener("click", function () {
      var ouvert = bascule.getAttribute("aria-expanded") === "true";
      bascule.setAttribute("aria-expanded", String(!ouvert));
    });
  }

  var texte = document.querySelector(".fiche .texte");
  if (!texte) return;

  var corps = document.body;
  var racine = document.documentElement;
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
        if (bloc.classList.contains("illustration") ||
            bloc.classList.contains("video") ||
            bloc.classList.contains("schema")) {
          colonneVisuels.appendChild(copie);
        } else {
          colonneTexte.appendChild(copie);
        }
      });

      var contenu = document.createElement("div");
      contenu.className = "panneau__corps";
      if (colonneVisuels.children.length) {
        contenu.classList.add("panneau__corps--deux");
        // Beaucoup de visuels : on leur laisse la moitié de l'écran.
        if (colonneVisuels.children.length > 2) {
          contenu.classList.add("panneau__corps--visuel");
        }
      } else {
        // Sans visuel, le texte occupe toute la largeur. Au-delà d'un certain
        // volume il se replie en deux colonnes plutôt que de laisser du vide.
        var volume = colonneTexte.textContent.trim().length;
        contenu.classList.add(volume > 700 ? "panneau__corps--flux"
                                           : "panneau__corps--ample");
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
      '<button type="button" data-action="sombre" aria-pressed="false">Sombre</button>' +
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
      if (action === "sombre") basculerSombre(bouton);
    });
  }

  function basculerSombre(bouton) {
    var actif = racine.dataset.sombre === "on";
    if (actif) { delete racine.dataset.sombre; } else { racine.dataset.sombre = "on"; }
    bouton.setAttribute("aria-pressed", String(!actif));
    bouton.textContent = actif ? "Sombre" : "Clair";
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
    racine.dataset.projection = "on";
    courant = 0;
    panneaux.forEach(function (p) { p.noeud.classList.remove("est-visible"); });
    aller(0);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  }

  function sortir() {
    delete corps.dataset.projection;
    delete racine.dataset.projection;
    delete racine.dataset.sombre;
    var scene = document.querySelector(".scene");
    if (scene) scene.remove();
    if (barre) { barre.remove(); barre = null; }
    panneaux = [];
    construit = false;
    courant = 0;
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
    } else if (evenement.key === "n") {
      basculerSombre(barre.querySelector('[data-action="sombre"]'));
    } else if (evenement.key === "Home") {
      aller(0);
    } else if (evenement.key === "End") {
      aller(panneaux.length - 1);
    }
  });

  // Le thème sombre ne survit pas à la sortie : la page reprend son aspect normal.
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

  // Second mode : la page elle-même, agrandie pour être projetée telle quelle.
  var agrandir = document.createElement("button");
  agrandir.type = "button";
  agrandir.className = "declencheur declencheur--secondaire";
  agrandir.innerHTML = '<span aria-hidden="true">&#8599;</span> Mode classe';
  agrandir.title = "Agrandir la page pour la projeter sans passer en diaporama";
  agrandir.setAttribute("aria-pressed", "false");
  agrandir.addEventListener("click", function () {
    var actif = corps.dataset.classe === "on";
    if (actif) { delete corps.dataset.classe; } else { corps.dataset.classe = "on"; }
    agrandir.setAttribute("aria-pressed", String(!actif));
  });

  var accueil = document.querySelector(".entete__interieur");
  if (accueil) {
    var barreBoutons = document.createElement("div");
    barreBoutons.className = "actions";
    barreBoutons.appendChild(bouton);
    barreBoutons.appendChild(agrandir);
    accueil.appendChild(barreBoutons);
  }
})();
