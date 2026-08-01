# Conventions des schémas

Règles tirées des rétroactions sur les premières versions. Tout nouveau schéma
les suit, et `outils/verifier.py` fait respecter celles qui s'outillent.

## Classes CSS

Chaque schéma préfixe toutes ses classes d'un code à deux lettres qui lui est
propre (`fp-`, `ne-`, `hi-`...). Les blocs `<style>` des SVG insérés dans une
page sont globaux : sans préfixe, la classe `.e` blanche d'un schéma repeint la
classe `.e` noire du schéma voisin, et le défaut n'apparaît qu'une fois les
deux réunis sur la même fiche. Le vérificateur refuse toute classe définie
dans plus d'un schéma.

## Texte

- Des groupes de mots ou de courtes phrases, jamais des mots seuls.
- Majuscule en début d'énoncé, point final aux phrases complètes.
- Quand une explication s'impose, un petit paragraphe de trois ou quatre
  phrases vaut mieux qu'une suite de fragments.
- Pas de phrase synthèse plaquée au bas du schéma : ce rôle revient au texte
  de la fiche.
- Un texte posé sur une forme tient dans la forme, avec au moins 8 px de marge
  de chaque côté. Pour un trapèze, la largeur qui compte est celle de la forme
  à la hauteur du texte, pas celle de sa base. Contrôlé par le vérificateur.

## Comparaisons

Les critères d'un tableau comparatif sont rigoureusement identiques d'une
colonne à l'autre. Si le sédentaire pratique encore la chasse, la ligne des
moyens de subsistance le dit des deux côtés.

## Couleurs

Dans un diagramme à parts (circulaire, barres empilées), chaque part reçoit une
couleur franchement distincte de la palette : jamais la même couleur déclinée
en opacités, indiscernable au projecteur. L'accent doré se réserve à la part
que l'élève doit retenir.

Uniquement les variables du thème (`--bloc`, `--bloc-pale`, `--schema-accent`,
`--encre`, `--schema-cle`...), jamais de couleur en dur : le vérificateur
mesure le contraste de chaque texte sur son fond réel, dans les deux thèmes.

## Lignes du temps

Les positions suivent l'échelle réelle du temps. Les dates s'écrivent avec
l'espace des milliers (`-3 500`) et `vers` quand la datation est approximative.
Aucun élément décoratif ne traverse un texte.

La ligne du temps classique se dessine comme une bande d'axe qui porte les
périodes : chaque segment coloré de la bande porte le nom de sa période, et
les points d'événements se posent sur les bords de la bande, en haut ou en
bas selon le côté de leur étiquette, jamais au centre de la bande.

## Avant de livrer

`python outils/verifier.py` doit passer sans souci sur les schémas : contraste
dans les deux thèmes, débordements du cadre, chevauchements de textes,
débordements de forme et classes partagées.

## Ce qu'un schéma n'est pas

Les schémas du site restent des diagrammes : lignes du temps, hiérarchies,
processus, comparaisons. Aucun dessin figuratif et aucune carte géographique
dessinée à la main : les cartes viennent de Wikimedia Commons, d'un dépôt
comme d-maps.com ou d'un document repris de l'ancien site, et s'inscrivent
dans medias/sources.yml comme les autres images.
