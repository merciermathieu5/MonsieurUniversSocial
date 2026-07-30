#!/usr/bin/env python3
"""
Télécharge les illustrations depuis Wikimedia Commons et note leurs crédits.

    python3 outils/images.py            télécharge ce qui manque
    python3 outils/images.py --refaire  retélécharge tout
    python3 outils/images.py --largeur 1200

Lit medias/sources.yml, interroge l'API de Commons pour chaque entrée, dépose
l'image dans medias/<fiche>/<fichier> et réécrit sources.yml en y inscrivant
l'auteur, la licence et le lien vers la page source.

Le crédit vient de la page Commons, pas de nous. C'est ce qui rend l'attribution
valable pour les licences Creative Commons.

Dépendances : pip install requests PyYAML
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

try:
    import requests
    import yaml
except ImportError:
    sys.exit("Lance d'abord : pip install requests PyYAML")

RACINE = Path(__file__).resolve().parent.parent
MEDIAS = RACINE / "medias"
REGISTRE = MEDIAS / "sources.yml"
API = "https://commons.wikimedia.org/w/api.php"
ENTETES = {"User-Agent": "muniverssocial/1.0 (site pedagogique; contact via github)"}

LICENCES_LISIBLES = {
    "cc-by-sa-4.0": "CC BY-SA 4.0", "cc-by-sa-3.0": "CC BY-SA 3.0",
    "cc-by-sa-2.0": "CC BY-SA 2.0", "cc-by-4.0": "CC BY 4.0",
    "cc-by-3.0": "CC BY 3.0", "cc-by-2.0": "CC BY 2.0",
    "cc0": "CC0", "pd": "Domaine public", "public domain": "Domaine public",
}


def nettoyer(valeur: str) -> str:
    """Les métadonnées de Commons arrivent en HTML. On garde le texte."""
    if not valeur:
        return ""
    texte = re.sub(r"<[^>]+>", " ", valeur)
    return " ".join(html.unescape(texte).split())


def interroger(titre: str, largeur: int) -> dict | None:
    reponse = requests.get(API, timeout=30, headers=ENTETES, params={
        "action": "query", "format": "json", "titles": titre,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": largeur,
    })
    reponse.raise_for_status()
    pages = reponse.json().get("query", {}).get("pages", {})
    for page in pages.values():
        if "missing" in page or not page.get("imageinfo"):
            return None
        info = page["imageinfo"][0]
        meta = info.get("extmetadata", {})
        licence_brute = (meta.get("LicenseShortName", {}).get("value")
                         or meta.get("License", {}).get("value") or "")
        licence = nettoyer(licence_brute)
        licence = LICENCES_LISIBLES.get(licence.lower(), licence)
        return {
            "url": info.get("thumburl") or info["url"],
            "auteur": nettoyer(meta.get("Artist", {}).get("value", "")),
            "licence": licence or "voir la page source",
            "lien": info.get("descriptionurl", ""),
        }
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refaire", action="store_true",
                    help="retélécharge même si le fichier existe déjà")
    ap.add_argument("--largeur", type=int, default=1400,
                    help="largeur maximale en pixels (défaut : 1400)")
    args = ap.parse_args()

    if not REGISTRE.exists():
        sys.exit("medias/sources.yml est introuvable.")
    registre = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}

    reussites = echecs = sautees = 0
    for nom, entree in registre.items():
        dossier = MEDIAS / entree.get("fiche", "divers")
        cible = dossier / nom
        if cible.exists() and not args.refaire:
            sautees += 1
            continue

        titre = entree.get("commons", "")
        if not titre:
            print(f"  {nom} : pas de source Commons indiquée")
            echecs += 1
            continue

        try:
            trouve = interroger(titre, args.largeur)
        except Exception as erreur:
            print(f"  {nom} : {erreur}")
            echecs += 1
            continue

        if not trouve:
            print(f"  {nom} : introuvable sur Commons ({titre})")
            echecs += 1
            continue

        try:
            donnees = requests.get(trouve["url"], timeout=60, headers=ENTETES).content
            dossier.mkdir(parents=True, exist_ok=True)
            cible.write_bytes(donnees)
        except Exception as erreur:
            print(f"  {nom} : téléchargement impossible, {erreur}")
            echecs += 1
            continue

        entree["auteur"] = trouve["auteur"]
        entree["licence"] = trouve["licence"]
        entree["lien"] = trouve["lien"]
        taille = len(donnees) // 1024
        print(f"  {nom}  {taille} ko  {trouve['licence']}")
        reussites += 1

    REGISTRE.write_text(
        yaml.safe_dump(registre, allow_unicode=True, sort_keys=False, width=100),
        encoding="utf-8")

    print(f"\n{reussites} téléchargées, {sautees} déjà présentes, {echecs} en échec.")
    if echecs:
        print("Corrige les noms « File:... » dans medias/sources.yml, puis relance.")
    print("Relance ensuite python3 build.py pour reconstruire le site.")


if __name__ == "__main__":
    main()
