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
THEME = RACINE / "theme"
MEDIAS = RACINE / "medias"

EXTENSIONS_MD = ["extra", "toc", "sane_lists", "md_in_html"]

# ::: questions ... :::  ::: note ... :::  ::: video IDENTIFIANT ... :::
BLOC = re.compile(r"^::: *(questions|note|savais-tu) *$(.*?)^::: *$",
                  re.MULTILINE | re.DOTALL)
VIDEO = re.compile(r"^::: *video +([\w-]+) *$(.*?)^::: *$",
                   re.MULTILINE | re.DOTALL)
TITRES_BLOC = {
    "questions": "Questions",
    "note": "À retenir",
    "savais-tu": "Savais-tu que",
}


def glisser(texte: str) -> str:
    """Transforme un titre en identifiant d'URL sans accents."""
    texte = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    texte = re.sub(r"[^\w\s-]", "", texte.lower())
    return re.sub(r"[\s_]+", "-", texte).strip("-")


def convertir_blocs(texte: str) -> str:
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

    texte = VIDEO.sub(video, texte)
    return BLOC.sub(encadre, texte)


IMAGE = re.compile(r'<p>\s*(<img[^>]*>)\s*</p>')
ATTRIBUT = re.compile(r'(\w+)="([^"]*)"')


def charger_credits() -> dict:
    """medias/sources.yml est rempli automatiquement par outils/images.py."""
    fichier = MEDIAS / "sources.yml"
    if not fichier.exists():
        return {}
    return yaml.safe_load(fichier.read_text(encoding="utf-8")) or {}


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

        credit = ""
        if source.get("licence"):
            auteur = source.get("auteur", "").strip()
            titre = source.get("titre", "").strip()
            lien = source.get("lien", "")
            depot = (f'<a href="{lien}" rel="noopener" target="_blank">Wikimedia Commons</a>'
                     if lien else "Wikimedia Commons")
            debut = ", ".join(p for p in (auteur, titre) if p)
            credit = (f'<span class="credit">{debut}, {depot}. '
                      f'Licence&nbsp;: {source["licence"]}.</span>')

        existe = (MEDIAS / src.split("medias/")[-1]).exists() if "medias/" in src else False
        corps = balise if existe else (
            '<div class="attente-image">'
            f'<span>Image à récupérer</span><em>{legende}</em>'
            '<code>python outils\\images.py</code></div>'
        )
        role = source.get("role", "").strip()
        note = f'<span class="figure-role">{role}</span>' if role else ""
        return (f'<figure class="illustration illustration--{cadrage}">{corps}'
                f'<figcaption><span class="figure-legende">{legende}</span>'
                f'{note}{credit}</figcaption></figure>')

    return IMAGE.sub(remplacer, html)


def lire_fiche(chemin: Path, credits: dict) -> dict:
    brut = chemin.read_text(encoding="utf-8")
    if not brut.startswith("---"):
        raise ValueError(f"{chemin.name} n'a pas d'en-tête YAML.")
    _, entete, corps = brut.split("---", 2)
    donnees = yaml.safe_load(entete) or {}

    md = markdown.Markdown(extensions=EXTENSIONS_MD,
                           extension_configs={"toc": {"slugify":
                                                      lambda v, s: glisser(v)}})
    donnees["html"] = habiller_images(
        md.convert(convertir_blocs(corps.strip())), credits)
    donnees["sommaire"] = [t for t in md.toc_tokens]
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
        for i, f in enumerate(fiches):
            f["precedent"] = fiches[i - 1] if i > 0 else None
            f["suivant"] = fiches[i + 1] if i < len(fiches) - 1 else None
        sections[cle] = dict(meta, cle=cle, fiches=fiches)
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


def construire(servir: bool = False) -> None:
    config = yaml.safe_load((RACINE / "site.yml").read_text(encoding="utf-8"))
    sortie = RACINE / config.get("sortie", "public")
    if sortie.exists():
        shutil.rmtree(sortie)
    sortie.mkdir(parents=True)

    sections = charger_tout(config)

    env = Environment(loader=FileSystemLoader(THEME),
                      autoescape=select_autoescape(["html"]),
                      trim_blocks=True, lstrip_blocks=True)
    env.filters["glisser"] = glisser

    contexte = {"site": config, "sections": sections}

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

    shutil.copy2(THEME / "style.css", sortie / "style.css")
    shutil.copy2(THEME / "projection.js", sortie / "projection.js")
    if MEDIAS.exists():
        shutil.copytree(MEDIAS, sortie / "medias", dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns("sources.yml"))
    (sortie / ".nojekyll").write_text("", encoding="utf-8")

    a_faire = sum(1 for s in sections.values() for f in s["fiches"] if f["vide"])
    print(f"  {total} fiches construites dans {sortie.relative_to(RACINE)}/")
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
    construire(**vars(ap.parse_args()))
