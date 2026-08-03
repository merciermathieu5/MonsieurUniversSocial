# Récupération des images — terminée le 3 août 2026

Les dix images Commons qui manquaient à la fiche 10 sont rangées dans
`medias/10-industrialisation/` et leurs crédits sont inscrits dans
`medias/credits.yml`. Ce document remplace la note de reprise précédente.

## Ce qui reste à faire

1. **Lancer `python build.py`.** Le site dans `docs/` n'a pas été reconstruit
   sur ce poste : la construction a eu lieu ailleurs et n'a pas été recopiée,
   pour ne pas risquer d'y injecter autre chose que vos vraies images.
2. **Fournir `ancienne-nouvelle-facon.png`.** Voir plus bas.
3. **Faire le ménage dans Téléchargements.** Les dix fichiers y sont restés en
   double : `cleveland-industrie.jpg`, `anzin-arenberg.jpg`,
   `machine-newcomen.jpg`, `James Watt by Henry Howard.jpg`, `crompton.jpg`,
   `mule-jenny.png`, `mine-hurrier.jpg`, `quartier-ouvrier.jpg`,
   `greve-winnipeg.jpg`, `chaine-ford.jpg`. Sans danger — les entrées du
   registre sont désormais complètes, donc `images.py` les saute avant même de
   regarder Téléchargements — mais autant les supprimer.

## Les crédits n'ont pas été écrits par images.py

C'est la seule entorse à la marche à suivre, et elle mérite un mot. Le script
n'a pas pu tourner : la machine qui a fait le travail n'avait aucun accès à
Wikimedia. Les métadonnées ont donc été lues par le navigateur, puis mises en
forme avec les fonctions d'`images.py` elles-mêmes — `nettoyer`, `lisible`,
`joli_titre` — importées depuis `outils/images.py`, de sorte que les entrées
sont identiques à ce que le script aurait produit.

Un contrôle a confirmé qu'aucune entrée du registre ne déclenche plus d'appel
réseau : les dix fichiers sont présents, leurs crédits sont complets, et le
champ `commons` du registre concorde avec celui du crédit. Relancer
`python outils/images.py` ne retéléchargera donc rien.

## Le piège de watt.jpg, pour mémoire

`depot_manuel` écarte tout candidat dont le radical simplifié fait moins de six
caractères, et « watt » en fait quatre. Un fichier déposé sous `watt.jpg` à la
racine ou dans Téléchargements serait invisible au script. Le nom à employer
est `James Watt by Henry Howard.jpg`, que la fonction reconnaît par le champ
`commons` du registre. À retenir pour toute future image au nom court.

## L'impasse de ancienne-nouvelle-facon.png

**Résolue le 3 août 2026.** L'entrée du registre ne porte plus `source: locale`
mais un champ `url` qui pointe vers le document du Service national du RÉCIT,
*Document 1 : L'ancienne et la nouvelle façon*. `images.py` la télécharge donc
comme il le fait pour les cartes d-maps, sans passer par Commons, et le crédit
inscrit à la main dans `medias/sources.yml` est conservé tel quel. Le
paragraphe ci-dessous ne vaut plus que pour mémoire.

Son entrée portait `source: locale`, sans champ `commons` ni `url` : le montage
n'était téléchargeable de nulle part et devait venir de vous, depuis l'ancien
Google Site ou refait à partir des deux gravures du McCord. `verifier.py`
continuera d'afficher `carte à déposer à la main : ancienne-nouvelle-facon.png`
tant qu'il manque, et `images.py` le signalera comme `À DÉPOSER` — et non comme
`ECHEC`, la branche `source == "locale"` étant évaluée avant toute résolution.

`medias/10-industrialisation/ancienne-facon.png` existe, 133 895 o, mais ne
figure pas au registre : sans doute la moitié orpheline du montage. À regarder
avant de le reconstruire.

## Points relevés au passage

Sept lignes `crédit incomplet` subsistent chez `verifier.py`, toutes hors des
fiches 09 et 10 et antérieures à ce travail : `carte-grece.png`,
`carte-attique.png`, `carte-attique-peloponnese.png` pour la fiche 03,
`journee-thermes.jpg`, `metier-parfumeur.jpg`, `metier-oliarius.png`,
`metier-foulonniers.jpg` pour la fiche 04. Ces images sont bien sur le disque ;
il leur manque seulement une entrée dans `credits.yml`.

`Pedro_Álvares_Cabral.jpg`, 226 560 o, traîne à la racine du dépôt. Même poids
que `medias/08-expansion-europeenne/cabral.jpg` : résidu d'un dépôt manuel déjà
rangé, à supprimer.
