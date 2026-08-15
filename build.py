#!/usr/bin/env python3
"""
Construit le site Monsieur Univers social à partir des fiches Markdown.

    python3 build.py            construit dans public/
    python3 build.py --servir   construit puis démarre un serveur local

Chaque fiche du dossier contenu/ devient une page. Rien d'autre à configurer :
l'ordre, les menus, la frise et les tables des matières sont déduits des
en-têtes YAML des fiches.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import sys
import unicodedata
from pathlib import Path

try:
    import yaml
    import markdown
    from jinja2 import Environment, FileSystemLoader, select_autoescape
except ImportError:
    sys.exit("Dépendances manquantes. Lance : pip install -r requirements.txt")

RACINE = Path(__file__).resolve().parent
CONTENU = RACINE / "contenu"
PAGES = CONTENU / "pages"
THEME = RACINE / "theme"
MEDIAS = RACINE / "medias"
SCHEMAS = MEDIAS / "schemas"

BROUILLON = False
manquantes: list[str] = []

EXTENSIONS_MD = ["extra", "toc", "sane_lists", "md_in_html"]

# ::: questions ... :::  ::: note ... :::  ::: video IDENTIFIANT ... :::
BLOC = re.compile(r"^::: *(questions|note|savais-tu|activite) *$(.*?)^::: *$",
                  re.MULTILINE | re.DOTALL)
VIDEO = re.compile(r"^::: *video +([\w-]+) *$(.*?)^::: *$",
                   re.MULTILINE | re.DOTALL)
SCHEMA = re.compile(r"^::: *schema +([\w-]+) *$(.*?)^::: *$",
                    re.MULTILINE | re.DOTALL)
COMPOSANT = re.compile(r"^::: *composant +([\w-]+) *$", re.MULTILINE)
INTEGRATION = re.compile(r"^::: *integration +(\S+) *$(.*?)^::: *$",
                         re.MULTILINE | re.DOTALL)
CARTES = re.compile(r"^::: *cartes *$(.*?)^::: *$",
                    re.MULTILINE | re.DOTALL)
COLONNES = re.compile(r"^::: *colonnes(2|3)? *$(.*?)^::: *$",
                      re.MULTILINE | re.DOTALL)
TITRES_BLOC = {
    "questions": "Questions",
    "note": "À retenir",
    "savais-tu": "Savais-tu que",
    "activite": "Activité",
}


def glisser(texte: str) -> str:
    """Transforme un titre en identifiant d'URL sans accents."""
    texte = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    texte = re.sub(r"[^\w\s-]", "", texte.lower())
    return re.sub(r"[\s_]+", "-", texte).strip("-")


