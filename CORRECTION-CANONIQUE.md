# Correction des adresses canoniques

19 août 2026

## Le problème

`site.yml` déclarait `url: https://muniverssocial.ca`, alors que GitHub Pages
sert le site sur `https://www.muniverssocial.ca`. Le domaine nu redirige vers
le www.

Cette valeur unique alimente trois choses :

- la balise `<link rel="canonical">` de `theme/base.html`
- chaque `<loc>` du `sitemap.xml`
- la ligne `Sitemap:` du `robots.txt`

Les 28 pages annonçaient donc une adresse canonique qui redirige, et les 28
entrées du sitemap redirigeaient aussi. Google écarte systématiquement une
canonique qui redirige. Résultat dans la Search Console du 16 août : 2 pages
dans l'index, 31 hors index, dont la page d'accueil en « page en double sans
URL canonique sélectionnée par l'utilisateur ».

Le piège de cette panne est qu'elle est parfaitement cohérente. Canoniques,
sitemap et robots.txt sortaient tous de la même valeur, donc ils
s'accordaient entre eux du premier au dernier caractère. Aucun contrôle
interne ne pouvait la voir.

## Ce qui a été corrigé

| Fichier | Modification |
| --- | --- |
| `site.yml` | `url` passe au www, avec le commentaire qui explique pourquoi |
| `theme/base.html` | le commentaire annonçait « sans www », devenu faux |
| `outils/verifier.py` | nouveau contrôle `CANONIQUES` |
| `docs/` (28 pages) | canonique réécrite sur le bon hôte |
| `docs/sitemap.xml` | 28 `<loc>` réécrites |
| `docs/robots.txt` | ligne `Sitemap:` réécrite |

`docs/` est régénéré de toute façon par `build.py` au prochain push. Il est
réécrit ici pour que la sortie versionnée cesse de contredire la source.

## Le nouveau contrôle

`outils/verifier.py` gagne une section `CANONIQUES`, entre `CONVENTIONS` et
`CONSTRUIT`. Quatre vérifications hors ligne :

1. l'hôte de `site.yml` est absolu, en https, sans barre finale
2. chaque page construite porte une canonique unique, sur cet hôte, et qui
   correspond à son propre chemin dans `docs/`
3. le sitemap liste exactement les pages construites, dans la même forme
4. le `robots.txt` renvoie au sitemap du même hôte

Puis une cinquième, en réseau : l'hôte est interrogé et doit répondre 200
sans redirection. C'est la seule qui aurait vu la panne, donc elle tourne par
défaut. Un poste sans Internet la saute et le dit, sans faire échouer la
vérification. `py outils\verifier.py --hors-ligne` la désactive.

Essais menés :

- état corrigé, hors ligne : 0 problème
- état d'avant la correction : 85 problèmes signalés
- hôte injoignable : contrôle sauté, aucune faute levée
- hôte qui redirige, éprouvé sur un vrai 301 : faute levée avec le message
  qui nomme la cause

## Ce qui reste à faire en ligne

1. **Pousser sur `main`.** Le workflow reconstruit et publie tout seul.
2. **Vérifier** que `https://www.muniverssocial.ca/histoire/` affiche bien
   `<link rel="canonical" href="https://www.muniverssocial.ca/histoire/">`.
3. **Search Console, sitemaps :** soumettre `https://www.muniverssocial.ca/sitemap.xml`.
   L'ancien, en domaine nu, peut être retiré.
4. **Search Console, inspection d'URL :** demander l'indexation de la page
   d'accueil, des deux index de section et de deux ou trois fiches. Le reste
   suivra par le sitemap.
5. **Valider la correction** sur le motif « Page en double sans URL canonique
   sélectionnée par l'utilisateur ».
6. **Ne rien valider** sur « Page avec redirection ». Les trois URL visées
   (`http://muniverssocial.ca/`, `http://www.muniverssocial.ca/`,
   `https://muniverssocial.ca/index.html`) redirigent correctement. C'est le
   comportement attendu, pas une erreur.

Les 25 pages en « Détectée, actuellement non indexée » ont été découvertes le
18 août et n'ont jamais été explorées. Une partie de ce délai tient à la
jeunesse du site et se résorbera d'elle-même.

## Un point à trancher plus tard

Le commentaire d'origine de `base.html` disait « sans www » : le domaine nu
était donc ton intention. La correction va dans l'autre sens, vers l'hôte qui
répond déjà et qui a son certificat.

L'inverse reste possible : mettre `muniverssocial.ca` comme domaine
personnalisé dans les réglages Pages, pour que le www redirige vers le nu,
puis remettre `site.yml` au domaine nu. GitHub réémet alors le certificat, ce
qui peut couper le HTTPS quelques heures.

Avec 2 pages indexées, ce choix ne coûte rien aujourd'hui. Il coûtera cher
dans six mois. Si tu veux le domaine nu, c'est maintenant, et les deux
changements se font ensemble.
