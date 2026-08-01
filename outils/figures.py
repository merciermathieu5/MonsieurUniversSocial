#!/usr/bin/env python3
"""Replace les figures en tête de leur bloc, comme le veut la convention.

    python3 outils/figures.py                    rapport sur toutes les fiches
    python3 outils/figures.py FICHE.md           rapport sur une fiche
    python3 outils/figures.py --appliquer FICHE  déplace et réécrit la fiche

Convention visuelle du README : une figure se place juste après le titre de
sa section ou de sa sous-section, pour que le texte coule à côté de l'image
au lieu de laisser une zone vide. Cet outil déplace toute référence d'image
qui traîne plus bas dans son bloc, en préservant l'ordre des figures. Les
blocs ::: (questions, schémas, colonnes, vidéos, composants) sont opaques :
rien n'y est lu ni déplacé.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CONTENU = RACINE / "contenu"

TITRE = re.compile(r"^#{2,4} ")
IMAGE = re.compile(r"^!\[[^\]]*\]\([^)]+\)\s*$")


def traiter(chemin: Path, appliquer: bool) -> int:
    brut = chemin.read_text(encoding="utf-8")
    if not brut.startswith("---"):
        return 0
    fin_entete = brut.index("---", 3) + 3
    entete, corps = brut[:fin_entete], brut[fin_entete:]

    lignes = corps.split("\n")
    sortie: list[str] = []
    bloc: list[str] = []
    deplacements = 0

    def vider_bloc() -> None:
        nonlocal deplacements
        if not bloc:
            return
        if not TITRE.match(bloc[0]):
            sortie.extend(bloc)
            return
        titre, reste = bloc[0], bloc[1:]
        en_fence = False
        images, autres = [], []
        prose_vue = False
        for l in reste:
            if l.strip().startswith(":::"):
                en_fence = not en_fence
                autres.append(l)
                continue
            if not en_fence and IMAGE.match(l.strip()):
                images.append(l.strip())
                if prose_vue:
                    deplacements += 1
                continue
            if l.strip() and not en_fence:
                prose_vue = True
            autres.append(l)
        sortie.append(titre)
        sortie.append("")
        for img in images:
            sortie.append(img)
            sortie.append("")
        while autres and not autres[0].strip():
            autres.pop(0)
        sortie.extend(autres)

    for l in lignes:
        if TITRE.match(l):
            vider_bloc()
            bloc = [l]
        else:
            bloc.append(l)
    vider_bloc()

    if deplacements:
        print(f"    {chemin.relative_to(RACINE)} : {deplacements} figure(s) à remonter")
    if appliquer and deplacements:
        nouveau = entete + "\n".join(sortie)
        nouveau = re.sub(r"\n{3,}", "\n\n", nouveau)
        if not nouveau.endswith("\n"):
            nouveau += "\n"
        chemin.write_text(nouveau, encoding="utf-8")
    return deplacements


def compter(chemin: Path) -> int:
    """Compte sans rien écrire ni imprimer, pour le vérificateur."""
    import contextlib, io
    with contextlib.redirect_stdout(io.StringIO()):
        return traiter(chemin, appliquer=False)


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--appliquer"]
    appliquer = "--appliquer" in sys.argv
    cibles = ([Path(a).resolve() for a in args] if args
              else sorted(CONTENU.rglob("*.md")))
    total = 0
    print("FIGURES" + (" (application)" if appliquer else " (rapport)"))
    for chemin in cibles:
        total += traiter(chemin, appliquer)
    if not total:
        print("    ok   toutes les figures sont en tête de leur bloc")
    else:
        verbe = "remontées" if appliquer else "à remonter, relance avec --appliquer"
        print(f"\n{total} figure(s) {verbe}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