def convertir_blocs(texte: str, credits: dict) -> str:
    """Remplace les blocs ::: par du HTML que Markdown saura traiter."""
    def video(m):
        identifiant, legende = m.group(1), m.group(2).strip()
        return (
            '<figure class="video">\n'
            f'<iframe src="https://www.youtube-nocookie.com/embed/{identifiant}"\n'
            f'  title="{legende or "Vidéo"}" loading="lazy" allowfullscreen\n'
            '  allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"\n'
            '  referrerpolicy="strict-origin-when-cross-origin"></iframe>\n'
            + (f'<figcaption>{legende}</figcaption>\n' if legende else "")
            + '</figure>\n'
        )

    def encadre(m):
        genre, corps = m.group(1), m.group(2)
        titre = TITRES_BLOC[genre]
        return (
            f'<aside class="encadre encadre--{genre}" markdown="1">\n'
            f'<p class="encadre__titre">{titre}</p>\n'
            f'{corps.strip()}\n'
            f'</aside>\n'
        )

    def schema(m):
        nom, legende = m.group(1), m.group(2).strip()
        fichier = SCHEMAS / f"{nom}.svg"
        if not fichier.exists():
            return f'<p class="avis">Schéma introuvable : {nom}.svg</p>\n'
        # Le SVG est inséré tel quel : il hérite des couleurs de la page et
        # se recolore donc tout seul en mode projection.
        dessin = fichier.read_text(encoding="utf-8")
        return (f'<figure class="schema">{dessin}'
                + (f'<figcaption>{legende}</figcaption>' if legende else "")
                + '</figure>\n')

    def colonnes(m):
        nombre = m.group(1) or "2"
        return (f'<div class="colonnage colonnage--{nombre}" markdown="1">\n'
                f'{m.group(2).strip()}\n</div>\n')

    def composant(m):
        """Insère telle quelle une interface autonome de theme/composants/.

        Le fichier contient son propre style et son propre script, à la manière
        des schémas SVG. Les lignes vides sont retirées pour que Markdown ne
        découpe pas le bloc en morceaux.
        """
        nom = m.group(1)
        fichier = THEME / "composants" / f"{nom}.html"
        if not fichier.exists():
            return f'<p class="avis">Composant introuvable : {nom}.html</p>\n'
        lignes = fichier.read_text(encoding="utf-8").splitlines()
        corps = "\n".join(l for l in lignes if l.strip()) + "\n"
        # {{credit:nom-de-fichier.jpg}} devient le crédit composé depuis le
        # registre, comme sous les figures du fil du texte.
        return re.sub(r"\{\{credit:([\w.-]+)\}\}",
                      lambda c: composer_credit(credits.get(c.group(1), {})),
                      corps)

    texte = COMPOSANT.sub(composant, texte)
    texte = SCHEMA.sub(schema, texte)
    texte = VIDEO.sub(video, texte)
    def integration(m):
        """Intègre une ressource interactive (Padlet, Genially, LearningApps).

        Un cadre redimensionnable, doublé d'un lien : si le service est
        inaccessible ou si la page est consultée hors ligne, l'élève garde
        l'adresse sous les yeux.
        """
        url = m.group(1)
        legende = " ".join(m.group(2).split()) or "Ressource interactive"
        return (f'<figure class="integration">\n'
                f'<iframe src="{url}" title="{legende}" loading="lazy"\n'
                f'        allow="fullscreen" referrerpolicy="no-referrer"></iframe>\n'
                f'<figcaption class="figure-legende">{legende} '
                f'<a href="{url}" target="_blank" rel="noopener noreferrer">'
                f'Ouvrir dans un nouvel onglet</a></figcaption>\n'
                f'</figure>\n')

    texte = INTEGRATION.sub(integration, texte)
    texte = CARTES.sub(
        lambda m: f'<div class="cartes" markdown="1">\n{m.group(1).strip()}\n</div>\n',
        texte)
    texte = COLONNES.sub(colonnes, texte)
    return BLOC.sub(encadre, texte)


IMAGE = re.compile(r'<p>\s*(<img[^>]*>)\s*</p>')
ATTRIBUT = re.compile(r'(\w+)="([^"]*)"')


def charger_credits() -> dict:
    """Réunit le registre des images et leurs crédits.

    medias/sources.yml décrit les images : nom, fiche, cadrage, source. Il est
    livré avec le site et peut être remplacé à chaque mise à jour.
    medias/credits.yml est rempli par outils/images.py sur ta machine : il
    survit aux mises à jour, si bien qu'une image téléchargée une fois ne se
    retélécharge jamais.
    """
    fichier = MEDIAS / "sources.yml"
    if not fichier.exists():
        return {}
    registre = yaml.safe_load(fichier.read_text(encoding="utf-8")) or {}
    extra = MEDIAS / "credits.yml"
    if extra.exists():
        for nom, credit in (yaml.safe_load(extra.read_text(encoding="utf-8")) or {}).items():
            if nom in registre and isinstance(credit, dict):
                registre[nom].update({c: v for c, v in credit.items() if v})
    return registre


