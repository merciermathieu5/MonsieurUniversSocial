#!/usr/bin/env python3
"""
Vérifie que tous les liens internes du site construit mènent quelque part.

    python3 build.py && python3 outils/liens.py

Ne teste pas les liens externes, seulement les fichiers du site. À lancer après
chaque construction, surtout après avoir renommé ou déplacé une fiche.
"""
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "docs"
LIEN = re.compile(r'(?:href|src)="([^"#:]+)"')


def main() -> int:
    if not SORTIE.exists():
        print("Le dossier public/ n'existe pas. Lance d'abord python3 build.py")
        return 1

    brises, verifies = [], 0
    for page in sorted(SORTIE.rglob("*.html")):
        contenu = page.read_text(encoding="utf-8")
        for href in LIEN.findall(contenu):
            if href.startswith(("http", "mailto", "//", "#", "data:")):
                continue
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
