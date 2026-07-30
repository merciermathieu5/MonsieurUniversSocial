# Monsieur Univers social

Site pédagogique d'histoire et de géographie, premier cycle du secondaire.
Contenu en Markdown, site statique généré en Python, hébergé sur GitHub Pages.

Une fiche par réalité sociale, une fiche par territoire. Un fichier, une page.

## Démarrer

```bash
pip install -r requirements.txt
python3 build.py --servir
```

Le site se construit dans `public/` et s'ouvre sur http://localhost:8000.
Le dossier `public/` est régénéré à chaque fois, ne le modifie jamais à la main.

## Où est quoi

```
contenu/histoire/       13 fiches, une par réalité sociale
contenu/geographie/     14 fiches, une par territoire
theme/                  gabarits HTML et feuille de style
medias/                 images, une sous-dossier par fiche
outils/extraire.py      récupération du contenu de l'ancien Google Site
site.yml                titre du site, menus, regroupements
build.py                le générateur
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

Pousse sur `main`. Le workflow `.github/workflows/deploy.yml` construit et publie
sur GitHub Pages. Active Pages une fois dans les réglages du dépôt, en choisissant
« GitHub Actions » comme source.

Si tu migres depuis l'ancien site, garde les mêmes adresses de page ou prévois
des redirections. Une bonne partie du trafic arrive par Google.

## État d'avancement

| Fiche | Statut |
| --- | --- |
| Histoire, La sédentarisation | Révisée |
| Les 26 autres | À extraire puis réviser |