def composer_credit(source: dict) -> str:
    """Compose le crédit repliable d'une image, de la forme demandée :
    Auteur, Titre, Wikimedia Commons. Licence : Creative Commons BY-SA 3.0."""
    if not source.get("licence"):
        return ""
    auteur = source.get("auteur", "").strip()
    titre = source.get("titre", "").strip()
    lien = source.get("lien", "")
    nom_depot = source.get("depot") or "Wikimedia Commons"
    depot = (f'<a href="{lien}" rel="noopener" target="_blank">{nom_depot}</a>'
             if lien else nom_depot)
    debut = ", ".join(p for p in (auteur, titre) if p)
    return ('<details class="credit"><summary>Source</summary>'
            f'<span>{debut}, {depot}. '
            f'Licence&nbsp;: {source["licence"]}.</span></details>')


def habiller_images(html: str, credits: dict) -> str:
    """Transforme chaque image isolée en figure légendée et créditée.

    Le crédit suit la forme demandée :
      Auteur, Titre, Wikimedia Commons. Licence : Creative Commons BY-SA 3.0.

    Si le fichier n'est pas encore dans medias/, on affiche un espace réservé
    plutôt que de casser la page. Lance outils/images.py pour les récupérer.
    """
    def remplacer(m):
        balise = m.group(1)
        attrs = dict(ATTRIBUT.findall(balise))
        src = attrs.get("src", "")
        legende = attrs.get("alt", "")
        nom = src.split("/")[-1]
        source = credits.get(nom, {})
        cadrage = source.get("cadrage", "flottant")

        # Le navigateur ne télécharge une image qu'au moment où le lecteur
        # s'en approche. Sur une fiche qui en compte vingt, un élève qui lit
        # le tiers du texte n'en charge que le tiers.
        if "loading=" not in balise:
            balise = balise.replace("<img ", '<img loading="lazy" decoding="async" ', 1)

        credit = composer_credit(source)

        existe = (MEDIAS / src.split("medias/")[-1]).exists() if "medias/" in src else False
        if not existe:
            manquantes.append(nom)
            if not BROUILLON:
                return ""      # rien plutôt qu'un trou visible en classe
        corps = balise if existe else (
            '<div class="attente-image">'
            f'<span>Image à récupérer</span><em>{legende}</em>'
            '<code>python outils\\images.py</code></div>'
        )
        return (f'<figure class="illustration illustration--{cadrage}">{corps}'
                f'<figcaption><span class="figure-legende">{legende}</span>'
                f'{credit}</figcaption></figure>')

    return IMAGE.sub(remplacer, html)


FIGURE = re.compile(r'<figure class="illustration[^"]*">.*?</figure>', re.DOTALL)
ANCRAGE_QUESTIONS = re.compile(r'<aside class="encadre encadre--questions')


# Une vidéo exactement : le contenu ne peut pas franchir sa balise fermante,
# ce qui interdit à la paire d'engloutir du texte entre deux vidéos éloignées.
UNE_VIDEO = r'<figure class="video">(?:(?!</figure>).)*</figure>'
DUO_VIDEOS = re.compile('(' + UNE_VIDEO + r')\s*(' + UNE_VIDEO + ')', re.DOTALL)


def jumeler_videos(html: str) -> str:
    """Deux vidéos consécutives se placent côte à côte.

    Dès que deux figures vidéo se suivent sans texte entre elles, elles sont
    enveloppées dans une grille à deux colonnes qui se replie sur mobile. Une
    éventuelle troisième vidéo consécutive reste seule sous la paire.
    """
    return DUO_VIDEOS.sub(r'<div class="videos-duo">\1\2</div>', html)


def marquer_sources(html: str) -> str:
    """Différencie visuellement les mentions de sources du fil du texte.

    Un paragraphe entier de la forme (Source ...) reçoit la classe
    source-texte; une mention en fin de paragraphe est enveloppée dans un
    span de la même classe. Le style vit dans theme/style.css.
    """
    html = re.sub(r"([^>])(\(Source[^<]*\))</p>",
                  r'\1<span class="source-texte">\2</span></p>', html)
    html = re.sub(r"<p>(\(Source[^<]*\))</p>",
                  r'<p class="source-texte">\1</p>', html)
    return html


