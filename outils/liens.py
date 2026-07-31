#!/usr/bin/env python3
"""
Vérifie que tous les liens internes du site construit mènent quelque part.

    python3 build.py && python3 outils/liens.py

Ne teste pas les liens externes, seulement les fichiers du site. À lancer après
chaque construction, surtout après avoir renommé ou déplacé une fiche.
"""
import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "docs"
LIEN = re.compile(r'(?:href|src)="([^"#:]+)"')


def controler_externes() -> int:
    """Teste chaque adresse sortante du site. Long, à lancer de temps en temps."""
    adresses = set()
    for page in SORTIE.rglob("*.html"):
        for href in re.findall(r'href="(https?://[^"]+)"', page.read_text(encoding="utf-8")):
            adresses.add(href)
    print(f"{len(adresses)} adresses externes à tester\n")
    morts = []
    for url in sorted(adresses):
        requete = urllib.request.Request(url, method="HEAD",
                                         headers={"User-Agent": "muniverssocial/1.0"})
        try:
            with urllib.request.urlopen(requete, timeout=20) as r:
                code = r.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:
            code = str(e)[:40]
        ok = code == 200
        print(f"  {'ok    ' if ok else 'ECHEC '} {code}  {url[:96]}")
        if not ok:
            morts.append((code, url))
    print(f"\n{len(morts)} adresse(s) à revoir.")
    if morts:
        print("Un 403 massif signifie souvent un réseau filtré, pas des liens morts.")
        print("Vérifie alors quelques adresses à la main dans un navigateur.")
    return 1 if morts else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--externes", action="store_true",
                    help="teste aussi les adresses sortantes (lent)")
    args = ap.parse_args()

    if not SORTIE.exists():
        print("Le dossier public/ n'existe pas. Lance d'abord python3 build.py")
        return 1

    brises, verifies = [], 0
    for page in sorted(SORTIE.rglob("*.html")):
        contenu = page.read_text(encoding="utf-8")
        for href in LIEN.findall(contenu):
            if href.startswith(("http", "mailto", "//", "#", "data:")):
                continue
            href = href.split("?")[0]
            verifies += 1
            if not (page.parent / href).resolve().exists():
                brises.append((page.relative_to(SORTIE), href))

    print(f"{verifies} liens internes vérifiés dans {len(list(SORTIE.rglob('*.html')))} pages")
    if brises:
        print(f"\n{len(brises)} liens brisés :")
        for page, href in brises:
            print(f"  {page} -> {href}")
        return 1
    print("Aucun lien brisé.")
    if args.externes:
        print()
        return controler_externes()
    return 0


if __name__ == "__main__":
    sys.exit(main())
