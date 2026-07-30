#!/usr/bin/env python3
"""
Récupère une page publiée de l'ancien Google Site et la convertit en Markdown.

Google ne permet pas d'exporter un Site, ni par Drive ni par API. Le seul moyen
de sortir le contenu est de lire la page publiée. Ce script fait ça.

    python3 outils/extraire.py --tout
    python3 outils/extraire.py --url https://sites.google.com/view/.../la-romanisation

Le texte récupéré atterrit dans extraction/. Il n'écrase JAMAIS les fiches de
contenu/ : la révision reste une étape manuelle, parce que c'est là que se
corrigent les erreurs de contenu.

Les images ne sont pas téléchargées automatiquement. Leurs adresses sont notées
en commentaire dans le fichier produit. Utilise --images pour les rapatrier dans
medias/.

Dépendances : pip install requests beautifulsoup4 html2text
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

try:
    import requests
    from bs4 import BeautifulSoup
    import html2text
except ImportError:
    sys.exit("Lance d'abord : pip install requests beautifulsoup4 html2text")

RACINE = Path(__file__).resolve().parent.parent
DEPOT = RACINE / "extraction"
MEDIAS = RACINE / "medias"

BASE = "https://sites.google.com/view/muniverssocial"
SECTIONS = {
    "histoire": "histoire-et-éducation-à-la-citoyenneté",
    "geographie": "géographie-et-éducation-à-la-citoyenneté",
}


def glisser(texte: str) -> str:
    texte = unicodedata.normalize("NFKD", unquote(texte))
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    texte = re.sub(r"[^\w\s-]", "", texte.lower())
    return re.sub(r"[\s_]+", "-", texte).strip("-")


def telecharger(url: str) -> BeautifulSoup:
    reponse = requests.get(url, timeout=30,
                           headers={"User-Agent": "muniverssocial-extraction"})
    reponse.raise_for_status()
    return BeautifulSoup(reponse.text, "html.parser")


def liens_de_section(soup: BeautifulSoup, section: str) -> list[str]:
    """Trouve les pages filles d'une section dans le menu du site."""
    prefixe = f"/view/muniverssocial/{SECTIONS[section]}/"
    vus, resultat = set(), []
    for a in soup.find_all("a", href=True):
        chemin = urlparse(a["href"]).path
        if chemin.startswith(prefixe) and chemin not in vus:
            vus.add(chemin)
            resultat.append(urljoin("https://sites.google.com", a["href"]))
    return resultat


def corps_principal(soup: BeautifulSoup):
    """Isole le contenu réel en écartant le menu, l'entête et le pied."""
    for balise in soup(["nav", "script", "style", "header", "footer"]):
        balise.decompose()
    # Sur Google Sites le contenu vit sous le premier role="main".
    principal = soup.find(attrs={"role": "main"}) or soup.body
    return principal


def en_markdown(fragment) -> str:
    convertisseur = html2text.HTML2Text()
    convertisseur.body_width = 0
    convertisseur.ignore_images = False
    convertisseur.ignore_emphasis = False
    texte = convertisseur.handle(str(fragment))
    # Google Sites ajoute des ancres du type [#h.abc123](#h.abc123) dans les titres.
    texte = re.sub(r"\[#h\.[\w-]+\]\(#h\.[\w-]+\)", "", texte)
    texte = re.sub(r"\n{3,}", "\n\n", texte)
    return texte.strip()


def rapatrier_images(texte: str, nom: str) -> str:
    MEDIAS.mkdir(exist_ok=True)
    dossier = MEDIAS / nom
    dossier.mkdir(exist_ok=True)
    compteur = 0

    def remplacer(m):
        nonlocal compteur
        url = m.group(2)
        if not url.startswith("http"):
            return m.group(0)
        compteur += 1
        cible = dossier / f"{compteur:02d}.jpg"
        try:
            donnees = requests.get(url, timeout=30).content
            cible.write_bytes(donnees)
        except Exception as erreur:
            print(f"    image {compteur} non récupérée : {erreur}")
            return m.group(0)
        return f"![{m.group(1)}](../medias/{nom}/{cible.name})"

    texte = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", remplacer, texte)
    if compteur:
        print(f"    {compteur} images dans medias/{nom}/")
    return texte


def extraire(url: str, section: str, images: bool) -> Path:
    soup = telecharger(url)
    titre_balise = soup.find("h1")
    titre = titre_balise.get_text(strip=True) if titre_balise else glisser(url)
    nom = glisser(urlparse(url).path.rstrip("/").split("/")[-1])

    texte = en_markdown(corps_principal(soup))
    if images:
        texte = rapatrier_images(texte, nom)

    DEPOT.mkdir(exist_ok=True)
    cible = DEPOT / f"{section}-{nom}.md"
    cible.write_text(
        f"<!-- Extrait de {url}\n"
        f"     le {time.strftime('%Y-%m-%d')}.\n"
        f"     Texte brut, non révisé. À relire avant de le verser dans contenu/. -->\n\n"
        f"# {titre}\n\n{texte}\n",
        encoding="utf-8")
    print(f"  {cible.relative_to(RACINE)}")
    return cible


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", help="extrait une seule page")
    ap.add_argument("--section", choices=list(SECTIONS), default="histoire")
    ap.add_argument("--tout", action="store_true",
                    help="extrait les deux sections au complet")
    ap.add_argument("--images", action="store_true",
                    help="télécharge aussi les images dans medias/")
    ap.add_argument("--pause", type=float, default=1.5,
                    help="délai entre deux pages, en secondes")
    args = ap.parse_args()

    if args.url:
        extraire(args.url, args.section, args.images)
        return

    if not args.tout:
        ap.error("Choisis --url ou --tout.")

    accueil = telecharger(BASE)
    for section in SECTIONS:
        print(f"\n{section} :")
        for lien in liens_de_section(accueil, section):
            try:
                extraire(lien, section, args.images)
            except Exception as erreur:
                print(f"  échec sur {lien} : {erreur}")
            time.sleep(args.pause)


if __name__ == "__main__":
    main()
