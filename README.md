# Monsieur Univers social

Site pédagogique d'histoire et de géographie, premier cycle du secondaire.
Contenu en Markdown, site statique généré en Python, hébergé sur GitHub Pages.

Une fiche par réalité sociale, une fiche par territoire. Un fichier, une page.

## Démarrer

```bash
pip install -r requirements.txt
python3 outils/images.py     # récupère les images depuis Wikimedia Commons
python3 build.py --servir    # construit et ouvre un aperçu local
```

Le site se construit dans `docs/` et s'ouvre sur http://localhost:8000.
Le dossier `docs/` est régénéré à chaque construction, ne le modifie jamais à la
main. Il est versionné, contrairement à l'habitude, parce que c'est lui que
GitHub Pages publie.

## Où est quoi

```
contenu/histoire/       13 fiches, une par réalité sociale
contenu/geographie/     14 fiches, une par territoire
theme/                  gabarits HTML et feuille de style
medias/                 images, un sous-dossier par fiche
medias/sources.yml      registre des images et de leurs crédits
outils/images.py        téléchargement des images depuis Wikimedia Commons
outils/extraire.py      récupération du contenu de l'ancien Google Site
outils/liens.py         vérification des liens internes
site.yml                titre du site, menus, regroupements
build.py                le générateur
docs/                   le site construit, c'est ce que GitHub Pages publie
```

## Modifier une fiche

Ouvre le fichier, change le texte, relance `python3 build.py`. C'est tout.

Chaque fiche commence par un en-tête qui pilote l'affichage :

```yaml
---
titre: "La romanisation"
section: histoire
ordre: 4                  # position dans la matière et sur la frise
groupe: antiquite         # regroupement sur la page d'index, défini dans site.yml
periode: "-509 à 476"     # s'affiche dans l'entête et sur la frise
debut: -509
fin: 476
angle: "L'expansion de l'Empire romain"
concepts: [romanisation, citoyenneté, empire]
concepts_valides: false   # passe à true une fois vérifié dans le PFEQ
statut: a-extraire        # a-extraire, brouillon ou revise
image_entete: ""
---
```

Les fiches de géographie utilisent `type_territoire`, `echelle`, `enjeu` et
`etudes_de_cas` au lieu de `periode` et `angle`.

Tu n'as pas à t'occuper des menus, de la table des matières, de la numérotation
des sections ni de la frise. Tout est déduit des en-têtes.

## Projeter en classe

Trois boutons sous le titre de chaque fiche, ou leurs touches.

- **Mode classe** (`C`) agrandit la page, masque menu, sommaire et frise.
- **Diaporama** (`P`) part du mode classe et montre une section à la fois,
  un titre de niveau 2 par écran. Flèches ou espace pour naviguer. La barre du
  bas donne le compteur, le titre de la section, les boutons `A−` et `A+` pour
  ajuster la taille du texte (aussi au clavier avec `-` et `+`), la bascule de
  thème et Quitter. `Échap` ramène la page complète. Le réglage de taille est
  conservé d'une section à l'autre pendant toute la présentation.
- **Thème sombre** (`N`) recolore la page. Clair par défaut.

Le sommaire de gauche se replie avec la touche `S` ou son bouton, et le texte
reprend alors toute la largeur. Il n'y a qu'un seul moteur de mise en page :
chaque mode se contente de poser un attribut sur la page.

Les tests de ces comportements sont dans `outils/test_page.js` :

```bash
npm install jsdom
node outils/test_page.js
```

## Les concepts

Les concepts affichés dans l'entête de chaque fiche d'histoire sont ceux
prescrits par la Progression des apprentissages, Histoire et éducation à la
citoyenneté, premier cycle, version du 20 août 2010, relevés section par
section dans le document du ministère. Uniquement ceux-là.

Ceux des fiches de géographie viennent de la Progression des apprentissages de
Géographie, premier cycle, même version. Ils sont prescrits par type de
territoire, donc les deux fiches énergétiques portent la même liste, ce qui est
normal.