def ranger_figures(html: str) -> str:
    """Une seule image flottante par section ou sous-section.

    Dès qu'une section (un h2) ou une sous-section (un h3) contient deux
    figures ou plus, elles sont retirées du fil du texte et regroupées en
    galerie uniforme à la fin du bloc, juste avant les questions s'il y en a.
    C'est ce qui empêche les collisions de flottants qui rendaient les pages
    chaotiques. Le découpage au h3 garde chaque galerie au plus près des
    paragraphes qu'elle illustre : les images de l'éducation restent dans la
    sous-section des enfants au lieu de glisser à la fin des classes sociales.
    """
    morceaux = re.split(r"(?=<h2|<h3)", html)
    resultat = []
    for morceau in morceaux:
        figures = FIGURE.findall(morceau)
        if len(figures) >= 2:
            morceau = FIGURE.sub("", morceau)
            galerie = '<div class="galerie">' + "".join(figures) + "</div>\n"
            ancre = ANCRAGE_QUESTIONS.search(morceau)
            if ancre:
                i = ancre.start()
                morceau = morceau[:i] + galerie + morceau[i:]
            else:
                morceau = morceau + galerie
        resultat.append(morceau)
    return "".join(resultat)


def ouvrir(chemin: Path) -> tuple[dict, str]:
    """Sépare l'en-tête YAML du corps Markdown."""
    brut = chemin.read_text(encoding="utf-8")
    if not brut.startswith("---"):
        raise ValueError(f"{chemin.name} n'a pas d'en-tête YAML.")
    _, entete, corps = brut.split("---", 2)
    return (yaml.safe_load(entete) or {}), corps.strip()


def mettre_en_forme(corps: str, credits: dict) -> tuple[str, list]:
    """Fait passer un corps Markdown dans toute la chaîne de mise en forme.

    Fiches et pages hors matière partagent exactement le même traitement :
    blocs :::, figures créditées, galeries, duos de vidéos et sources. C'est
    ce qui garantit qu'un composant se comporte pareil des deux côtés.
    """
    md = markdown.Markdown(extensions=EXTENSIONS_MD,
                           extension_configs={"toc": {"slugify":
                                                      lambda v, s: glisser(v)}})
    html = marquer_sources(jumeler_videos(ranger_figures(
        habiller_images(md.convert(convertir_blocs(corps, credits)), credits))))
    return html, [t for t in md.toc_tokens]


def lire_page(chemin: Path, credits: dict) -> dict:
    """Lit une page hors matière, déposée dans contenu/pages/.

    Ces pages sortent à la racine du site et n'appartiennent à aucune des deux
    matières : ni frise, ni parcours, ni concepts, ni voisin précédent ou
    suivant. Elles servent à ce qui vaut pour les deux, comme la page des
    ressources pédagogiques. La palette reste neutre, faute de section.
    """
    donnees, corps = ouvrir(chemin)
    donnees["html"], donnees["sommaire"] = mettre_en_forme(corps, credits)
    donnees["nom"] = chemin.stem
    donnees["url"] = f"{chemin.stem}.html"
    return donnees


def lire_fiche(chemin: Path, credits: dict) -> dict:
    donnees, corps = ouvrir(chemin)
    donnees["html"], donnees["sommaire"] = mettre_en_forme(corps, credits)
    donnees["nom"] = chemin.stem
    donnees["url"] = f"{donnees['section']}/{chemin.stem}.html"

    # Le résumé sert sur la page d'index et dans les métadonnées.
    # On saute les paragraphes du gabarit, qui portent tous une classe.
    premier = re.search(r"<p>(.*?)</p>", donnees["html"], re.DOTALL)
    resume = re.sub(r"<[^>]+>", "", premier.group(1)) if premier else ""
    donnees["resume"] = " ".join(resume.split())

    donnees["vide"] = "À REMPLIR" in corps
    return donnees


