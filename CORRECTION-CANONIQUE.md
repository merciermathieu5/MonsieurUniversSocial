# Adresses canoniques : ce qui a été trouvé, corrigé, et ce qui reste

19 août 2026. Document refait de zéro : les deux premières versions
reposaient sur un diagnostic faux, décrit plus bas.

## L'état réel du site

Trois adresses servent le même contenu :

| Adresse | Réponse | Rôle |
| --- | --- | --- |
| `https://muniverssocial.ca/` | 200 | l'adresse publique retenue |
| `https://www.muniverssocial.ca/` | 200, puis 301 | corrigé, voir Dénouement |
| `https://merciermathieu5.github.io/MonsieurUniversSocial/` | 200 | copie retirée, voir Ménage |

Au moment du diagnostic, aucune ne redirigeait vers une autre. Le champ
**Custom domain** des réglages Pages est vide : GitHub Pages ne sert donc pas
le domaine, il ne sert que sa propre adresse. C'est Cloudflare qui répond sur `muniverssocial.ca`, ce qui
explique le comportement observé : deux domaines personnalisés servis en
parallèle, sans redirection de l'un vers l'autre.

Ce qui tenait l'ensemble, c'étaient les balises canoniques. Chaque page,
quelle que soit l'adresse par laquelle on l'atteint, déclare
`https://muniverssocial.ca/...`. Google consolidait donc les trois copies sur
une seule. Fonctionnel, mais c'était un filet, pas une architecture. La
redirection décrite plus bas est l'architecture.

## Le diagnostic faux, et comment il a été pris

Le premier diagnostic affirmait que le domaine nu redirigeait vers le www, et
que les canoniques pointaient donc vers une adresse qui redirige. Faux. Cette
affirmation venait d'une métadonnée d'un outil de récupération de pages, prise
pour une mesure.

`site.yml` a été basculé au www sur cette base. C'est ce que corrige la
présente version : `url` revient au domaine nu.

Ce qui a permis de s'en apercevoir : le contrôle réseau ajouté à
`outils/verifier.py`, qui interroge les deux écritures du domaine. À sa
première exécution réelle, il a signalé que le domaine nu répondait 200 au
lieu de rediriger. Le garde-fou écrit contre une panne a servi à démolir le
diagnostic qui l'avait fait écrire.

## Ce que dit la Search Console, relu à froid

Le rapport du 16 août ne décrit pas une panne. Il décrit un site jeune.

- **25 pages « Détectée, actuellement non indexée »**, découvertes le 18 août,
  jamais explorées. Un sitemap tout neuf sur un domaine sans historique. Le
  temps règle ça.
- **2 pages « Explorée, actuellement non indexée »**, les deux formes de la
  fiche 02. Banal pour un domaine sans autorité.
- **3 pages « Page avec redirection »** : `http://muniverssocial.ca/`,
  `http://www.muniverssocial.ca/`, `https://muniverssocial.ca/index.html`.
  Comportement normal. **Ne rien valider sur ce motif.**
- **1 page « en double sans URL canonique sélectionnée par l'utilisateur »**,
  la page d'accueil, exploration du 10 août, détection le 11. À vérifier avec
  l'inspection d'URL en direct : si Google voit maintenant la balise, le
  constat se dissipera de lui-même.

## Fichiers modifiés

| Fichier | Modification |
| --- | --- |
| `site.yml` | `url` au domaine nu, avec un commentaire qui dit pourquoi |
| `theme/base.html` | commentaire remis à jour, les trois adresses nommées |
| `outils/verifier.py` | nouvelle section de contrôle `CANONIQUES` |
| `docs/` (28 pages) | canonique réécrite sur le domaine nu |
| `docs/sitemap.xml` | 28 `<loc>` réécrites |
| `docs/robots.txt` | ligne `Sitemap:` réécrite |

## Le contrôle ajouté

`outils/verifier.py` gagne une section `CANONIQUES`. Quatre vérifications
hors ligne :

1. l'hôte de `site.yml` est absolu, en https, sans barre finale
2. chaque page construite porte une canonique unique, sur cet hôte, et qui
   correspond à son propre chemin dans `docs/`