Le champ `concepts_valides` de l'en-tête indique si la liste a été confrontée au
programme. `outils/verifier.py` signale toute fiche restée à `false`.

Le champ `etudes_de_cas` contient les choix prévus par le programme, avec la
mention obligatoire là où elle s'applique. À réduire aux cas que tu enseignes.

## Écrire le contenu

Markdown standard, plus trois encadrés :

```markdown
::: questions
1. Première question.
2. Deuxième question.
:::

::: note
Une nuance, une précision, une mise en garde.
:::

::: savais-tu
Une anecdote qui accroche.
:::
```

Pour une image avec légende :

```markdown
![Reconstitution de Çatal Höyük](../medias/01-sedentarisation/03.jpg)
```

Conventions d'écriture retenues pour tout le site :

- Tutoiement de l'élève.
- Dates négatives pour les périodes avant notre ère, sans « av. J.-C. » : `-8500`.
- Pas de tiret cadratin.
- Pas de virgule avant le dernier élément d'une énumération.
- Les interprétations débattues vont dans un encadré `note`, jamais dans le
  corps du texte présenté comme un fait.

## Ajouter une image

Le registre `medias/sources.yml` fait le lien entre un fichier local et sa page
sur Wikimedia Commons. Ajoute une entrée, lance l'outil, réfère l'image dans la
fiche :

```bash
python3 outils/images.py
```

L'auteur et la licence sont récupérés depuis Commons, jamais écrits à la main,
et s'affichent sous chaque image. Tant qu'une image n'est pas téléchargée, la
page montre un espace réservé avec sa légende plutôt que de casser.

Pour une vidéo, l'identifiant YouTube suffit :

```markdown
::: video 5ebUwqogWc8
Titre de la vidéo
:::
```

## Récupérer le contenu de l'ancien site

Google ne permet ni d'exporter ni de lire un Google Site par API. Le seul chemin
possible passe par les pages publiées.

```bash
pip install requests beautifulsoup4 html2text
python3 outils/extraire.py --tout --images
```

Le texte brut arrive dans `extraction/`. Ce dossier n'écrase jamais `contenu/` :
tu relis, tu corriges, puis tu verses dans la fiche correspondante. C'est
volontaire, la révision est le but de l'opération.

## Publier

Le contenu de ce dossier va **à la racine du dépôt GitHub**, pas dans un
sous-dossier. Si tu vois `README.md` s'afficher à la place du site, c'est le
signe que Pages sert la racine au lieu de `docs/`.

### Réglage, une seule fois

Réglages du dépôt, section Pages :

- Source : **Deploy from a branch**
- Branche : **main**, dossier : **/docs**

Aucune intégration continue nécessaire. Tu construis chez toi, tu pousses, c'est
en ligne.

```bash
python build.py
python outils\liens.py       # aucun lien interne brisé
python outils\verifier.py    # contrastes, schémas, crédits
git add -A && git commit -m "Mise à jour" && git push
```

`verifier.py` mesure le contraste de chaque couple fond / texte du site et de
chaque texte des schémas, dans le thème clair comme dans le thème sombre, et
signale les débordements hors cadre. Il existe parce que l'oeil ne suffit pas :
un texte blanc sur un rectangle à 45 pour cent d'opacité paraît correct dans
l'éditeur et devient illisible au projecteur.

### Variante avec GitHub Actions

Si tu préfères que GitHub construise à ta place, `.github/workflows/deploy.yml`
est déjà là. Règle alors Source sur **GitHub Actions** au lieu de la branche. Le
fichier doit se trouver à `.github/workflows/` **à la racine du dépôt**, sinon
GitHub ne le voit pas.

### Adresses de page

Si tu migres depuis l'ancien site, garde les mêmes adresses de page ou prévois
des redirections. Une bonne partie du trafic arrive par Google.

## État d'avancement

| Fiche | Statut |
| --- | --- |
| Histoire, La sédentarisation | Révisée |
| Les 26 autres | À extraire puis réviser |