def charger_tout(config: dict) -> dict:
    sections = {}
    credits = charger_credits()
    for cle, meta in config["sections"].items():
        dossier = CONTENU / cle
        fiches = sorted((lire_fiche(p, credits) for p in dossier.glob("*.md")),
                        key=lambda f: f.get("ordre", 999))
        # Le parcours est la suite des réalités sociales ou des territoires.
        # Les pages de méthode et de repères n'en font pas partie : elles ne
        # figurent ni sur la frise ni dans la navigation précédent-suivant.
        parcours = [f for f in fiches if not f.get("hors_parcours")]
        for f in fiches:
            f["precedent"] = f["suivant"] = None
            f["position"] = None
        for i, f in enumerate(parcours):
            f["precedent"] = parcours[i - 1] if i > 0 else None
            f["suivant"] = parcours[i + 1] if i < len(parcours) - 1 else None
            f["position"] = i + 1
        # Les crans de la frise gardent la même largeur d'une rangée à l'autre :
        # la grille compte autant de colonnes que la rangée la plus fournie.
        rangees = meta.get("parcours_rangees") or []
        debut, crans_max = 0, len(parcours)
        if rangees:
            crans_max = 1
            for rangee in rangees:
                crans_max = max(crans_max, rangee["fin"] - debut)
                debut = rangee["fin"]
        sections[cle] = dict(meta, cle=cle, fiches=fiches, parcours=parcours,
                             crans_max=crans_max)
    return sections


def grouper(section: dict) -> list:
    """Range les fiches d'une section selon les groupes de site.yml."""
    resultat = []
    for groupe in section.get("groupes", []):
        membres = [f for f in section["fiches"] if f.get("groupe") == groupe["cle"]]
        if membres:
            resultat.append(dict(groupe, fiches=membres))
    orphelines = [f for f in section["fiches"]
                  if f.get("groupe") not in {g["cle"] for g in section.get("groupes", [])}]
    if orphelines:
        resultat.append({"cle": "autres", "titre": "Autres", "fiches": orphelines})
    return resultat


def synchroniser_medias(source: Path, cible: Path) -> tuple:
    """Recopie uniquement les médias nouveaux ou modifiés.

    Comparer la taille et la date de modification suffit ici : les images ne
    sont jamais réécrites sur place, elles sont remplacées. On évite ainsi de
    recopier des dizaines de mégaoctets à chaque construction.
    """
    copies = retires = 0
    attendus = set()
    for fichier in source.rglob("*"):
        if fichier.is_dir() or fichier.name == "sources.yml":
            continue
        relatif = fichier.relative_to(source)
        attendus.add(relatif)
        destination = cible / relatif
        if destination.exists():
            avant, apres = fichier.stat(), destination.stat()
            if (avant.st_size == apres.st_size
                    and int(avant.st_mtime) <= int(apres.st_mtime)):
                continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(fichier, destination)
        copies += 1
    if cible.exists():
        for fichier in list(cible.rglob("*")):
            if fichier.is_dir():
                continue
            if fichier.relative_to(cible) not in attendus:
                fichier.unlink()
                retires += 1
    return copies, retires