3. le sitemap liste exactement les pages construites, dans la même forme
4. le `robots.txt` renvoie au sitemap du même hôte

Puis deux appels réseau, actifs par défaut : l'hôte déclaré ne doit pas
rediriger, et l'autre écriture du domaine doit rediriger vers lui.

Ce qui est jugé, c'est la redirection, pas le code de réponse. Un 403, un 429
ou un 503 prouve que l'hôte a répondu de lui-même, donc qu'il ne redirige
pas : simple note. Cette nuance vient d'une vraie fausse alerte, Cloudflare
ayant refusé l'agent par défaut de Python. La requête se présente maintenant
avec un User-Agent de navigateur.

Un hôte injoignable fait sauter le contrôle sans le faire échouer.
`py outils\verifier.py --hors-ligne` désactive les appels réseau.

Tant que la redirection du www n'existe pas, la section signalera une faute.
C'est voulu : elle décrit un vrai défaut.

## Ce qui reste à faire en ligne

Toutes ces étapes ont été menées le 19 août. Elles sont conservées ici comme
trace du raisonnement.

1. **Pousser sur `main`.**

2. **Trouver ce qui sert le domaine.** Tableau de bord Cloudflare, section
   Workers & Pages, puis le projet lié à ce dépôt, onglet Custom domains. Il
   devrait y avoir `muniverssocial.ca` et `www.muniverssocial.ca`, servis tous
   les deux.

3. **Créer la redirection.** Cloudflare, Rules, Redirect Rules. Une règle :
   si le nom d'hôte vaut `www.muniverssocial.ca`, redirection 301 vers
   `https://muniverssocial.ca` avec conservation du chemin et de la chaîne de
   requête. Aucun risque de boucle : GitHub Pages n'est pas sur le trajet,
   son champ Custom domain est vide.

4. **Relancer `py outils\verifier.py`.** La section `CANONIQUES` doit passer
   au vert, avec le www en 301.

5. **Search Console.** Soumettre `https://muniverssocial.ca/sitemap.xml`.
   Demander l'indexation de la page d'accueil, des deux index de section et
   de deux ou trois fiches.

6. **Valider la correction** sur le motif « page en double », et sur lui seul.

## Dénouement

L'étape 2 a confirmé le mécanisme : projet Cloudflare Pages `muniverssocial`,
lié à ce dépôt, avec les deux domaines déclarés et actifs en parallèle. Rien
n'était cassé dans le code, il manquait une règle de redirection.

Elle a été créée à partir du modèle **Redirect from WWW to root**, en 301,
avec conservation du chemin et de la chaîne de requête. Cloudflare avertissait
que la règle risquait de ne pas s'appliquer, faute d'enregistrement DNS
proxifié pour le www. Fausse alerte : l'enregistrement existait, géré par
Pages, et l'interface des règles ne le reconnaissait pas.

Vérification finale sur le poste :

```
CANONIQUES
    ok   pages, sitemap et robots.txt sur le même hôte
         https://muniverssocial.ca/ répond 200 sans redirection,
         https://www.muniverssocial.ca/ répond 301, redirige vers
         https://muniverssocial.ca/
```

## Ménage : GitHub Pages

Cloudflare construisant directement depuis le dépôt, GitHub Pages ne servait
qu'une troisième copie du site, à
`merciermathieu5.github.io/MonsieurUniversSocial/`. Ses canoniques pointaient
vers le domaine, donc Google la consolidait correctement, mais elle publiait
pour rien à chaque push.

`.github/workflows/deploy.yml` est donc retiré, et la section « Publier » du
`README.md` réécrite : elle décrivait un hébergement GitHub Pages qui n'a
jamais servi ce domaine, et proposait un réglage *Deploy from a branch*
trompeur.

Reste un geste manuel : **Settings, Pages, Unpublish site**, pour retirer la
copie déjà en ligne. Sans ça, elle demeure figée sur sa dernière version au
lieu de disparaître.

## Ce qui va bouger dans la Search Console

Le motif « Page avec redirection » va gonfler dans les prochaines semaines.
Google connaît des adresses en www et découvrira qu'elles redirigent
désormais. C'est le signe que la règle fonctionne, pas une dégradation.

Les 25 pages jamais explorées relèvent de la patience, pas de la technique.