def construire(servir: bool = False, brouillon: bool = False) -> None:
    global BROUILLON
    BROUILLON = brouillon
    manquantes.clear()
    config = yaml.safe_load((RACINE / "site.yml").read_text(encoding="utf-8"))
    sortie = RACINE / config.get("sortie", "public")
    # On efface les pages construites, mais on garde sortie/medias : recopier
    # 75 Mo d'images à chaque construction prend des minutes sur un disque
    # ordinaire, alors que presque rien n'a changé.
    if sortie.exists():
        for element in sortie.iterdir():
            if element.name == "medias":
                continue
            shutil.rmtree(element) if element.is_dir() else element.unlink()
    sortie.mkdir(parents=True, exist_ok=True)

    sections = charger_tout(config)

    env = Environment(loader=FileSystemLoader(THEME),
                      autoescape=select_autoescape(["html"]),
                      trim_blocks=True, lstrip_blocks=True)
    env.filters["glisser"] = glisser

    contexte = {"site": config, "sections": sections}

    # L'empreinte force le navigateur à recharger les styles à chaque build.
    empreinte = hashlib.md5((THEME / "style.css").read_bytes()).hexdigest()[:8]
    env.globals["v"] = empreinte

    # Accueil
    (sortie / "index.html").write_text(
        env.get_template("accueil.html").render(**contexte, base="."),
        encoding="utf-8")

    # Index de section et fiches
    gabarit_index = env.get_template("index_section.html")
    gabarit_fiche = env.get_template("fiche.html")
    total = 0
    for cle, section in sections.items():
        dossier = sortie / cle
        dossier.mkdir(parents=True, exist_ok=True)
        (dossier / "index.html").write_text(
            gabarit_index.render(**contexte, section=section,
                                 groupes=grouper(section), base=".."),
            encoding="utf-8")
        for fiche in section["fiches"]:
            (dossier / f"{fiche['nom']}.html").write_text(
                gabarit_fiche.render(**contexte, section=section,
                                     fiche=fiche, base=".."),
                encoding="utf-8")
            total += 1

    # Pages hors matière. Elles sortent à la racine, à côté de l'accueil, et
    # n'entrent dans aucun index de section : leur seul accès est le lien
    # posé sur la page d'accueil.
    credits = charger_credits()
    gabarit_page = env.get_template("page.html")
    pages = 0
    for chemin in sorted(PAGES.glob("*.md")) if PAGES.exists() else []:
        page = lire_page(chemin, credits)
        (sortie / f"{page['nom']}.html").write_text(
            gabarit_page.render(**contexte, page=page, base="."),
            encoding="utf-8")
        pages += 1

    shutil.copy2(THEME / "style.css", sortie / "style.css")
    shutil.copy2(THEME / "page.js", sortie / "page.js")
    # Les interfaces d'administration. Elles vivent dans theme/ pour survivre
    # au grand ménage du début de construction, et se publient telles
    # quelles : sans jeton GitHub, elles ne donnent accès à rien.
    shutil.copy2(THEME / "admin-ressources.html", sortie / "admin-ressources.html")
    shutil.copy2(THEME / "admin-actualite.html", sortie / "admin-actualite.html")
    if MEDIAS.exists():
        copies, retires = synchroniser_medias(MEDIAS, sortie / "medias")
        if copies or retires:
            print(f"  medias : {copies} copiée(s), {retires} retirée(s)")
    (sortie / ".nojekyll").write_text("", encoding="utf-8")

    if manquantes:
        uniques = sorted(set(manquantes))
        print(f"  {len(uniques)} images absentes, omises du site : {', '.join(uniques[:5])}"
              + (" ..." if len(uniques) > 5 else ""))
        print("  python outils/images.py pour les récupérer, "
              "python build.py --brouillon pour voir leur emplacement")
    a_faire = sum(1 for s in sections.values() for f in s["fiches"] if f["vide"])
    from datetime import datetime
    marque = datetime.now().strftime("%Y-%m-%d %H:%M")
    (sortie / "version.txt").write_text(marque, encoding="utf-8")
    print(f"  {total} fiches et {pages} page(s) construites dans "
          f"{sortie.relative_to(RACINE)}/ ({marque})")
    if a_faire:
        print(f"  {a_faire} fiches contiennent encore des sections à remplir.")

    if servir:
        import http.server, socketserver, os
        os.chdir(sortie)
        with socketserver.TCPServer(("", 8000),
                                    http.server.SimpleHTTPRequestHandler) as srv:
            print("  Aperçu sur http://localhost:8000  (Ctrl+C pour arrêter)")
            srv.serve_forever()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Construit le site.")
    ap.add_argument("--servir", action="store_true",
                    help="démarre un serveur local après la construction")
    ap.add_argument("--brouillon", action="store_true",
                    help="affiche l'emplacement des images encore absentes")
    construire(**vars(ap.parse_args()))
